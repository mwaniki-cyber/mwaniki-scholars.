/* =========================================================
   MWANIKI COMMUNITY
   PHASE 3
   COMMUNITIES + COURSE COMMUNITIES + CHANNELS + PERMISSIONS
========================================================= */

"use strict";

console.log("🚀 Mwaniki Community Phase 3 loaded");


/* =========================================================
   SUPABASE
========================================================= */

const communitySupabase =
    window.supabaseClient ||
    window.supabase ||
    null;

if (!communitySupabase) {
    console.error(
        "❌ Supabase client was not found. Check supabase.js."
    );
}


/* =========================================================
   STATE
========================================================= */

const communityState = {

    user: null,

    profile: null,

    communities: [],

    courses: [],

    channels: [],

    members: [],

    presence: {},

    messages: [],

    reactions: [],

    activeCommunity: null,

    activeChannel: null,

    activeRole: "student",

    activeReplyMessage: null,

    subscriptions: [],

    channelSubscription: null,

    presenceSubscription: null,

    messageSearchTerm: "",

    memberSearchTerm: "",

    channelSearchTerm: ""

};


/* =========================================================
   ROLE HIERARCHY
========================================================= */

const ROLE_LEVELS = {
    student: 10,
    tutor: 20,
    moderator: 30,
    admin: 40,
    "super-admin": 50,
    super_admin: 50
};


/* =========================================================
   DOM
========================================================= */

const $ = (selector) =>
    document.querySelector(selector);

const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));


/* =========================================================
   UTILITY
========================================================= */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function normalizeRole(role) {

    const value =
        String(role || "student")
            .trim()
            .toLowerCase()
            .replaceAll("_", "-")
            .replaceAll(" ", "-");

    if (value === "superadmin") {
        return "super-admin";
    }

    if (
        [
            "student",
            "tutor",
            "moderator",
            "admin",
            "super-admin"
        ].includes(value)
    ) {
        return value;
    }

    return "student";
}


function roleLevel(role) {
    return ROLE_LEVELS[normalizeRole(role)] || 10;
}


function canManageCommunity() {

    return roleLevel(
        communityState.activeRole
    ) >= ROLE_LEVELS.admin;
}


function canCreateCommunity() {

    return roleLevel(
        communityState.activeRole
    ) >= ROLE_LEVELS.admin;
}


function canCreateChannel() {

    return roleLevel(
        communityState.activeRole
    ) >= ROLE_LEVELS.moderator;
}


function canModerateMessages() {

    return roleLevel(
        communityState.activeRole
    ) >= ROLE_LEVELS.moderator;
}


function canSendMessages() {

    if (!communityState.activeChannel) {
        return false;
    }

    return true;
}


function getInitials(name) {

    const clean =
        String(name || "Student").trim();

    if (!clean) {
        return "S";
    }

    const parts =
        clean.split(/\s+/).filter(Boolean);

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


function formatTime(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


function formatDateTime(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString(
        [],
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}


function normalizeName(item, fallback = "Student") {

    return (
        item?.display_name ||
        item?.full_name ||
        item?.name ||
        item?.username ||
        item?.student_name ||
        item?.email ||
        fallback
    );
}


function getCommunityCourseId(community) {

    return (
        community?.course_id ??
        community?.linked_course_id ??
        null
    );
}


function getChannelCourseId(channel) {

    return (
        channel?.course_id ??
        channel?.linked_course_id ??
        null
    );
}


function getChannelCategory(channel) {

    return (
        channel?.category ||
        channel?.channel_category ||
        "General"
    );
}


function getChannelVisibility(channel) {

    return (
        channel?.visibility ||
        channel?.channel_visibility ||
        "public"
    ).toLowerCase();
}


function getMessageSenderId(message) {

    return (
        message?.sender_id ||
        message?.user_id ||
        message?.author_id ||
        message?.created_by ||
        null
    );
}


function getMessageContent(message) {

    return (
        message?.content ??
        message?.message ??
        message?.text ??
        ""
    );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message, type = "") {

    const toast =
        $("#communityToast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.className =
        "community-toast " +
        type;

    toast.hidden = false;

    clearTimeout(
        showToast.timeout
    );

    showToast.timeout =
        setTimeout(() => {
            toast.hidden = true;
        }, 3500);
}


/* =========================================================
   MODALS
========================================================= */

function openModal(id) {

    const modal = document.getElementById(id);

    if (modal) {
        modal.hidden = false;
    }
}


function closeModal(id) {

    const modal = document.getElementById(id);

    if (modal) {
        modal.hidden = true;
    }
}


function closeAllModals() {

    $$(".modal-backdrop").forEach(
        modal => {
            modal.hidden = true;
        }
    );
}


/* =========================================================
   AUTHENTICATION
========================================================= */

async function loadAuthenticatedUser() {

    if (!communitySupabase) {
        throw new Error(
            "Supabase is unavailable."
        );
    }

    const {
        data,
        error
    } =
        await communitySupabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {

        window.location.href =
            "index.html";

        return null;
    }

    communityState.user =
        data.user;

    return data.user;
}


/* =========================================================
   PROFILE
========================================================= */

async function loadCurrentProfile() {

    if (!communityState.user) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await communitySupabase
                .from("students")
                .select("*")
                .eq(
                    "id",
                    communityState.user.id
                )
                .maybeSingle();

        if (error) {
            console.warn(
                "⚠️ Student profile lookup:",
                error.message
            );
        }

        communityState.profile =
            data || null;

    } catch (error) {

        console.warn(
            "⚠️ Could not load student profile:",
            error
        );

    }

    renderCurrentUser();
}


function renderCurrentUser() {

    const name =
        normalizeName(
            communityState.profile,
            communityState.user?.email ||
            "Student"
        );

    const role =
        normalizeRole(
            communityState.profile?.role ||
            communityState.profile?.user_role ||
            communityState.profile?.account_role ||
            "student"
        );

    communityState.activeRole =
        role;

    const avatar =
        $("#currentUserAvatar");

    if (avatar) {
        avatar.textContent =
            getInitials(name);
    }

    const nameElement =
        $("#currentUserName");

    if (nameElement) {
        nameElement.textContent =
            name;
    }

    const roleElement =
        $("#currentUserRole");

    if (roleElement) {
        roleElement.textContent =
            displayRole(role);
    }

    updatePermissionUI();
}


function displayRole(role) {

    const normalized =
        normalizeRole(role);

    const labels = {
        "student": "Student",
        "tutor": "Tutor",
        "moderator": "Moderator",
        "admin": "Admin",
        "super-admin": "Super Admin"
    };

    return labels[normalized] ||
        "Student";
}


/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCourses() {

    try {

        const {
            data,
            error
        } =
            await communitySupabase
                .from("courses")
                .select("*")
                .order("title", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        communityState.courses =
            data || [];

        populateCourseSelectors();

    } catch (error) {

        console.warn(
            "⚠️ Course loading failed:",
            error.message
        );

    }
}


function populateCourseSelectors() {

    const selectors = [
        $("#communityCourseInput"),
        $("#channelCourseInput")
    ];

    selectors.forEach(
        select => {

            if (!select) {
                return;
            }

            const current =
                select.value;

            select.innerHTML = `
                <option value="">
                    Select a course
                </option>
            `;

            communityState.courses
                .forEach(course => {

                    const option =
                        document.createElement("option");

                    option.value =
                        course.id;

                    option.textContent =
                        course.title ||
                        `Course ${course.id}`;

                    select.appendChild(option);

                });

            select.value =
                current;

        }
    );
}


/* =========================================================
   LOAD COMMUNITIES
========================================================= */

async function loadCommunities() {

    const userId =
        communityState.user?.id;

    if (!userId) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await communitySupabase
                .from("chat_communities")
                .select("*")
                .order("created_at", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        let communities =
            data || [];

        /*
         * If membership records exist, use them
         * to determine the user's community role.
         */

        const {
            data: memberships,
            error: membershipError
        } =
            await communitySupabase
                .from("chat_community_members")
                .select("*")
                .eq(
                    "user_id",
                    userId
                );

        if (!membershipError &&
            Array.isArray(memberships)) {

            const membershipMap =
                new Map();

            memberships.forEach(member => {

                const communityId =
                    member.community_id;

                membershipMap.set(
                    String(communityId),
                    member
                );

            });

            communities =
                communities
                    .filter(community => {

                        /*
                         * Super Admin/Admin may see
                         * all communities.
                         */

                        if (
                            roleLevel(
                                communityState.activeRole
                            ) >= ROLE_LEVELS.admin
                        ) {
                            return true;
                        }

                        return membershipMap.has(
                            String(community.id)
                        );

                    })
                    .map(community => {

                        const membership =
                            membershipMap.get(
                                String(community.id)
                            );

                        return {
                            ...community,

                            membership_role:
                                membership?.role ||
                                community.membership_role ||
                                "student"
                        };

                    });

        }

        communityState.communities =
            communities;

        renderCommunityRail();
        renderCommunitySwitcher();

        if (
            !communityState.activeCommunity &&
            communities.length
        ) {

            selectCommunity(
                communities[0].id
            );

        } else if (
            communityState.activeCommunity
        ) {

            const stillExists =
                communities.some(
                    community =>
                        String(community.id) ===
                        String(
                            communityState
                                .activeCommunity
                                .id
                        )
                );

            if (!stillExists) {

                selectCommunity(
                    communities[0]?.id
                );

            }

        }

        updatePermissionUI();

    } catch (error) {

        console.error(
            "❌ Community loading failed:",
            error
        );

        showToast(
            "Unable to load communities.",
            "error"
        );

    }
}


/* =========================================================
   COMMUNITY RAIL
========================================================= */

function renderCommunityRail() {

    const container =
        $("#communityRailList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    communityState.communities
        .forEach(community => {

            const wrapper =
                document.createElement("div");

            wrapper.className =
                "rail-community";

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "rail-button rail-community-button";

            if (
                communityState.activeCommunity &&
                String(community.id) ===
                String(
                    communityState
                        .activeCommunity
                        .id
                )
            ) {
                button.classList.add("active");
            }

            const icon =
                document.createElement("div");

            icon.className =
                "community-icon";

            icon.textContent =
                getInitials(
                    community.name ||
                    community.title ||
                    "Community"
                );

            button.appendChild(icon);

            button.title =
                community.name ||
                community.title ||
                "Community";

            button.addEventListener(
                "click",
                () => {

                    selectCommunity(
                        community.id
                    );

                }
            );

            wrapper.appendChild(button);

            /*
             * Future unread badge.
             */

            const unread =
                Number(
                    community.unread_count || 0
                );

            if (unread > 0) {

                const badge =
                    document.createElement("span");

                badge.className =
                    "rail-community-unread";

                badge.textContent =
                    unread > 99
                        ? "99+"
                        : unread;

                wrapper.appendChild(badge);

            }

            container.appendChild(wrapper);

        });
}


/* =========================================================
   COMMUNITY SWITCHER
========================================================= */

function renderCommunitySwitcher() {

    const container =
        $("#communitySwitcherList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!communityState.communities.length) {

        container.innerHTML = `
            <div class="channel-loading">
                No communities available.
            </div>
        `;

        return;
    }

    communityState.communities
        .forEach(community => {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "community-switch-item";

            if (
                communityState.activeCommunity &&
                String(community.id) ===
                String(
                    communityState
                        .activeCommunity
                        .id
                )
            ) {
                button.classList.add("active");
            }

            const icon =
                document.createElement("div");

            icon.className =
                "community-icon";

            icon.textContent =
                getInitials(
                    community.name ||
                    community.title ||
                    "Community"
                );

            icon.style.width = "30px";
            icon.style.height = "30px";
            icon.style.borderRadius = "9px";
            icon.style.fontSize = "8px";

            const name =
                document.createElement("span");

            name.className =
                "community-switch-name";

            name.textContent =
                community.name ||
                community.title ||
                "Community";

            const role =
                document.createElement("span");

            role.className =
                "community-switch-role";

            role.textContent =
                displayRole(
                    community.membership_role ||
                    "student"
                );

            button.append(
                icon,
                name,
                role
            );

            button.addEventListener(
                "click",
                () => {

                    selectCommunity(
                        community.id
                    );

                    $("#communitySelectorMenu")
                        .hidden = true;

                }
            );

            container.appendChild(button);

        });
}


/* =========================================================
   SELECT COMMUNITY
========================================================= */

async function selectCommunity(
    communityId
) {

    const community =
        communityState.communities
            .find(
                item =>
                    String(item.id) ===
                    String(communityId)
            );

    if (!community) {
        return;
    }

    communityState.activeCommunity =
        community;

    communityState.activeRole =
        normalizeRole(
            community.membership_role ||
            communityState.profile?.role ||
            "student"
        );

    updateCommunityHeader();

    renderCommunityRail();
    renderCommunitySwitcher();

    await loadCommunityChannels();

    await loadCommunityMembers();

    subscribeToCommunity();

    updatePermissionUI();

    closeMobileSidebar();
}


function updateCommunityHeader() {

    const community =
        communityState.activeCommunity;

    if (!community) {
        return;
    }

    const name =
        community.name ||
        community.title ||
        "Community";

    const description =
        community.description ||
        "Medical learning community";

    const icon =
        $("#activeCommunityIcon");

    if (icon) {
        icon.textContent =
            getInitials(name);
    }

    const nameElement =
        $("#activeCommunityName");

    if (nameElement) {
        nameElement.textContent =
            name;
    }

    const descriptionElement =
        $("#activeCommunityDescription");

    if (descriptionElement) {
        descriptionElement.textContent =
            description;
    }

    const selectorName =
        $("#selectorCommunityName");

    if (selectorName) {
        selectorName.textContent =
            name;
    }

    const settingsName =
        $("#settingsCommunityName");

    if (settingsName) {
        settingsName.textContent =
            name;
    }

    const settingsInput =
        $("#settingsCommunityNameInput");

    if (settingsInput) {
        settingsInput.value =
            name;
    }

    const settingsDescription =
        $("#settingsCommunityDescriptionInput");

    if (settingsDescription) {
        settingsDescription.value =
            description;
    }
}


/* =========================================================
   LOAD CHANNELS
========================================================= */

async function loadCommunityChannels() {

    const community =
        communityState.activeCommunity;

    if (!community) {
        return;
    }

    const list =
        $("#channelList");

    if (list) {

        list.innerHTML = `
            <div class="channel-loading">
                Loading channels...
            </div>
        `;

    }

    try {

        const {
            data,
            error
        } =
            await communitySupabase
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    community.id
                )
                .order("position", {
                    ascending: true,
                    nullsFirst: false
                })
                .order("created_at", {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        let channels =
            data || [];

        /*
         * Private channels require membership.
         */

        const privateChannels =
            channels.filter(
                channel =>
                    getChannelVisibility(channel) ===
                    "private"
            );

        if (privateChannels.length) {

            const {
                data: memberships,
                error: membershipError
            } =
                await communitySupabase
                    .from("chat_channel_members")
                    .select("*")
                    .eq(
                        "user_id",
                        communityState.user.id
                    );

            if (!membershipError &&
                memberships) {

                const allowed =
                    new Set(
                        memberships.map(
                            item =>
                                String(
                                    item.channel_id
                                )
                        )
                    );

                channels =
                    channels.filter(
                        channel => {

                            if (
                                getChannelVisibility(
                                    channel
                                ) !== "private"
                            ) {
                                return true;
                            }

                            return (
                                allowed.has(
                                    String(channel.id)
                                ) ||
                                canManageCommunity()
                            );

                        }
                    );

            }

        }

        communityState.channels =
            channels;

        renderChannels();

        if (!channels.length) {

            clearChannel();

            return;
        }

        if (
            !communityState.activeChannel ||
            !channels.some(
                channel =>
                    String(channel.id) ===
                    String(
                        communityState
                            .activeChannel
                            .id
                    )
            )
        ) {

            await selectChannel(
                channels[0].id
            );

        } else {

            await selectChannel(
                communityState
                    .activeChannel
                    .id
            );

        }

    } catch (error) {

        console.error(
            "❌ Channel loading failed:",
            error
        );

        if (list) {

            list.innerHTML = `
                <div class="channel-loading">
                    Unable to load channels.
                </div>
            `;

        }

    }
}


/* =========================================================
   RENDER CHANNELS
========================================================= */

function renderChannels() {

    const container =
        $("#channelList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const search =
        communityState.channelSearchTerm
            .trim()
            .toLowerCase();

    const filtered =
        communityState.channels
            .filter(channel => {

                if (!search) {
                    return true;
                }

                const name =
                    String(
                        channel.name ||
                        channel.title ||
                        ""
                    ).toLowerCase();

                return name.includes(search);

            });

    const categories = {};

    filtered.forEach(channel => {

        const category =
            getChannelCategory(channel);

        if (!categories[category]) {
            categories[category] = [];
        }

        categories[category].push(channel);

    });

    Object.entries(categories)
        .forEach(
            ([categoryName, channels]) => {

                const category =
                    document.createElement("div");

                category.className =
                    "channel-category";

                const header =
                    document.createElement("div");

                header.className =
                    "channel-category-header";

                const title =
                    document.createElement("div");

                title.className =
                    "channel-category-title";

                title.innerHTML = `
                    <span>⌄</span>
                    <span>
                        ${escapeHTML(categoryName)}
                    </span>
                `;

                header.appendChild(title);

                if (canCreateChannel()) {

                    const add =
                        document.createElement("button");

                    add.type = "button";

                    add.className =
                        "channel-add-button";

                    add.textContent = "+";

                    add.title =
                        "Create channel";

                    add.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            openCreateChannel();

                        }
                    );

                    header.appendChild(add);

                }

                category.appendChild(header);


                channels.forEach(channel => {

                    const button =
                        document.createElement("button");

                    button.type = "button";

                    button.className =
                        "channel-item";

                    if (
                        communityState.activeChannel &&
                        String(channel.id) ===
                        String(
                            communityState
                                .activeChannel
                                .id
                        )
                    ) {
                        button.classList.add("active");
                    }

                    const visibility =
                        getChannelVisibility(
                            channel
                        );

                    button.innerHTML = `
                        <span class="channel-symbol">
                            ${visibility === "private" ? "🔒" : "#"}
                        </span>

                        <span class="channel-name">
                            ${escapeHTML(
                                channel.name ||
                                channel.title ||
                                "channel"
                            )}
                        </span>
                    `;

                    const unread =
                        Number(
                            channel.unread_count || 0
                        );

                    if (unread > 0) {

                        const badge =
                            document.createElement("span");

                        badge.className =
                            "channel-unread";

                        badge.textContent =
                            unread > 99
                                ? "99+"
                                : unread;

                        button.appendChild(
                            badge
                        );

                    }

                    button.addEventListener(
                        "click",
                        () => {

                            selectChannel(
                                channel.id
                            );

                        }
                    );

                    category.appendChild(
                        button
                    );

                });

                container.appendChild(
                    category
                );

            }
        );

    if (!filtered.length) {

        container.innerHTML = `
            <div class="channel-loading">
                No channels found.
            </div>
        `;

    }
}


/* =========================================================
   SELECT CHANNEL
========================================================= */

async function selectChannel(
    channelId
) {

    const channel =
        communityState.channels
            .find(
                item =>
                    String(item.id) ===
                    String(channelId)
            );

    if (!channel) {
        return;
    }

    communityState.activeChannel =
        channel;

    updateChannelHeader();

    renderChannels();

    await loadMessages();

    await loadChannelReactions();

    subscribeToChannel();

    await markChannelRead();

    updateCourseBanner();

    updateComposer();

    closeMobileSidebar();
}


function updateChannelHeader() {

    const channel =
        communityState.activeChannel;

    if (!channel) {
        return;
    }

    const name =
        channel.name ||
        channel.title ||
        "channel";

    const description =
        channel.description ||
        "Community discussion";

    const nameElement =
        $("#activeChannelName");

    if (nameElement) {
        nameElement.textContent =
            name;
    }

    const descriptionElement =
        $("#activeChannelDescription");

    if (descriptionElement) {
        descriptionElement.textContent =
            description;
    }

    const welcomeName =
        $("#welcomeChannelName");

    if (welcomeName) {
        welcomeName.textContent =
            name;
    }

    const input =
        $("#messageInput");

    if (input) {

        input.placeholder =
            `Message #${name}`;

    }
}


/* =========================================================
   COURSE-LINKED CHANNEL
========================================================= */

function updateCourseBanner() {

    const banner =
        $("#courseCommunityBanner");

    const channel =
        communityState.activeChannel;

    if (!banner || !channel) {
        return;
    }

    const courseId =
        getChannelCourseId(channel) ||
        getCommunityCourseId(
            communityState.activeCommunity
        );

    if (!courseId) {

        banner.hidden = true;

        return;
    }

    const course =
        communityState.courses
            .find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

    banner.hidden = false;

    const title =
        $("#courseCommunityTitle");

    const description =
        $("#courseCommunityDescription");

    if (title) {

        title.textContent =
            course?.title
                ? `${course.title} Discussion`
                : "Course Discussion";

    }

    if (description) {

        description.textContent =
            "Discuss this course with other students and tutors.";

    }
}


/* =========================================================
   CLEAR CHANNEL
========================================================= */

function clearChannel() {

    communityState.activeChannel =
        null;

    const list =
        $("#messageList");

    if (list) {
        list.innerHTML = "";
    }

    const input =
        $("#messageInput");

    if (input) {
        input.disabled = true;
    }

    const send =
        $("#sendMessageButton");

    if (send) {
        send.disabled = true;
    }

    const notice =
        $("#composerPermissionNotice");

    if (notice) {

        notice.hidden = false;

        notice.textContent =
            "There are no available channels in this community.";

    }

}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {

    const channel =
        communityState.activeChannel;

    if (!channel) {
        return;
    }

    const messageList =
        $("#messageList");

    if (messageList) {

        messageList.innerHTML = `
            <div class="channel-loading">
                Loading messages...
            </div>
        `;

    }

    try {

        const {
            data,
            error
        } =
            await communitySupabase
                .from("chat_messages")
                .select("*")
                .eq(
                    "channel_id",
                    channel.id
                )
                .order("created_at", {
                    ascending: true
                })
                .limit(500);

        if (error) {
            throw error;
        }

        communityState.messages =
            data || [];

        renderMessages();

    } catch (error) {

        console.error(
            "❌ Message loading failed:",
            error
        );

        if (messageList) {

            messageList.innerHTML = `
                <div class="channel-loading">
                    Unable to load messages.
                </div>
            `;

        }

    }
}


/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    const list =
        $("#messageList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const search =
        communityState.messageSearchTerm
            .trim()
            .toLowerCase();

    const messages =
        communityState.messages
            .filter(message => {

                if (!search) {
                    return true;
                }

                return getMessageContent(message)
                    .toLowerCase()
                    .includes(search);

            });

    if (!messages.length) {

        const empty =
            document.createElement("div");

        empty.className =
            "channel-loading";

        empty.textContent =
            search
                ? "No messages match your search."
                : "No messages yet. Start the conversation.";

        list.appendChild(empty);

        return;
    }


    messages.forEach(
        (message, index) => {

            const previous =
                messages[index - 1];

            const currentSender =
                getMessageSenderId(message);

            const previousSender =
                previous
                    ? getMessageSenderId(previous)
                    : null;

            const sameSender =
                currentSender &&
                previousSender &&
                String(currentSender) ===
                String(previousSender);

            const group =
                document.createElement("article");

            group.className =
                "message-group";

            if (sameSender) {
                group.classList.add(
                    "continuation"
                );
            }

            const sender =
                getMemberById(
                    currentSender
                );

            const senderName =
                normalizeName(
                    sender,
                    message?.sender_name ||
                    message?.author_name ||
                    "Student"
                );

            const senderRole =
                normalizeRole(
                    sender?.role ||
                    sender?.user_role ||
                    message?.sender_role ||
                    "student"
                );


            if (!sameSender) {

                const avatar =
                    document.createElement("div");

                avatar.className =
                    "message-avatar";

                avatar.textContent =
                    getInitials(senderName);

                group.appendChild(
                    avatar
                );

            } else {

                const spacer =
                    document.createElement("div");

                spacer.style.width = "36px";
                spacer.style.flexShrink = "0";

                group.appendChild(
                    spacer
                );

            }


            const content =
                document.createElement("div");

            content.className =
                "message-content";


            if (!sameSender) {

                const meta =
                    document.createElement("div");

                meta.className =
                    "message-meta";

                meta.innerHTML = `
                    <span class="message-author">
                        ${escapeHTML(senderName)}
                    </span>

                    <span class="message-role">
                        ${escapeHTML(
                            displayRole(senderRole)
                        )}
                    </span>

                    <span
                        class="message-time"
                        title="${escapeHTML(
                            formatDateTime(
                                message.created_at
                            )
                        )}"
                    >
                        ${escapeHTML(
                            formatTime(
                                message.created_at
                            )
                        )}
                    </span>
                `;

                content.appendChild(
                    meta
                );

            }


            const text =
                document.createElement("div");

            text.className =
                "message-text";

            text.innerHTML =
                escapeHTML(
                    getMessageContent(message)
                );

            content.appendChild(
                text
            );


            const reactions =
                renderMessageReactions(
                    message.id
                );

            if (reactions) {

                content.appendChild(
                    reactions
                );

            }


            const actions =
                document.createElement("div");

            actions.className =
                "message-actions";

            actions.innerHTML = `
                <button
                    class="message-action"
                    title="Reply"
                    data-action="reply"
                    data-message-id="${message.id}"
                >
                    ↩
                </button>

                <button
                    class="message-action"
                    title="React"
                    data-action="react"
                    data-message-id="${message.id}"
                >
                    ☺
                </button>

                <button
                    class="message-action"
                    title="Copy"
                    data-action="copy"
                    data-message-id="${message.id}"
                >
                    ⧉
                </button>

                ${
                    canModerateMessages()
                        ? `
                            <button
                                class="message-action"
                                title="Delete"
                                data-action="delete"
                                data-message-id="${message.id}"
                            >
                                🗑
                            </button>
                        `
                        : ""
                }
            `;

            content.appendChild(
                actions
            );

            group.appendChild(
                content
            );

            list.appendChild(
                group
            );

        }
    );

    scrollMessagesToBottom();
}


/* =========================================================
   MEMBER HELPERS
========================================================= */

function getMemberById(id) {

    if (!id) {
        return null;
    }

    return communityState.members
        .find(member => {

            const memberId =
                member.user_id ||
                member.id ||
                member.student_id;

            return String(memberId) ===
                String(id);

        }) || null;
}


/* =========================================================
   LOAD REACTIONS
========================================================= */

async function loadChannelReactions() {

    const channel =
        communityState.activeChannel;

    if (!channel) {
        return;
    }

    try {

        const messageIds =
            communityState.messages
                .map(
                    message => message.id
                )
                .filter(Boolean);

        if (!messageIds.length) {

            communityState.reactions = [];

            return;
        }

        const {
            data,
            error
        } =
            await communitySupabase
                .from("chat_message_reactions")
                .select("*")
                .in(
                    "message_id",
                    messageIds
                );

        if (error) {
            throw error;
        }

        communityState.reactions =
            data || [];

        renderMessages();

    } catch (error) {

        console.warn(
            "⚠️ Reactions loading failed:",
            error.message
        );

    }
}


function renderMessageReactions(
    messageId
) {

    const reactions =
        communityState.reactions
            .filter(
                reaction =>
                    String(
                        reaction.message_id
                    ) ===
                    String(messageId)
            );

    if (!reactions.length) {
        return null;
    }

    const container =
        document.createElement("div");

    container.className =
        "message-reactions";

    const groups = {};

    reactions.forEach(
        reaction => {

            const emoji =
                reaction.reaction ||
                reaction.emoji ||
                "👍";

            if (!groups[emoji]) {
                groups[emoji] = [];
            }

            groups[emoji].push(
                reaction
            );

        }
    );

    Object.entries(groups)
        .forEach(
            ([emoji, items]) => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "reaction-chip";

                const mine =
                    items.some(
                        item =>
                            String(
                                item.user_id
                            ) ===
                            String(
                                communityState
                                    .user
                                    .id
                            )
                    );

                if (mine) {
                    button.classList.add(
                        "active"
                    );
                }

                button.innerHTML =
                    `${escapeHTML(emoji)}
                     <span>${items.length}</span>`;

                button.addEventListener(
                    "click",
                    () => {

                        toggleReaction(
                            messageId,
                            emoji
                        );

                    }
                );

                container.appendChild(
                    button
                );

            }
        );

    return container;
}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    const channel =
        communityState.activeChannel;

    const input =
        $("#messageInput");

    if (!channel || !input) {
        return;
    }

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    if (!canSendMessages()) {

        showToast(
            "You cannot send messages here.",
            "error"
        );

        return;
    }

    input.disabled = true;

    try {

        /*
         * Keep insert compatible with the Phase 1
         * message schema.
         */

        const payload = {
            channel_id: channel.id,
            sender_id: communityState.user.id,
            content: content
        };

        const {
            error
        } =
            await communitySupabase
                .from("chat_messages")
                .insert(payload);

        if (error) {
            throw error;
        }

        input.value = "";

        resizeMessageInput();

        communityState.activeReplyMessage =
            null;

        $("#replyPreview").hidden =
            true;

        await loadMessages();

    } catch (error) {

        console.error(
            "❌ Message sending failed:",
            error
        );

        showToast(
            "Message could not be sent.",
            "error"
        );

    } finally {

        input.disabled = false;

        input.focus();

    }
}


/* =========================================================
   REACTIONS
========================================================= */

async function toggleReaction(
    messageId,
    emoji
) {

    const userId =
        communityState.user.id;

    try {

        const existing =
            communityState.reactions
                .find(
                    reaction =>
                        String(
                            reaction.message_id
                        ) ===
                        String(messageId) &&
                        String(
                            reaction.user_id
                        ) ===
                        String(userId) &&
                        (
                            reaction.reaction ||
                            reaction.emoji
                        ) === emoji
                );

        if (existing) {

            const {
                error
            } =
                await communitySupabase
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        existing.id
                    );

            if (error) {
                throw error;
            }

        } else {

            const {
                error
            } =
                await communitySupabase
                    .from(
                        "chat_message_reactions"
                    )
                    .insert({
                        message_id: messageId,
                        user_id: userId,
                        reaction: emoji
                    });

            if (error) {
                throw error;
            }

        }

        await loadChannelReactions();

    } catch (error) {

        console.error(
            "❌ Reaction error:",
            error
        );

        showToast(
            "Reaction could not be updated.",
            "error"
        );

    }
}


/* =========================================================
   MESSAGE ACTIONS
========================================================= */

async function handleMessageAction(
    action,
    messageId
) {

    const message =
        communityState.messages
            .find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

    if (!message) {
        return;
    }

    if (action === "reply") {

        const sender =
            getMemberById(
                getMessageSenderId(message)
            );

        communityState.activeReplyMessage =
            message;

        $("#replyPreviewAuthor")
            .textContent =
                normalizeName(
                    sender,
                    "Student"
                );

        $("#replyPreview").hidden =
            false;

        $("#messageInput").focus();

        return;
    }


    if (action === "copy") {

        try {

            await navigator.clipboard.writeText(
                getMessageContent(message)
            );

            showToast(
                "Message copied.",
                "success"
            );

        } catch {

            showToast(
                "Could not copy message.",
                "error"
            );

        }

        return;
    }


    if (action === "react") {

        await toggleReaction(
            message.id,
            "👍"
        );

        return;
    }


    if (action === "delete") {

        if (!canModerateMessages()) {

            showToast(
                "You do not have permission to delete messages.",
                "error"
            );

            return;
        }

        const confirmed =
            window.confirm(
                "Delete this message?"
            );

        if (!confirmed) {
            return;
        }

        try {

            const {
                error
            } =
                await communitySupabase
                    .from("chat_messages")
                    .delete()
                    .eq(
                        "id",
                        message.id
                    );

            if (error) {
                throw error;
            }

            await loadMessages();

            showToast(
                "Message deleted.",
                "success"
            );

        } catch (error) {

            console.error(
                "❌ Delete failed:",
                error
            );

            showToast(
                "Message could not be deleted.",
                "error"
            );

        }

    }

}


/* =========================================================
   LOAD COMMUNITY MEMBERS
========================================================= */

async function loadCommunityMembers() {

    const community =
        communityState.activeCommunity;

    if (!community) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await communitySupabase
                .from("chat_community_members")
                .select("*")
                .eq(
                    "community_id",
                    community.id
                );

        if (error) {
            throw error;
        }

        communityState.members =
            data || [];

        /*
         * Try to enrich member records with
         * student profiles.
         */

        const userIds =
            communityState.members
                .map(
                    member =>
                        member.user_id
                )
                .filter(Boolean);

        if (userIds.length) {

            try {

                const {
                    data: students
                } =
                    await communitySupabase
                        .from("students")
                        .select("*")
                        .in(
                            "id",
                            userIds
                        );

                if (students?.length) {

                    const profileMap =
                        new Map();

                    students.forEach(
                        student => {

                            profileMap.set(
                                String(student.id),
                                student
                            );

                        }
                    );

                    communityState.members =
                        communityState.members
                            .map(member => {

                                const profile =
                                    profileMap.get(
                                        String(
                                            member.user_id
                                        )
                                    );

                                return {
                                    ...member,

                                    ...(profile || {})
                                };

                            });

                }

            } catch (profileError) {

                console.warn(
                    "⚠️ Member profiles unavailable:",
                    profileError.message
                );

            }

        }

        renderMembers();

    } catch (error) {

        console.error(
            "❌ Member loading failed:",
            error
        );

        $("#memberList").innerHTML = `
            <div class="member-loading">
                Unable to load members.
            </div>
        `;

    }
}


/* =========================================================
   RENDER MEMBERS
========================================================= */

function renderMembers() {

    const container =
        $("#memberList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const search =
        communityState.memberSearchTerm
            .trim()
            .toLowerCase();

    const members =
        communityState.members
            .filter(member => {

                const name =
                    normalizeName(
                        member,
                        ""
                    ).toLowerCase();

                return !search ||
                    name.includes(search);

            })
            .sort(
                (a, b) => {

                    const aOnline =
                        isMemberOnline(
                            a.user_id
                        );

                    const bOnline =
                        isMemberOnline(
                            b.user_id
                        );

                    if (aOnline !== bOnline) {
                        return bOnline - aOnline;
                    }

                    return normalizeName(a)
                        .localeCompare(
                            normalizeName(b)
                        );

                }
            );

    const online =
        members.filter(
            member =>
                isMemberOnline(
                    member.user_id
                )
        );

    const offline =
        members.filter(
            member =>
                !isMemberOnline(
                    member.user_id
                )
        );

    renderMemberGroup(
        container,
        "Online",
        online
    );

    renderMemberGroup(
        container,
        "Offline",
        offline
    );

    updateOnlineCount(
        online.length
    );

}


function renderMemberGroup(
    container,
    title,
    members
) {

    if (!members.length) {
        return;
    }

    const heading =
        document.createElement("div");

    heading.className =
        "member-group-title";

    heading.textContent =
        `${title} — ${members.length}`;

    container.appendChild(
        heading
    );

    members.forEach(member => {

        const name =
            normalizeName(
                member,
                "Student"
            );

        const role =
            normalizeRole(
                member.role ||
                member.user_role ||
                "student"
            );

        const userId =
            member.user_id;

        const item =
            document.createElement("div");

        item.className =
            "member-item";

        const avatarWrapper =
            document.createElement("div");

        avatarWrapper.className =
            "member-avatar-wrapper";

        const avatar =
            document.createElement("div");

        avatar.className =
            "member-avatar";

        avatar.textContent =
            getInitials(name);

        const dot =
            document.createElement("span");

        dot.className =
            "presence-dot";

        if (
            isMemberOnline(userId)
        ) {
            dot.classList.add("online");
        }

        avatarWrapper.append(
            avatar,
            dot
        );

        const info =
            document.createElement("div");

        info.className =
            "member-info";

        info.innerHTML = `
            <span class="member-name">
                ${escapeHTML(name)}
            </span>

            <span class="member-role ${escapeHTML(role)}">
                ${escapeHTML(
                    displayRole(role)
                )}
            </span>
        `;

        item.append(
            avatarWrapper,
            info
        );

        container.appendChild(
            item
        );

    });

}


/* =========================================================
   PRESENCE
========================================================= */

function isMemberOnline(userId) {

    if (!userId) {
        return false;
    }

    const presence =
        communityState.presence[
            String(userId)
        ];

    if (!presence) {
        return false;
    }

    if (
        presence.status &&
        presence.status !== "online"
    ) {
        return false;
    }

    if (presence.last_seen) {

        const age =
            Date.now() -
            new Date(
                presence.last_seen
            ).getTime();

        if (
            Number.isFinite(age) &&
            age > 5 * 60 * 1000
        ) {
            return false;
        }

    }

    return true;
}


function updateOnlineCount(
    count
) {

    const element =
        $("#onlineMemberCount");

    if (element) {
        element.textContent =
            count;
    }
}


async function updateOwnPresence() {

    if (!communityState.user) {
        return;
    }

    try {

        const {
            data
        } =
            await communitySupabase
                .from("chat_presence")
                .select("*")
                .eq(
                    "user_id",
                    communityState.user.id
                )
                .maybeSingle();

        if (data) {

            communityState.presence[
                String(
                    communityState.user.id
                )
            ] = data;

            renderMembers();

            return;
        }

        await communitySupabase
            .from("chat_presence")
            .insert({
                user_id:
                    communityState.user.id,
                status: "online",
                last_seen:
                    new Date().toISOString()
            });

    } catch (error) {

        console.warn(
            "⚠️ Presence update:",
            error.message
        );

    }
}


/* =========================================================
   REALTIME COMMUNITY
========================================================= */

function unsubscribeCommunity() {

    if (
        communityState.subscriptions
            .length
    ) {

        communityState.subscriptions
            .forEach(
                subscription => {

                    try {

                        communitySupabase
                            .removeChannel(
                                subscription
                            );

                    } catch {}

                }
            );

    }

    communityState.subscriptions =
        [];
}


function subscribeToCommunity() {

    unsubscribeCommunity();

    const community =
        communityState.activeCommunity;

    if (!community) {
        return;
    }

    const channel =
        communitySupabase
            .channel(
                `community-${community.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_community_members",
                    filter:
                        `community_id=eq.${community.id}`
                },
                async () => {

                    await loadCommunityMembers();

                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_presence"
                },
                payload => {

                    updatePresenceFromPayload(
                        payload
                    );

                }
            )
            .subscribe();

    communityState.subscriptions
        .push(channel);

}


function updatePresenceFromPayload(
    payload
) {

    const record =
        payload.new ||
        payload.old;

    if (!record) {
        return;
    }

    const userId =
        record.user_id;

    if (!userId) {
        return;
    }

    communityState.presence[
        String(userId)
    ] = record;

    renderMembers();

}


/* =========================================================
   REALTIME CHANNEL
========================================================= */

function unsubscribeChannel() {

    if (
        communityState.channelSubscription
    ) {

        try {

            communitySupabase
                .removeChannel(
                    communityState
                        .channelSubscription
                );

        } catch {}

        communityState.channelSubscription =
            null;

    }

}


function subscribeToChannel() {

    unsubscribeChannel();

    const channel =
        communityState.activeChannel;

    if (!channel) {
        return;
    }

    const realtime =
        communitySupabase
            .channel(
                `chat-${channel.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channel.id}`
                },
                async payload => {

                    const exists =
                        communityState.messages
                            .some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload.new.id
                                    )
                            );

                    if (!exists) {

                        communityState.messages
                            .push(
                                payload.new
                            );

                        renderMessages();

                    }

                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channel.id}`
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
                    table: "chat_message_reactions"
                },
                async payload => {

                    const messageId =
                        payload.new?.message_id ||
                        payload.old?.message_id;

                    const belongs =
                        communityState.messages
                            .some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        messageId
                                    )
                            );

                    if (belongs) {
                        await loadChannelReactions();
                    }

                }
            )
            .subscribe();

    communityState.channelSubscription =
        realtime;

}


/* =========================================================
   READ STATUS
========================================================= */

async function markChannelRead() {

    const channel =
        communityState.activeChannel;

    const user =
        communityState.user;

    if (!channel || !user) {
        return;
    }

    try {

        const latest =
            communityState.messages
                .at(-1);

        const payload = {
            channel_id:
                channel.id,

            user_id:
                user.id,

            last_read_at:
                new Date().toISOString()
        };

        /*
         * message_id is added only when a latest
         * message is available. This is useful if
         * the Phase 1 schema contains it.
         */

        if (latest?.id) {
            payload.last_read_message_id =
                latest.id;
        }

        const {
            error
        } =
            await communitySupabase
                .from("chat_read_status")
                .upsert(
                    payload,
                    {
                        onConflict:
                            "channel_id,user_id"
                    }
                );

        if (error) {

            /*
             * Do not break chat if an older Phase 1
             * read-status schema differs.
             */

            console.warn(
                "⚠️ Read status:",
                error.message
            );

        }

    } catch (error) {

        console.warn(
            "⚠️ Read status update:",
            error.message
        );

    }
}


/* =========================================================
   PERMISSION UI
========================================================= */

function updatePermissionUI() {

    const createCommunity =
        $("#createCommunityRailButton");

    if (createCommunity) {

        createCommunity.hidden =
            !canCreateCommunity();

    }


    const settings =
        $("#communitySettingsButton");

    if (settings) {

        settings.hidden =
            !canManageCommunity();

    }


    const input =
        $("#messageInput");

    const send =
        $("#sendMessageButton");

    const notice =
        $("#composerPermissionNotice");

    const allowed =
        Boolean(
            communityState.activeChannel &&
            canSendMessages()
        );

    if (input) {
        input.disabled =
            !allowed;

        if (communityState.activeChannel) {

            input.placeholder =
                `Message #${
                    communityState
                        .activeChannel
                        .name ||
                    "channel"
                }`;

        }

    }

    if (send) {
        send.disabled =
            !allowed;
    }

    if (notice) {
        notice.hidden =
            allowed;

        if (!allowed) {

            notice.textContent =
                communityState.activeChannel
                    ? "You cannot send messages in this channel."
                    : "Select a channel to begin.";

        }

    }

    renderChannels();

}


/* =========================================================
   COMMUNITY CREATION
========================================================= */

function openCreateCommunity() {

    if (!canCreateCommunity()) {

        showToast(
            "You do not have permission to create communities.",
            "error"
        );

        return;
    }

    $("#communityNameInput").value = "";
    $("#communityDescriptionInput").value = "";
    $("#communityTypeInput").value = "general";
    $("#communityCourseInput").value = "";

    $("#communityCourseWrapper").hidden =
        true;

    openModal(
        "communityModal"
    );

}


async function createCommunity(
    event
) {

    event.preventDefault();

    if (!canCreateCommunity()) {

        showToast(
            "You do not have permission to create communities.",
            "error"
        );

        return;
    }

    const name =
        $("#communityNameInput")
            .value.trim();

    const description =
        $("#communityDescriptionInput")
            .value.trim();

    const type =
        $("#communityTypeInput")
            .value;

    const courseId =
        $("#communityCourseInput")
            .value || null;

    if (!name) {
        return;
    }

    try {

        /*
         * Core fields only.
         */

        const payload = {
            name,
            description
        };

        /*
         * Course-linked communities use course_id
         * where the schema supports it.
         */

        if (courseId) {
            payload.course_id =
                Number(courseId);
        }

        const {
            data,
            error
        } =
            await communitySupabase
                .from("chat_communities")
                .insert(payload)
                .select("*")
                .single();

        if (error) {
            throw error;
        }

        /*
         * Add creator as Super Admin/Admin depending
         * on their existing account authority.
         */

        const creatorRole =
            normalizeRole(
                communityState.activeRole
            );

        const memberRole =
            creatorRole === "super-admin"
                ? "super-admin"
                : "admin";

        const {
            error: memberError
        } =
            await communitySupabase
                .from("chat_community_members")
                .insert({
                    community_id:
                        data.id,

                    user_id:
                        communityState.user.id,

                    role:
                        memberRole
                });

        if (memberError) {

            console.warn(
                "⚠️ Community creator membership:",
                memberError.message
            );

        }

        /*
         * Automatically create a general channel.
         */

        const channelPayload = {
            community_id:
                data.id,

            name:
                "general-chat",

            description:
                "General community discussion",

            category:
                "Community",

            visibility:
                "public"
        };

        const {
            error: channelError
        } =
            await communitySupabase
                .from("chat_channels")
                .insert(channelPayload);

        if (channelError) {

            console.warn(
                "⚠️ Default channel creation:",
                channelError.message
            );

        }

        closeModal(
            "communityModal"
        );

        showToast(
            "Community created successfully.",
            "success"
        );

        await loadCommunities();

    } catch (error) {

        console.error(
            "❌ Community creation failed:",
            error
        );

        showToast(
            "Community could not be created.",
            "error"
        );

    }

}


/* =========================================================
   CHANNEL CREATION
========================================================= */

function openCreateChannel() {

    if (!canCreateChannel()) {

        showToast(
            "You do not have permission to create channels.",
            "error"
        );

        return;
    }

    if (!communityState.activeCommunity) {

        showToast(
            "Select a community first.",
            "error"
        );

        return;
    }

    $("#channelNameInput").value = "";
    $("#channelDescriptionInput").value = "";
    $("#channelCategoryInput").value = "General";
    $("#channelVisibilityInput").value = "public";
    $("#courseLinkedChannelCheckbox").checked =
        false;
    $("#channelCourseInput").value = "";

    $("#channelCourseWrapper").hidden =
        true;

    openModal(
        "channelModal"
    );

}


async function createChannel(
    event
) {

    event.preventDefault();

    if (!canCreateChannel()) {

        showToast(
            "You do not have permission to create channels.",
            "error"
        );

        return;
    }

    const community =
        communityState.activeCommunity;

    if (!community) {
        return;
    }

    const name =
        $("#channelNameInput")
            .value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");

    const description =
        $("#channelDescriptionInput")
            .value.trim();

    const category =
        $("#channelCategoryInput")
            .value;

    const visibility =
        $("#channelVisibilityInput")
            .value;

    const linked =
        $("#courseLinkedChannelCheckbox")
            .checked;

    const courseId =
        $("#channelCourseInput")
            .value || null;

    if (!name) {
        return;
    }

    try {

        const payload = {
            community_id:
                community.id,

            name,

            description,

            category,

            visibility
        };

        if (linked && courseId) {

            payload.course_id =
                Number(courseId);

        }

        const {
            error
        } =
            await communitySupabase
                .from("chat_channels")
                .insert(payload);

        if (error) {
            throw error;
        }

        closeModal(
            "channelModal"
        );

        showToast(
            "Channel created successfully.",
            "success"
        );

        await loadCommunityChannels();

    } catch (error) {

        console.error(
            "❌ Channel creation failed:",
            error
        );

        showToast(
            "Channel could not be created.",
            "error"
        );

    }

}


/* =========================================================
   COMMUNITY SETTINGS
========================================================= */

function openCommunitySettings() {

    if (!canManageCommunity()) {

        showToast(
            "You do not have permission to manage this community.",
            "error"
        );

        return;
    }

    updateCommunityHeader();

    openModal(
        "communitySettingsModal"
    );

}


async function saveCommunitySettings() {

    if (!canManageCommunity()) {

        showToast(
            "You do not have permission to update this community.",
            "error"
        );

        return;
    }

    const community =
        communityState.activeCommunity;

    if (!community) {
        return;
    }

    const name =
        $("#settingsCommunityNameInput")
            .value.trim();

    const description =
        $("#settingsCommunityDescriptionInput")
            .value.trim();

    if (!name) {
        return;
    }

    try {

        const {
            error
        } =
            await communitySupabase
                .from("chat_communities")
                .update({
                    name,
                    description
                })
                .eq(
                    "id",
                    community.id
                );

        if (error) {
            throw error;
        }

        community.name =
            name;

        community.title =
            name;

        community.description =
            description;

        updateCommunityHeader();

        renderCommunityRail();
        renderCommunitySwitcher();

        closeModal(
            "communitySettingsModal"
        );

        showToast(
            "Community settings saved.",
            "success"
        );

    } catch (error) {

        console.error(
            "❌ Community settings failed:",
            error
        );

        showToast(
            "Community settings could not be saved.",
            "error"
        );

    }

}


/* =========================================================
   COMPOSER
========================================================= */

function updateComposer() {

    const input =
        $("#messageInput");

    const send =
        $("#sendMessageButton");

    if (!communityState.activeChannel) {

        if (input) {
            input.disabled = true;
        }

        if (send) {
            send.disabled = true;
        }

        return;
    }

    const allowed =
        canSendMessages();

    if (input) {
        input.disabled =
            !allowed;
    }

    if (send) {
        send.disabled =
            !allowed;
    }

}


function resizeMessageInput() {

    const input =
        $("#messageInput");

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            130
        ) + "px";
}


function scrollMessagesToBottom() {

    const area =
        $("#messageArea");

    if (!area) {
        return;
    }

    requestAnimationFrame(
        () => {

            area.scrollTop =
                area.scrollHeight;

        }
    );

}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const channelSearch =
        $("#channelSearchInput");

    channelSearch?.addEventListener(
        "input",
        event => {

            communityState.channelSearchTerm =
                event.target.value;

            renderChannels();

        }
    );


    const memberSearch =
        $("#memberSearchInput");

    memberSearch?.addEventListener(
        "input",
        event => {

            communityState.memberSearchTerm =
                event.target.value;

            renderMembers();

        }
    );


    const messageSearch =
        $("#messageSearchInput");

    messageSearch?.addEventListener(
        "input",
        event => {

            communityState.messageSearchTerm =
                event.target.value;

            renderMessages();

        }
    );

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    $("#messageComposer")
        ?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                sendMessage();

            }
        );


    $("#messageInput")
        ?.addEventListener(
            "input",
            resizeMessageInput
        );


    $("#messageInput")
        ?.addEventListener(
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


    $("#cancelReplyButton")
        ?.addEventListener(
            "click",
            () => {

                communityState.activeReplyMessage =
                    null;

                $("#replyPreview").hidden =
                    true;

            }
        );


    $("#createCommunityRailButton")
        ?.addEventListener(
            "click",
            openCreateCommunity
        );


    $("#communitySettingsButton")
        ?.addEventListener(
            "click",
            openCommunitySettings
        );


    $("#saveCommunitySettingsButton")
        ?.addEventListener(
            "click",
            saveCommunitySettings
        );


    $("#openCreateChannelFromSettings")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    "communitySettingsModal"
                );

                openCreateChannel();

            }
        );


    $("#communityForm")
        ?.addEventListener(
            "submit",
            createCommunity
        );


    $("#channelForm")
        ?.addEventListener(
            "submit",
            createChannel
        );


    $("#communityTypeInput")
        ?.addEventListener(
            "change",
            event => {

                $("#communityCourseWrapper")
                    .hidden =
                    event.target.value !==
                    "course";

            }
        );


    $("#courseLinkedChannelCheckbox")
        ?.addEventListener(
            "change",
            event => {

                $("#channelCourseWrapper")
                    .hidden =
                    !event.target.checked;

            }
        );


    $("#communitySelectorButton")
        ?.addEventListener(
            "click",
            () => {

                const menu =
                    $("#communitySelectorMenu");

                menu.hidden =
                    !menu.hidden;

            }
        );


    $("#homeCommunityButton")
        ?.addEventListener(
            "click",
            () => {

                if (
                    communityState
                        .communities
                        .length
                ) {

                    selectCommunity(
                        communityState
                            .communities[0]
                            .id
                    );

                }

            }
        );


    $("#memberToggleButton")
        ?.addEventListener(
            "click",
            toggleMemberSidebar
        );


    $("#closeMemberSidebarButton")
        ?.addEventListener(
            "click",
            closeMemberSidebar
        );


    $("#mobileChannelButton")
        ?.addEventListener(
            "click",
            openMobileSidebar
        );


    $("#mobileOverlay")
        ?.addEventListener(
            "click",
            () => {

                closeMobileSidebar();
                closeMemberSidebar();

            }
        );


    $("#messageSearchButton")
        ?.addEventListener(
            "click",
            () => {

                const panel =
                    $("#messageSearchPanel");

                panel.hidden =
                    !panel.hidden;

                if (!panel.hidden) {
                    $("#messageSearchInput")
                        ?.focus();
                }

            }
        );


    document.addEventListener(
        "click",
        event => {

            const actionButton =
                event.target.closest(
                    "[data-action]"
                );

            if (actionButton) {

                handleMessageAction(
                    actionButton.dataset.action,
                    actionButton.dataset.messageId
                );

                return;
            }

            const closeModalButton =
                event.target.closest(
                    "[data-close-modal]"
                );

            if (closeModalButton) {

                closeModal(
                    closeModalButton.dataset.closeModal
                );

            }

        }
    );


    document.addEventListener(
        "click",
        event => {

            const selector =
                $("#communitySelectorMenu");

            const wrapper =
                $(".community-selector-wrapper");

            if (
                selector &&
                wrapper &&
                !wrapper.contains(event.target)
            ) {

                selector.hidden = true;

            }

        }
    );

}


/* =========================================================
   MOBILE
========================================================= */

function openMobileSidebar() {

    const sidebar =
        $(".channel-sidebar");

    const overlay =
        $("#mobileOverlay");

    sidebar?.classList.add("open");

    if (overlay) {
        overlay.hidden = false;
    }

}


function closeMobileSidebar() {

    const sidebar =
        $(".channel-sidebar");

    const overlay =
        $("#mobileOverlay");

    sidebar?.classList.remove("open");

    if (
        !$("#memberSidebar")
            ?.classList.contains("open")
    ) {

        if (overlay) {
            overlay.hidden = true;
        }

    }

}


function toggleMemberSidebar() {

    const sidebar =
        $("#memberSidebar");

    const overlay =
        $("#mobileOverlay");

    if (!sidebar) {
        return;
    }

    const open =
        sidebar.classList.toggle(
            "open"
        );

    if (overlay) {
        overlay.hidden =
            !open;
    }

}


function closeMemberSidebar() {

    const sidebar =
        $("#memberSidebar");

    const overlay =
        $("#mobileOverlay");

    sidebar?.classList.remove("open");

    if (
        !$(".channel-sidebar")
            ?.classList.contains("open")
    ) {

        if (overlay) {
            overlay.hidden = true;
        }

    }

}


/* =========================================================
   AUTH STATE
========================================================= */

function setupAuthListener() {

    if (!communitySupabase) {
        return;
    }

    communitySupabase.auth
        .onAuthStateChange(
            async (
                event,
                session
            ) => {

                if (
                    event ===
                        "SIGNED_OUT" ||
                    !session?.user
                ) {

                    window.location.href =
                        "index.html";

                    return;
                }

            }
        );

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        unsubscribeChannel();
        unsubscribeCommunity();

    }
);


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeCommunity() {

    console.log(
        "🚀 Initializing Mwaniki Community Phase 3..."
    );

    try {

        if (!communitySupabase) {
            throw new Error(
                "Supabase client unavailable."
            );
        }

        await loadAuthenticatedUser();

        if (!communityState.user) {
            return;
        }

        await loadCurrentProfile();

        await loadCourses();

        await loadCommunities();

        await updateOwnPresence();

        setupEvents();

        setupSearch();

        setupAuthListener();

        /*
         * Keep presence fresh while the page remains open.
         */

        setInterval(
            updateOwnPresence,
            60 * 1000
        );

        console.log(
            "✅ Mwaniki Community Phase 3 ready."
        );

    } catch (error) {

        console.error(
            "❌ Mwaniki Community initialization failed:",
            error
        );

        showToast(
            "Community could not be initialized.",
            "error"
        );

    }

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCommunity
    );

} else {

    initializeCommunity();

}
