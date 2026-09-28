import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI COMMUNITY
   PHASE 3 COMMUNITY ENGINE

   Features:
   - Multiple communities
   - Community switching
   - Course-linked communities
   - Channel categories
   - Public/private channels
   - Role permissions
   - Realtime messages
   - Reactions
   - Presence
   - Notifications
========================================================= */

console.log(
    "🚀 Mwaniki Community Phase 3 engine loaded."
);


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let currentStudent = null;

let allCourses = [];

let communities = [];

let channels = [];

let members = [];

let messages = [];

let notifications = [];

let currentCommunity = null;

let currentChannel = null;

let currentRole = "student";

let currentReplyMessage = null;

let currentAttachments = [];

let realtimeMessageChannel = null;

let realtimePresenceChannel = null;

let realtimeReactionChannel = null;

let initializationComplete = false;


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) =>
    document.getElementById(id);


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


function normalizeRole(role) {

    const value =
        String(
            role || "student"
        )
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, "");

    if (
        value === "superadmin" ||
        value === "owner" ||
        value === "superadministrator"
    ) {

        return "super_admin";

    }

    if (
        value === "administrator" ||
        value === "admin"
    ) {

        return "admin";

    }

    if (
        value === "moderator" ||
        value === "mod"
    ) {

        return "moderator";

    }

    if (
        value === "tutor" ||
        value === "teacher"
    ) {

        return "tutor";

    }

    return "student";

}


function roleLabel(role) {

    const normalized =
        normalizeRole(role);

    const labels = {

        super_admin:
            "Super Admin",

        admin:
            "Admin",

        moderator:
            "Moderator",

        tutor:
            "Tutor",

        student:
            "Student"

    };

    return (
        labels[normalized] ||
        "Student"
    );

}


function getUserName() {

    return (

        currentStudent?.full_name ||

        currentStudent?.name ||

        currentUser?.user_metadata?.full_name ||

        currentUser?.user_metadata?.name ||

        currentUser?.email ||

        "Student"

    );

}


function getInitials(name) {

    const clean =
        String(
            name || "Student"
        )
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    if (!clean) {

        return "S";

    }

    const parts =
        clean.split(" ");

    if (parts.length === 1) {

        return parts[0]
            .slice(0, 2)
            .toUpperCase();

    }

    return (

        parts[0]
            .charAt(0) +

        parts[
            parts.length - 1
        ].charAt(0)

    ).toUpperCase();

}


function getField(object, fields, fallback = null) {

    if (!object) {

        return fallback;

    }

    for (
        const field of fields
    ) {

        if (
            object[field] !== undefined &&
            object[field] !== null
        ) {

            return object[field];

        }

    }

    return fallback;

}


function getId(object) {

    return getField(
        object,
        [
            "id",
            "user_id",
            "member_id"
        ]
    );

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info"
) {

    const toast =
        $("communityToast");

    if (!toast) {

        return;

    }

    toast.textContent =
        message;

    toast.className =
        "community-toast";

    if (
        type === "error"
    ) {

        toast.classList.add(
            "error"
        );

    }

    if (
        type === "success"
    ) {

        toast.classList.add(
            "success"
        );

    }

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

            },
            3500
        );

}


/* =========================================================
   LOADING
========================================================= */

function showLoading() {

    const overlay =
        $("communityLoadingOverlay");

    if (overlay) {

        overlay.classList.remove(
            "hidden"
        );

    }

}


function hideLoading() {

    const overlay =
        $("communityLoadingOverlay");

    if (overlay) {

        overlay.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   PERMISSIONS
========================================================= */

const ROLE_LEVEL = {

    student: 1,

    tutor: 2,

    moderator: 3,

    admin: 4,

    super_admin: 5

};


function hasRole(
    requiredRole
) {

    return (
        (ROLE_LEVEL[currentRole] || 1) >=
        (ROLE_LEVEL[requiredRole] || 1)
    );

}


function canCreateCommunity() {

    return (
        currentRole === "admin" ||
        currentRole === "super_admin"
    );

}


function canCreateChannel() {

    return (
        currentRole === "tutor" ||
        currentRole === "moderator" ||
        currentRole === "admin" ||
        currentRole === "super_admin"
    );

}


function canManageCommunity() {

    return (
        currentRole === "admin" ||
        currentRole === "super_admin"
    );

}


function canModerate() {

    return (
        currentRole === "moderator" ||
        currentRole === "admin" ||
        currentRole === "super_admin"
    );

}


function canSendMessages() {

    if (!currentChannel) {

        return false;

    }

    if (
        currentChannel.is_private === true ||
        currentChannel.visibility === "private"
    ) {

        return userCanAccessCurrentChannel();

    }

    return true;

}


/* =========================================================
   USER / AUTH
========================================================= */

async function loadAuthenticatedUser() {

    const {
        data,
        error
    } =
        await supabase.auth.getUser();

    if (error) {

        console.error(
            "❌ Unable to get user:",
            error
        );

        return null;

    }

    currentUser =
        data?.user || null;

    return currentUser;

}


async function loadStudentProfile() {

    if (!currentUser) {

        return;

    }

    try {

        const {
            data,
            error
        } =
            await supabase

                .from("students")

                .select("*")

                .eq(
                    "id",
                    currentUser.id
                )

                .maybeSingle();

        if (!error) {

            currentStudent =
                data || null;

        }

    } catch (error) {

        console.warn(
            "⚠️ Student profile unavailable:",
            error
        );

    }

}


function updateIdentityUI() {

    const name =
        getUserName();

    const initials =
        getInitials(name);

    const role =
        roleLabel(
            currentRole
        );

    const email =
        currentUser?.email ||
        "—";


    [
        "topProfileAvatar",
        "sidebarProfileAvatar",
        "profileMenuAvatar"
    ]
        .forEach(id => {

            const element =
                $(id);

            if (!element) {

                return;

            }

            const photo =
                getField(
                    currentStudent,
                    [
                        "photo_url",
                        "avatar_url",
                        "profile_image"
                    ]
                );

            if (photo) {

                element.innerHTML =
                    `
                    <img
                        src="${escapeHTML(photo)}"
                        alt="${escapeHTML(name)}"
                    >
                    `;

            } else {

                element.textContent =
                    initials;

            }

        });


    const topName =
        $("topProfileName");

    if (topName) {

        topName.textContent =
            name;

    }


    const sidebarName =
        $("sidebarProfileName");

    if (sidebarName) {

        sidebarName.textContent =
            name;

    }


    const sidebarRole =
        $("sidebarProfileRole");

    if (sidebarRole) {

        sidebarRole.textContent =
            role;

    }


    const profileName =
        $("profileMenuName");

    if (profileName) {

        profileName.textContent =
            name;

    }


    const profileEmail =
        $("profileMenuEmail");

    if (profileEmail) {

        profileEmail.textContent =
            email;

    }

}


/* =========================================================
   COURSES
========================================================= */

async function loadCourses() {

    try {

        const {
            data,
            error
        } =
            await supabase

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
                "⚠️ Courses could not be loaded:",
                error
            );

            allCourses = [];

            return;

        }

        allCourses =
            Array.isArray(data)
                ? data
                : [];

    } catch (error) {

        console.error(
            "❌ Course loading error:",
            error
        );

        allCourses = [];

    }

}


/* =========================================================
   COMMUNITIES
========================================================= */

async function loadCommunities() {

    if (!currentUser) {

        return;

    }

    try {

        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_communities"
                )

                .select("*")

                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.error(
                "❌ Community loading error:",
                error
            );

            showToast(
                "Unable to load communities.",
                "error"
            );

            communities = [];

            return;

        }


        let rawCommunities =
            Array.isArray(data)
                ? data
                : [];


        /*
         * If the table contains member restrictions,
         * filter through community membership.
         */

        const {
            data: memberships,
            error: membershipError
        } =
            await supabase

                .from(
                    "chat_community_members"
                )

                .select("*")

                .eq(
                    "user_id",
                    currentUser.id
                );


        if (
            !membershipError &&
            Array.isArray(memberships) &&
            memberships.length
        ) {

            const memberIds =
                new Set(
                    memberships.map(
                        item =>
                            String(
                                getField(
                                    item,
                                    [
                                        "community_id"
                                    ]
                                )
                            )
                    )
                );


            /*
             * Communities may expose a public flag.
             * Public communities remain visible.
             */

            rawCommunities =
                rawCommunities.filter(
                    community => {

                        const id =
                            String(
                                getId(
                                    community
                                )
                            );

                        const isPublic =
                            getField(
                                community,
                                [
                                    "is_public",
                                    "public"
                                ],
                                true
                            );

                        return (
                            memberIds.has(id) ||
                            isPublic !== false
                        );

                    }
                );

        }


        communities =
            rawCommunities.map(
                normalizeCommunity
            );


    } catch (error) {

        console.error(
            "❌ Community loading failed:",
            error
        );

        communities = [];

    }


    renderCommunityRail();

}


/* =========================================================
   NORMALIZE COMMUNITY
========================================================= */

function normalizeCommunity(
    community
) {

    const courseId =
        getField(
            community,
            [
                "course_id",
                "linked_course_id"
            ]
        );

    const course =
        allCourses.find(
            item =>
                String(
                    item.id
                ) ===
                String(courseId)
        );


    return {

        ...community,

        id:
            getId(
                community
            ),

        name:
            getField(
                community,
                [
                    "name",
                    "title"
                ],
                "Community"
            ),

        description:
            getField(
                community,
                [
                    "description"
                ],
                ""
            ),

        course_id:
            courseId,

        course:
            course || null,

        owner_id:
            getField(
                community,
                [
                    "owner_id",
                    "created_by",
                    "created_by_user_id"
                ]
            )

    };

}


/* =========================================================
   RENDER COMMUNITY RAIL
========================================================= */

function renderCommunityRail() {

    const list =
        $("communityList");

    if (!list) {

        return;

    }


    if (!communities.length) {

        list.innerHTML =
            `
            <div class="rail-loading">
                No communities
            </div>
            `;

    } else {

        list.innerHTML =
            communities
                .map(
                    community => {

                        const active =
                            currentCommunity &&
                            String(
                                currentCommunity.id
                            ) ===
                            String(
                                community.id
                            );

                        const initial =
                            getInitials(
                                community.name
                            ).slice(
                                0,
                                2
                            );

                        const courseMarker =
                            community.course_id
                                ? `<span class="community-course-dot"></span>`
                                : "";

                        return `
                            <button
                                type="button"
                                class="community-rail-item ${active ? "active" : ""}"
                                data-community-id="${escapeHTML(community.id)}"
                                title="${escapeHTML(community.name)}"
                            >
                                ${escapeHTML(initial)}
                                ${courseMarker}
                            </button>
                        `;

                    }
                )
                .join("");

    }


    list
        .querySelectorAll(
            "[data-community-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const id =
                        button.dataset.communityId;

                    await switchCommunity(
                        id
                    );

                }
            );

        });


    const createButton =
        $("createCommunityButton");

    if (createButton) {

        createButton.classList.toggle(
            "hidden",
            !canCreateCommunity()
        );

    }

}


/* =========================================================
   COMMUNITY SWITCHING
========================================================= */

async function switchCommunity(
    communityId
) {

    const community =
        communities.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    communityId
                )
        );

    if (!community) {

        return;

    }


    currentCommunity =
        community;

    currentChannel =
        null;

    messages = [];

    renderCommunityRail();

    renderActiveCommunity();

    await loadChannels();

    if (channels.length) {

        await switchChannel(
            channels[0].id
        );

    } else {

        renderEmptyChannelState();

    }

}


/* =========================================================
   ACTIVE COMMUNITY
========================================================= */

function renderActiveCommunity() {

    if (!currentCommunity) {

        return;

    }

    const name =
        $("activeCommunityName");

    if (name) {

        name.textContent =
            currentCommunity.name;

    }


    const description =
        $("activeCommunityDescription");

    if (description) {

        description.textContent =
            currentCommunity.course
                ? currentCommunity.course.title
                : (
                    currentCommunity.description ||
                    "Community discussion"
                );

    }


    const icon =
        $("activeCommunityIcon");

    if (icon) {

        icon.textContent =
            getInitials(
                currentCommunity.name
            ).slice(
                0,
                2
            );

    }


    const manage =
        $("manageCommunityButton");

    if (manage) {

        manage.classList.toggle(
            "hidden",
            !canManageCommunity()
        );

    }


    const createChannel =
        $("createChannelButton");

    if (createChannel) {

        createChannel.classList.toggle(
            "hidden",
            !canCreateChannel()
        );

    }

}


/* =========================================================
   CHANNELS
========================================================= */

async function loadChannels() {

    if (!currentCommunity) {

        channels = [];

        renderChannels();

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

            .select("*")

            .eq(
                "community_id",
                currentCommunity.id
            )

            .order(
                "position",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "❌ Channel loading error:",
            error
        );

        /*
         * Some existing Phase 2 schemas may not contain
         * position. Retry without it.
         */

        const retry =
            await supabase

                .from(
                    "chat_channels"
                )

                .select("*")

                .eq(
                    "community_id",
                    currentCommunity.id
                )

                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );


        if (retry.error) {

            console.error(
                "❌ Channel retry failed:",
                retry.error
            );

            channels = [];

            renderChannels();

            return;

        }

        channels =
            normalizeChannels(
                retry.data
            );

    } else {

        channels =
            normalizeChannels(
                data
            );

    }


    /*
     * Filter private channels according to membership.
     */

    await filterPrivateChannels();

    renderChannels();

}


/* =========================================================
   NORMALIZE CHANNELS
========================================================= */

function normalizeChannels(
    rows
) {

    return (
        Array.isArray(rows)
            ? rows
            : []
    )
        .map(
            channel => {

                const visibility =
                    String(
                        getField(
                            channel,
                            [
                                "visibility",
                                "channel_visibility"
                            ],
                            ""
                        )
                    )
                        .toLowerCase();


                const isPrivate =
                    getField(
                        channel,
                        [
                            "is_private"
                        ],
                        visibility === "private"
                    ) === true ||
                    visibility === "private";


                return {

                    ...channel,

                    id:
                        getId(
                            channel
                        ),

                    community_id:
                        getField(
                            channel,
                            [
                                "community_id"
                            ]
                        ),

                    name:
                        getField(
                            channel,
                            [
                                "name",
                                "title"
                            ],
                            "channel"
                        ),

                    description:
                        getField(
                            channel,
                            [
                                "description"
                            ],
                            ""
                        ),

                    category:
                        getField(
                            channel,
                            [
                                "category",
                                "category_name",
                                "channel_category"
                            ],
                            "General"
                        ) ||
                        "General",

                    is_private:
                        isPrivate,

                    visibility:
                        isPrivate
                            ? "private"
                            : "public",

                    course_id:
                        getField(
                            channel,
                            [
                                "course_id",
                                "linked_course_id"
                            ]
                        ),

                    position:
                        Number(
                            getField(
                                channel,
                                [
                                    "position",
                                    "sort_order"
                                ],
                                0
                            )
                        )

                };

            }
        );

}


/* =========================================================
   PRIVATE CHANNEL FILTER
========================================================= */

async function filterPrivateChannels() {

    if (!currentUser) {

        return;

    }


    const privateChannels =
        channels.filter(
            channel =>
                channel.is_private
        );


    if (!privateChannels.length) {

        return;

    }


    const ids =
        privateChannels.map(
            channel =>
                channel.id
        );


    const {
        data,
        error
    } =
        await supabase

            .from(
                "chat_channel_members"
            )

            .select("*")

            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.warn(
            "⚠️ Could not check private channel membership:",
            error
        );

        /*
         * Keep private channels visible to privileged
         * users. Students without a membership are removed.
         */

        if (
            !canModerate()
        ) {

            channels =
                channels.filter(
                    channel =>
                        !channel.is_private
                );

        }

        return;

    }


    const memberships =
        Array.isArray(data)
            ? data
            : [];


    const memberChannelIds =
        new Set(
            memberships.map(
                item =>
                    String(
                        getField(
                            item,
                            [
                                "channel_id"
                            ]
                        )
                    )
            )
        );


    channels =
        channels.filter(
            channel => {

                if (
                    !channel.is_private
                ) {

                    return true;

                }

                if (
                    canModerate()
                ) {

                    return true;

                }

                return memberChannelIds.has(
                    String(
                        channel.id
                    )
                );

            }
        );

}


/* =========================================================
   CHANNEL ACCESS
========================================================= */

function userCanAccessCurrentChannel() {

    if (!currentChannel) {

        return false;

    }

    if (
        !currentChannel.is_private
    ) {

        return true;

    }

    if (
        canModerate()
    ) {

        return true;

    }


    return true;

}


/* =========================================================
   RENDER CHANNELS
========================================================= */

function renderChannels() {

    const list =
        $("channelList");

    if (!list) {

        return;

    }


    if (!channels.length) {

        list.innerHTML =
            `
            <div class="sidebar-loading">
                No channels yet.
            </div>
            `;

        return;

    }


    const grouped =
        {};


    channels
        .forEach(
            channel => {

                const category =
                    channel.category ||
                    "General";

                if (
                    !grouped[category]
                ) {

                    grouped[category] =
                        [];

                }

                grouped[category]
                    .push(channel);

            }
        );


    const categoryNames =
        Object.keys(
            grouped
        );


    list.innerHTML =
        categoryNames
            .map(
                category => {

                    const categoryChannels =
                        grouped[category];

                    return `
                        <section
                            class="channel-category"
                            data-category="${escapeHTML(category)}"
                        >

                            <button
                                type="button"
                                class="channel-category-header"
                            >

                                <span class="category-chevron">
                                    ▾
                                </span>

                                <span>
                                    ${escapeHTML(category)}
                                </span>

                            </button>

                            <div class="category-channel-list">

                                ${categoryChannels
                                    .map(
                                        renderChannelItem
                                    )
                                    .join("")}

                            </div>

                        </section>
                    `;

                }
            )
            .join("");


    list
        .querySelectorAll(
            ".channel-category-header"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const category =
                            button
                                .closest(
                                    ".channel-category"
                                );

                        const area =
                            category
                                ?.querySelector(
                                    ".category-channel-list"
                                );

                        if (!area) {

                            return;

                        }

                        const hidden =
                            area.style.display ===
                            "none";

                        area.style.display =
                            hidden
                                ? ""
                                : "none";

                        const arrow =
                            button
                                .querySelector(
                                    ".category-chevron"
                                );

                        if (arrow) {

                            arrow.textContent =
                                hidden
                                    ? "▾"
                                    : "▸";

                        }

                    }
                );

            }
        );


    list
        .querySelectorAll(
            "[data-channel-id]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await switchChannel(
                            button.dataset.channelId
                        );

                    }
                );

            }
        );

}


/* =========================================================
   CHANNEL ITEM
========================================================= */

function renderChannelItem(
    channel
) {

    const active =
        currentChannel &&
        String(
            currentChannel.id
        ) ===
        String(
            channel.id
        );


    const privateIcon =
        channel.is_private
            ? `<span class="private-icon">🔒</span>`
            : "";


    const courseMarker =
        channel.course_id
            ? `<span class="course-channel-marker"></span>`
            : "";


    return `
        <button
            type="button"
            class="channel-item ${active ? "active" : ""}"
            data-channel-id="${escapeHTML(channel.id)}"
        >

            <span class="channel-item-icon">
                ${channel.is_private ? "🔒" : "#"}
            </span>

            <span class="channel-item-name">
                ${escapeHTML(channel.name)}
            </span>

            ${courseMarker}

            ${privateIcon}

        </button>
    `;

}


/* =========================================================
   SWITCH CHANNEL
========================================================= */

async function switchChannel(
    channelId
) {

    const channel =
        channels.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    channelId
                )
        );

    if (!channel) {

        return;

    }


    currentChannel =
        channel;

    renderChannels();

    renderActiveChannel();

    await loadMembers();

    await loadMessages();

    await markChannelRead();

    subscribeToRealtime();

}


/* =========================================================
   ACTIVE CHANNEL
========================================================= */

function renderActiveChannel() {

    if (!currentChannel) {

        return;

    }


    const name =
        $("activeChannelName");

    if (name) {

        name.textContent =
            currentChannel.name;

    }


    const description =
        $("activeChannelDescription");

    if (description) {

        description.textContent =
            currentChannel.description ||
            "Community discussion";

    }


    const visibility =
        $("activeChannelVisibility");

    if (visibility) {

        visibility.textContent =
            currentChannel.is_private
                ? "Private"
                : "Public";

        visibility.classList.toggle(
            "private",
            currentChannel.is_private
        );

    }


    const input =
        $("messageInput");

    if (input) {

        input.placeholder =
            `Message #${currentChannel.name}`;

    }


    const canSend =
        canSendMessages();


    const composer =
        $("messageComposer");

    if (composer) {

        composer.classList.toggle(
            "hidden",
            !canSend
        );

    }


    const notice =
        $("composerNotice");

    if (notice) {

        notice.classList.toggle(
            "hidden",
            canSend
        );

        notice.textContent =
            currentChannel.is_private
                ? "You do not have permission to send messages in this private channel."
                : "You cannot send messages in this channel.";

    }


    const reply =
        $("replyPreview");

    if (reply) {

        reply.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   MESSAGES
========================================================= */

async function loadMessages() {

    const area =
        $("messageArea");

    if (!area) {

        return;

    }


    if (!currentChannel) {

        renderEmptyChannelState();

        return;

    }


    area.innerHTML =
        `
        <div class="chat-loading">

            <div class="loading-spinner"></div>

            <p>
                Loading messages...
            </p>

        </div>
        `;


    const {
        data,
        error
    } =
        await supabase

            .from(
                "chat_messages"
            )

            .select("*")

            .eq(
                "channel_id",
                currentChannel.id
            )

            .order(
                "created_at",
                {
                    ascending: true
                }
            )

            .limit(
                200
            );


    if (error) {

        console.error(
            "❌ Message loading error:",
            error
        );

        area.innerHTML =
            `
            <div class="empty-state">
                Unable to load messages.<br>
                ${escapeHTML(error.message)}
            </div>
            `;

        return;

    }


    messages =
        Array.isArray(data)
            ? data
            : [];


    renderMessages();

}


/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    const area =
        $("messageArea");

    if (!area) {

        return;

    }


    if (!messages.length) {

        area.innerHTML =
            `
            <div class="empty-state">

                <div>

                    <strong>
                        Welcome to #${escapeHTML(
                            currentChannel?.name ||
                            "channel"
                        )}
                    </strong>

                    <p>
                        This is the beginning of the conversation.
                    </p>

                </div>

            </div>
            `;

        return;

    }


    area.innerHTML =
        messages
            .map(
                renderMessage
            )
            .join("");


    area
        .querySelectorAll(
            "[data-reply-message]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const message =
                            messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.replyMessage
                                    )
                            );

                        if (message) {

                            startReply(
                                message
                            );

                        }

                    }
                );

            }
        );


    area
        .querySelectorAll(
            "[data-react-message]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await toggleReaction(
                            button.dataset.reactMessage,
                            button.dataset.reaction
                        );

                    }
                );

            }
        );


    area
        .querySelectorAll(
            "[data-delete-message]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await deleteMessage(
                            button.dataset.deleteMessage
                        );

                    }

                );

            }
        );


    requestAnimationFrame(
        () => {

            area.scrollTop =
                area.scrollHeight;

        }
    );

}


/* =========================================================
   RENDER SINGLE MESSAGE
========================================================= */

function renderMessage(
    message
) {

    const senderId =
        getField(
            message,
            [
                "sender_id",
                "user_id",
                "author_id"
            ]
        );


    const sender =
        members.find(
            member =>
                String(
                    getField(
                        member,
                        [
                            "user_id",
                            "member_id",
                            "id"
                        ]
                    )
                ) ===
                String(senderId)
        );


    const senderName =
        getField(
            sender,
            [
                "full_name",
                "name",
                "display_name",
                "username"
            ],
            senderId === currentUser?.id
                ? getUserName()
                : "Community Member"
        );


    const content =
        getField(
            message,
            [
                "content",
                "message",
                "text"
            ],
            ""
        );


    const createdAt =
        getField(
            message,
            [
                "created_at"
            ],
            new Date().toISOString()
        );


    const role =
        normalizeRole(
            getField(
                sender,
                [
                    "role"
                ],
                "student"
            )
        );


    const avatar =
        getInitials(
            senderName
        );


    const isMine =
        String(senderId) ===
        String(currentUser?.id);


    const canDelete =
        isMine ||
        canModerate();


    return `
        <article
            class="message-group"
            data-message-id="${escapeHTML(message.id)}"
        >

            <div
                class="avatar message-avatar"
            >
                ${escapeHTML(avatar)}
            </div>


            <div class="message-content">

                <div class="message-meta">

                    <span class="message-author">
                        ${escapeHTML(senderName)}
                    </span>

                    ${
                        role !== "student"
                            ? `
                                <span class="message-role">
                                    ${escapeHTML(
                                        roleLabel(role)
                                    )}
                                </span>
                            `
                            : ""
                    }

                    <time class="message-time">
                        ${formatDateTime(createdAt)}
                    </time>

                </div>


                <div class="message-text">
                    ${escapeHTML(content)}
                </div>


                <div class="message-actions">

                    <button
                        type="button"
                        class="message-action"
                        data-react-message="${escapeHTML(message.id)}"
                        data-reaction="👍"
                    >
                        👍
                    </button>

                    <button
                        type="button"
                        class="message-action"
                        data-react-message="${escapeHTML(message.id)}"
                        data-reaction="❤️"
                    >
                        ❤️
                    </button>

                    <button
                        type="button"
                        class="message-action"
                        data-react-message="${escapeHTML(message.id)}"
                        data-reaction="💡"
                    >
                        💡
                    </button>

                    <button
                        type="button"
                        class="message-action"
                        data-reply-message="${escapeHTML(message.id)}"
                    >
                        Reply
                    </button>

                    ${
                        canDelete
                            ? `
                                <button
                                    type="button"
                                    class="message-action"
                                    data-delete-message="${escapeHTML(message.id)}"
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


/* =========================================================
   DATE
========================================================= */

function formatDateTime(
    date
) {

    try {

        return new Date(
            date
        ).toLocaleString(
            "en-KE",
            {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch {

        return "";

    }

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (!currentUser) {

        showToast(
            "Please sign in first.",
            "error"
        );

        return;

    }


    if (!currentChannel) {

        return;

    }


    if (!canSendMessages()) {

        showToast(
            "You do not have permission to send messages here.",
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


    if (!content) {

        return;

    }


    const sendButton =
        $("sendMessageButton");

    if (sendButton) {

        sendButton.disabled =
            true;

    }


    const payload = {

        channel_id:
            currentChannel.id,

        sender_id:
            currentUser.id,

        content:
            content

    };


    if (
        currentReplyMessage
    ) {

        /*
         * parent_message_id is only added when it is
         * already supported by the table. If the schema
         * does not have it, retry without it below.
         */

        payload.parent_message_id =
            currentReplyMessage.id;

    }


    let result =
        await supabase

            .from(
                "chat_messages"
            )

            .insert(
                payload
            )
            .select()
            .single();


    /*
     * Retry if parent_message_id does not exist.
     */

    if (
        result.error &&
        currentReplyMessage
    ) {

        const fallbackPayload = {

            channel_id:
                currentChannel.id,

            sender_id:
                currentUser.id,

            content:
                content

        };


        result =
            await supabase

                .from(
                    "chat_messages"
                )

                .insert(
                    fallbackPayload
                )
                .select()
                .single();

    }


    if (result.error) {

        console.error(
            "❌ Send message error:",
            result.error
        );

        showToast(
            `Message failed: ${result.error.message}`,
            "error"
        );

        if (sendButton) {

            sendButton.disabled =
                false;

        }

        return;

    }


    input.value = "";

    input.style.height =
        "auto";

    currentReplyMessage =
        null;

    renderReplyPreview();

    if (result.data) {

        const exists =
            messages.some(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        result.data.id
                    )
            );

        if (!exists) {

            messages.push(
                result.data
            );

            renderMessages();

        }

    }


    if (sendButton) {

        sendButton.disabled =
            false;

    }


    await markChannelRead();

}


/* =========================================================
   REPLY
========================================================= */

function startReply(
    message
) {

    currentReplyMessage =
        message;

    renderReplyPreview();

    $("messageInput")?.focus();

}


function renderReplyPreview() {

    const preview =
        $("replyPreview");

    const text =
        $("replyPreviewText");

    if (!preview) {

        return;

    }


    if (!currentReplyMessage) {

        preview.classList.add(
            "hidden"
        );

        return;

    }


    preview.classList.remove(
        "hidden"
    );


    if (text) {

        const content =
            getField(
                currentReplyMessage,
                [
                    "content",
                    "message",
                    "text"
                ],
                ""
            );

        text.textContent =
            content.slice(
                0,
                90
            );

    }

}


/* =========================================================
   DELETE MESSAGE
========================================================= */

async function deleteMessage(
    messageId
) {

    const message =
        messages.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    messageId
                )
        );

    if (!message) {

        return;

    }


    const senderId =
        getField(
            message,
            [
                "sender_id",
                "user_id"
            ]
        );


    if (
        String(senderId) !==
            String(currentUser?.id) &&
        !canModerate()
    ) {

        showToast(
            "You do not have permission to delete this message.",
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


    const {
        error
    } =
        await supabase

            .from(
                "chat_messages"
            )

            .delete()

            .eq(
                "id",
                messageId
            );


    if (error) {

        console.error(
            "❌ Delete message error:",
            error
        );

        showToast(
            error.message,
            "error"
        );

        return;

    }


    messages =
        messages.filter(
            item =>
                String(
                    item.id
                ) !==
                String(
                    messageId
                )
        );


    renderMessages();

    showToast(
        "Message deleted.",
        "success"
    );

}


/* =========================================================
   REACTIONS
========================================================= */

async function toggleReaction(
    messageId,
    reaction
) {

    if (!currentUser) {

        return;

    }


    const {
        data: existing,
        error: findError
    } =
        await supabase

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
                currentUser.id
            );


    if (findError) {

        console.warn(
            "⚠️ Reaction lookup failed:",
            findError
        );

    }


    const found =
        Array.isArray(existing)
            ? existing.find(
                item =>
                    String(
                        getField(
                            item,
                            [
                                "reaction",
                                "emoji"
                            ]
                        )
                    ) ===
                    String(
                        reaction
                    )
            )
            : null;


    if (found) {

        const {
            error
        } =
            await supabase

                .from(
                    "chat_message_reactions"
                )

                .delete()

                .eq(
                    "id",
                    found.id
                );


        if (error) {

            showToast(
                error.message,
                "error"
            );

            return;

        }

    } else {

        const payload = {

            message_id:
                messageId,

            user_id:
                currentUser.id,

            reaction:
                reaction

        };


        const {
            error
        } =
            await supabase

                .from(
                    "chat_message_reactions"
                )

                .insert(
                    payload
                );


        if (error) {

            /*
             * Some schemas call the column emoji.
             */

            const fallback =
                await supabase

                    .from(
                        "chat_message_reactions"
                    )

                    .insert(
                        {
                            message_id:
                                messageId,

                            user_id:
                                currentUser.id,

                            emoji:
                                reaction
                        }
                    );


            if (fallback.error) {

                console.error(
                    "❌ Reaction error:",
                    error
                );

                showToast(
                    error.message,
                    "error"
                );

                return;

            }

        }

    }


    await loadMessages();

}


/* =========================================================
   MEMBERS
========================================================= */

async function loadMembers() {

    if (!currentCommunity) {

        members = [];

        renderMembers();

        return;

    }


    /*
     * First load community members.
     */

    const {
        data,
        error
    } =
        await supabase

            .from(
                "chat_community_members"
            )

            .select("*")

            .eq(
                "community_id",
                currentCommunity.id
            );


    if (error) {

        console.error(
            "❌ Member loading error:",
            error
        );

        members = [];

        renderMembers();

        return;

    }


    const rawMembers =
        Array.isArray(data)
            ? data
            : [];


    /*
     * Enrich members with student profile data where
     * possible.
     */

    const userIds =
        rawMembers
            .map(
                item =>
                    getField(
                        item,
                        [
                            "user_id",
                            "member_id"
                        ]
                    )
            )
            .filter(Boolean);


    let students =
        [];


    if (userIds.length) {

        const result =
            await supabase

                .from(
                    "students"
                )

                .select("*")

                .in(
                    "id",
                    userIds
                );


        if (!result.error) {

            students =
                Array.isArray(
                    result.data
                )
                    ? result.data
                    : [];

        }

    }


    members =
        rawMembers.map(
            member => {

                const userId =
                    getField(
                        member,
                        [
                            "user_id",
                            "member_id"
                        ]
                    );


                const student =
                    students.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(userId)
                    );


                return {

                    ...member,

                    user_id:
                        userId,

                    full_name:
                        getField(
                            student,
                            [
                                "full_name",
                                "name"
                            ],
                            getField(
                                member,
                                [
                                    "full_name",
                                    "name",
                                    "display_name",
                                    "username"
                                ],
                                "Member"
                            )
                        ),

                    photo_url:
                        getField(
                            student,
                            [
                                "photo_url",
                                "avatar_url"
                            ]
                        ),

                    role:
                        normalizeRole(
                            getField(
                                member,
                                [
                                    "role"
                                ],
                                "student"
                            )
                        )

                };

            }
        );


    /*
     * Ensure current user exists in display.
     */

    if (
        currentUser &&
        !members.some(
            item =>
                String(
                    item.user_id
                ) ===
                String(
                    currentUser.id
                )
        )
    ) {

        members.unshift({

            user_id:
                currentUser.id,

            full_name:
                getUserName(),

            photo_url:
                getField(
                    currentStudent,
                    [
                        "photo_url"
                    ]
                ),

            role:
                currentRole

        });

    }


    renderMembers();

}


/* =========================================================
   RENDER MEMBERS
========================================================= */

function renderMembers() {

    const list =
        $("memberList");

    if (!list) {

        return;

    }


    if (!members.length) {

        list.innerHTML =
            `
            <div class="sidebar-loading">
                No members found.
            </div>
            `;

        return;

    }


    const sorted =
        [...members].sort(
            (a, b) => {

                const levelA =
                    ROLE_LEVEL[
                        normalizeRole(
                            a.role
                        )
                    ] || 1;

                const levelB =
                    ROLE_LEVEL[
                        normalizeRole(
                            b.role
                        )
                    ] || 1;

                return levelB - levelA;

            }
        );


    list.innerHTML =
        `
        <div class="member-section-title">
            Community members — ${sorted.length}
        </div>

        ${sorted
            .map(
                member => {

                    const name =
                        getField(
                            member,
                            [
                                "full_name",
                                "name",
                                "display_name"
                            ],
                            "Member"
                        );

                    const role =
                        normalizeRole(
                            member.role
                        );

                    const photo =
                        member.photo_url;

                    const avatar =
                        photo
                            ? `
                                <span class="avatar avatar-small">
                                    <img
                                        src="${escapeHTML(photo)}"
                                        alt="${escapeHTML(name)}"
                                    >
                                </span>
                            `
                            : `
                                <span class="avatar avatar-small">
                                    ${escapeHTML(
                                        getInitials(name)
                                    )}
                                </span>
                            `;

                    return `
                        <div class="member-item">

                            ${avatar}

                            <div class="member-information">

                                <span class="member-name">
                                    ${escapeHTML(name)}
                                </span>

                                <span class="member-role">
                                    ${escapeHTML(
                                        roleLabel(role)
                                    )}
                                </span>

                            </div>

                            <span
                                class="online-indicator"
                                data-presence-user="${escapeHTML(
                                    member.user_id
                                )}"
                            ></span>

                        </div>
                    `;

                }
            )
            .join("")}
        `;


    updateOnlineCount();

}


/* =========================================================
   PRESENCE
========================================================= */

async function subscribePresence() {

    if (!currentUser) {

        return;

    }


    if (
        realtimePresenceChannel
    ) {

        await supabase.removeChannel(
            realtimePresenceChannel
        );

    }


    realtimePresenceChannel =
        supabase.channel(
            "mwaniki-community-presence",
            {
                config: {
                    presence: {
                        key:
                            currentUser.id
                    }
                }
            }
        );


    realtimePresenceChannel
        .on(
            "presence",
            {
                event: "sync"
            },
            () => {

                updateOnlineCount();

            }
        )
        .on(
            "presence",
            {
                event: "join"
            },
            () => {

                updateOnlineCount();

            }
        )
        .on(
            "presence",
            {
                event: "leave"
            },
            () => {

                updateOnlineCount();

            }
        );


    await realtimePresenceChannel.subscribe(
        async status => {

            if (
                status === "SUBSCRIBED"
            ) {

                await realtimePresenceChannel.track(
                    {
                        user_id:
                            currentUser.id,

                        online_at:
                            new Date().toISOString()
                    }
                );

            }

        }
    );

}


/* =========================================================
   ONLINE COUNT
========================================================= */

function updateOnlineCount() {

    const summary =
        $("membersOnlineSummary");

    let onlineCount =
        0;


    try {

        if (
            realtimePresenceChannel
        ) {

            const state =
                realtimePresenceChannel.presenceState();

            onlineCount =
                Object.keys(
                    state || {}
                ).length;

        }

    } catch {

        onlineCount =
            0;

    }


    if (summary) {

        summary.textContent =
            `${onlineCount} online`;

    }


    document
        .querySelectorAll(
            ".online-indicator"
        )
        .forEach(
            element => {

                element.classList.remove(
                    "online"
                );

            }
        );


    try {

        if (
            realtimePresenceChannel
        ) {

            const state =
                realtimePresenceChannel.presenceState();


            Object.keys(
                state || {}
            )
                .forEach(
                    userId => {

                        const indicator =
                            document.querySelector(
                                `[data-presence-user="${CSS.escape(userId)}"]`
                            );

                        if (indicator) {

                            indicator.classList.add(
                                "online"
                            );

                        }

                    }
                );

        }

    } catch {

        /* Presence is optional. */

    }

}


/* =========================================================
   REALTIME
========================================================= */

function subscribeToRealtime() {

    if (
        !currentChannel
    ) {

        return;

    }


    if (
        realtimeMessageChannel
    ) {

        supabase.removeChannel(
            realtimeMessageChannel
        );

    }


    const channelName =
        `mwaniki-chat-${currentChannel.id}`;


    realtimeMessageChannel =
        supabase.channel(
            channelName
        );


    realtimeMessageChannel

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_messages",
                filter:
                    `channel_id=eq.${currentChannel.id}`
            },
            payload => {

                handleRealtimeMessage(
                    payload
                );

            }
        )


        .subscribe(
            status => {

                console.log(
                    "💬 Chat realtime:",
                    status
                );

            }
        );


}


/* =========================================================
   REALTIME MESSAGE
========================================================= */

function handleRealtimeMessage(
    payload
) {

    if (!payload) {

        return;

    }


    if (
        payload.eventType ===
        "INSERT"
    ) {

        const message =
            payload.new;


        if (
            !messages.some(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        message.id
                    )
            )
        ) {

            messages.push(
                message
            );

            renderMessages();


            /*
             * If another student sends a message,
             * create a local notification.
             */

            const senderId =
                getField(
                    message,
                    [
                        "sender_id",
                        "user_id"
                    ]
                );


            if (
                String(senderId) !==
                String(currentUser?.id)
            ) {

                addLocalNotification({

                    id:
                        `message-${message.id}`,

                    title:
                        `New message in #${currentChannel?.name || "channel"}`,

                    message:
                        getField(
                            message,
                            [
                                "content"
                            ],
                            "New community message"
                        ),

                    created_at:
                        getField(
                            message,
                            [
                                "created_at"
                            ],
                            new Date().toISOString()
                        ),

                    read:
                        false

                });

            }

        }

    }


    if (
        payload.eventType ===
        "DELETE"
    ) {

        messages =
            messages.filter(
                item =>
                    String(
                        item.id
                    ) !==
                    String(
                        payload.old?.id
                    )
            );

        renderMessages();

    }

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function notificationStorageKey() {

    return (
        "mwanikiCommunityNotifications_" +
        String(
            currentUser?.id || "guest"
        )
    );

}


function loadLocalNotifications() {

    try {

        const raw =
            localStorage.getItem(
                notificationStorageKey()
            );

        notifications =
            raw
                ? JSON.parse(raw)
                : [];

        if (
            !Array.isArray(
                notifications
            )
        ) {

            notifications = [];

        }

    } catch {

        notifications = [];

    }

}


function saveLocalNotifications() {

    try {

        localStorage.setItem(
            notificationStorageKey(),
            JSON.stringify(
                notifications.slice(
                    0,
                    100
                )
            )
        );

    } catch {

        /* Ignore local storage failures. */

    }

}


function addLocalNotification(
    notification
) {

    if (
        notifications.some(
            item =>
                String(
                    item.id
                ) ===
                String(
                    notification.id
                )
        )
    ) {

        return;

    }


    notifications.unshift(
        notification
    );

    notifications =
        notifications.slice(
            0,
            100
        );


    saveLocalNotifications();

    renderNotifications();

    updateNotificationBadge();

}


/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotifications() {

    const list =
        $("communityNotificationList");

    if (!list) {

        return;

    }


    if (!notifications.length) {

        list.innerHTML =
            `
            <div class="empty-notifications">
                No notifications
            </div>
            `;

        return;

    }


    list.innerHTML =
        notifications
            .map(
                item => {

                    return `
                        <article
                            class="community-notification-item ${
                                item.read
                                    ? ""
                                    : "unread"
                            }"
                        >

                            <strong>
                                ${escapeHTML(
                                    item.title ||
                                    "Community notification"
                                )}
                            </strong>

                            <p>
                                ${escapeHTML(
                                    item.message ||
                                    ""
                                )}
                            </p>

                            <time>
                                ${formatDateTime(
                                    item.created_at
                                )}
                            </time>

                        </article>
                    `;

                }
            )
            .join("");

}


function updateNotificationBadge() {

    const badge =
        $("communityNotificationBadge");

    if (!badge) {

        return;

    }


    const unread =
        notifications.filter(
            item =>
                !item.read
        ).length;


    if (!unread) {

        badge.classList.add(
            "hidden"
        );

        badge.textContent =
            "0";

        return;

    }


    badge.classList.remove(
        "hidden"
    );

    badge.textContent =
        unread > 99
            ? "99+"
            : String(unread);

}


function markNotificationsRead() {

    notifications =
        notifications.map(
            item => ({
                ...item,
                read: true
            })
        );


    saveLocalNotifications();

    renderNotifications();

    updateNotificationBadge();

}


/* =========================================================
   READ STATUS
========================================================= */

async function markChannelRead() {

    if (
        !currentUser ||
        !currentChannel
    ) {

        return;

    }


    /*
     * The existing Phase 1/2 table supports a read-status
     * record. We insert/upsert using the common schema.
     */

    const payload = {

        channel_id:
            currentChannel.id,

        user_id:
            currentUser.id,

        last_read_at:
            new Date().toISOString()

    };


    const {
        error
    } =
        await supabase

            .from(
                "chat_read_status"
            )

            .upsert(
                payload,
                {
                    onConflict:
                        "channel_id,user_id"
                }
            );


    if (error) {

        /*
         * Do not break the community if read status
         * has a slightly different schema.
         */

        console.warn(
            "⚠️ Read status could not be updated:",
            error.message
        );

    }

}


/* =========================================================
   EMPTY CHANNEL
========================================================= */

function renderEmptyChannelState() {

    const area =
        $("messageArea");

    if (!area) {

        return;

    }


    area.innerHTML =
        `
        <div class="empty-state">

            <div>

                <strong>
                    No channels available
                </strong>

                <p>
                    ${
                        canCreateChannel()
                            ? "Create the first channel for this community."
                            : "Ask a community administrator to create a channel."
                    }
                </p>

            </div>

        </div>
        `;

}


/* =========================================================
   CREATE COMMUNITY
========================================================= */

async function createCommunity(
    event
) {

    event.preventDefault();


    if (
        !canCreateCommunity()
    ) {

        showToast(
            "You do not have permission to create communities.",
            "error"
        );

        return;

    }


    if (!currentUser) {

        return;

    }


    const name =
        $("newCommunityName")
            ?.value
            .trim();


    const description =
        $("newCommunityDescription")
            ?.value
            .trim();


    const courseId =
        $("newCommunityCourse")
            ?.value ||
        null;


    if (!name) {

        showToast(
            "Enter a community name.",
            "error"
        );

        return;

    }


    showLoading();


    /*
     * Standard Phase 3 community fields.
     */

    const payload = {

        name:
            name,

        description:
            description,

        owner_id:
            currentUser.id

    };


    if (courseId) {

        payload.course_id =
            Number(courseId);

    }


    let result =
        await supabase

            .from(
                "chat_communities"
            )

            .insert(
                payload
            )
            .select()
            .single();


    /*
     * Fallback for schemas that use created_by
     * rather than owner_id.
     */

    if (
        result.error &&
        String(
            result.error.message
        )
            .toLowerCase()
            .includes(
                "owner_id"
            )
    ) {

        const fallback = {

            name:
                name,

            description:
                description,

            created_by:
                currentUser.id

        };


        if (courseId) {

            fallback.course_id =
                Number(courseId);

        }


        result =
            await supabase

                .from(
                    "chat_communities"
                )

                .insert(
                    fallback
                )
                .select()
                .single();

    }


    hideLoading();


    if (result.error) {

        console.error(
            "❌ Create community error:",
            result.error
        );

        showToast(
            `Could not create community: ${result.error.message}`,
            "error"
        );

        return;

    }


    const created =
        result.data;


    /*
     * Automatically add creator as super admin.
     */

    const membershipPayload = {

        community_id:
            created.id,

        user_id:
            currentUser.id,

        role:
            "super_admin"

    };


    const membershipResult =
        await supabase

            .from(
                "chat_community_members"
            )

            .insert(
                membershipPayload
            );


    if (
        membershipResult.error
    ) {

        console.warn(
            "⚠️ Creator membership could not be created:",
            membershipResult.error
        );

    }


    closeCommunityModal();

    $("createCommunityForm")
        ?.reset();


    await loadCommunities();

    await switchCommunity(
        created.id
    );


    showToast(
        "Community created successfully.",
        "success"
    );

}


/* =========================================================
   CREATE CHANNEL
========================================================= */

async function createChannel(
    event
) {

    event.preventDefault();


    if (
        !canCreateChannel()
    ) {

        showToast(
            "You do not have permission to create channels.",
            "error"
        );

        return;

    }


    if (!currentCommunity) {

        return;

    }


    const name =
        $("newChannelName")
            ?.value
            .trim();


    const description =
        $("newChannelDescription")
            ?.value
            .trim();


    const category =
        $("newChannelCategory")
            ?.value
            .trim() ||
        "General";


    const visibility =
        $("newChannelVisibility")
            ?.value ||
        "public";


    const courseId =
        $("newChannelCourse")
            ?.value ||
        null;


    if (!name) {

        showToast(
            "Enter a channel name.",
            "error"
        );

        return;

    }


    showLoading();


    const payload = {

        community_id:
            currentCommunity.id,

        name:
            name,

        description:
            description,

        category:
            category,

        is_private:
            visibility === "private"

    };


    if (courseId) {

        payload.course_id =
            Number(courseId);

    }


    let result =
        await supabase

            .from(
                "chat_channels"
            )

            .insert(
                payload
            )
            .select()
            .single();


    /*
     * Fallback if category is not present in the current
     * database schema. The UI still groups such a channel
     * as General.
     */

    if (
        result.error &&
        String(
            result.error.message
        )
            .toLowerCase()
            .includes(
                "category"
            )
    ) {

        const fallback = {

            community_id:
                currentCommunity.id,

            name:
                name,

            description:
                description,

            is_private:
                visibility === "private"

        };


        if (courseId) {

            fallback.course_id =
                Number(courseId);

        }


        result =
            await supabase

                .from(
                    "chat_channels"
                )

                .insert(
                    fallback
                )
                .select()
                .single();

    }


    hideLoading();


    if (result.error) {

        console.error(
            "❌ Create channel error:",
            result.error
        );

        showToast(
            `Could not create channel: ${result.error.message}`,
            "error"
        );

        return;

    }


    const created =
        result.data;


    /*
     * Creator is automatically added to private channels.
     */

    if (
        visibility === "private"
    ) {

        const membership =
            await supabase

                .from(
                    "chat_channel_members"
                )

                .insert(
                    {
                        channel_id:
                            created.id,

                        user_id:
                            currentUser.id
                    }
                );


        if (membership.error) {

            console.warn(
                "⚠️ Private channel membership failed:",
                membership.error
            );

        }

    }


    closeChannelModal();

    $("createChannelForm")
        ?.reset();


    await loadChannels();

    await switchChannel(
        created.id
    );


    showToast(
        "Channel created successfully.",
        "success"
    );

}


/* =========================================================
   COURSE SELECTORS
========================================================= */

function populateCourseSelectors() {

    const selectors = [

        $("newCommunityCourse"),

        $("newChannelCourse")

    ];


    selectors
        .forEach(
            select => {

                if (!select) {

                    return;

                }


                const current =
                    select.value;


                select.innerHTML =
                    `
                    <option value="">
                        No course link
                    </option>
                    `;


                allCourses
                    .forEach(
                        course => {

                            const option =
                                document.createElement(
                                    "option"
                                );

                            option.value =
                                course.id;

                            option.textContent =
                                course.title ||
                                `Course ${course.id}`;

                            select.appendChild(
                                option
                            );

                        }
                    );


                if (current) {

                    select.value =
                        current;

                }

            }
        );

}


/* =========================================================
   MODALS
========================================================= */

function openCommunityModal() {

    $("communityModalOverlay")
        ?.classList
        .remove("hidden");

}


function closeCommunityModal() {

    $("communityModalOverlay")
        ?.classList
        .add("hidden");

}


function openChannelModal() {

    $("channelModalOverlay")
        ?.classList
        .remove("hidden");

}


function closeChannelModal() {

    $("channelModalOverlay")
        ?.classList
        .add("hidden");

}


/* =========================================================
   UI EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    /*
     * Send
     */

    $("sendMessageButton")
        ?.addEventListener(
            "click",
            sendMessage
        );


    /*
     * Enter to send
     */

    $("messageInput")
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


    /*
     * Auto resize textarea
     */

    $("messageInput")
        ?.addEventListener(
            "input",
            event => {

                const textarea =
                    event.target;

                textarea.style.height =
                    "auto";

                textarea.style.height =
                    `${Math.min(
                        textarea.scrollHeight,
                        130
                    )}px`;

            }
        );


    /*
     * Reply cancellation
     */

    $("cancelReplyButton")
        ?.addEventListener(
            "click",
            () => {

                currentReplyMessage =
                    null;

                renderReplyPreview();

            }
        );


    /*
     * Refresh
     */

    $("refreshCommunityButton")
        ?.addEventListener(
            "click",
            async () => {

                await refreshCommunity();

            }
        );


    /*
     * Notification panel
     */

    $("communityNotificationButton")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                $("communityNotificationPanel")
                    ?.classList
                    .toggle(
                        "hidden"
                    );

                $("communityProfileMenu")
                    ?.classList
                    .add("hidden");

            }
        );


    $("markNotificationsReadButton")
        ?.addEventListener(
            "click",
            markNotificationsRead
        );


    /*
     * Profile menu
     */

    $("communityProfileButton")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                $("communityProfileMenu")
                    ?.classList
                    .toggle(
                        "hidden"
                    );

                $("communityNotificationPanel")
                    ?.classList
                    .add("hidden");

            }
        );


    /*
     * Sign out
     */

    $("communitySignOutButton")
        ?.addEventListener(
            "click",
            async () => {

                await supabase.auth.signOut();

                window.location.href =
                    "index.html";

            }
        );


    /*
     * Community options
     */

    $("communityOptionsButton")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                $("communityOptionsMenu")
                    ?.classList
                    .toggle(
                        "hidden"
                    );

            }
        );


    /*
     * Create community
     */

    $("createCommunityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );


    /*
     * Create channel
     */

    $("createChannelButton")
        ?.addEventListener(
            "click",
            openChannelModal
        );


    /*
     * Modal close buttons
     */

    $("closeCommunityModalButton")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );


    $("cancelCommunityModalButton")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );


    $("closeChannelModalButton")
        ?.addEventListener(
            "click",
            closeChannelModal
        );


    $("cancelChannelModalButton")
        ?.addEventListener(
            "click",
            closeChannelModal
        );


    /*
     * Forms
     */

    $("createCommunityForm")
        ?.addEventListener(
            "submit",
            createCommunity
        );


    $("createChannelForm")
        ?.addEventListener(
            "submit",
            createChannel
        );


    /*
     * Members
     */

    $("channelMembersButton")
        ?.addEventListener(
            "click",
            () => {

                $("membersPanel")
                    ?.classList
                    .toggle(
                        "mobile-open"
                    );

            }
        );


    $("closeMembersButton")
        ?.addEventListener(
            "click",
            () => {

                $("membersPanel")
                    ?.classList
                    .remove(
                        "mobile-open"
                    );

            }
        );


    /*
     * Mobile channel sidebar
     */

    $("mobileMenuButton")
        ?.addEventListener(
            "click",
            () => {

                $("channelSidebar")
                    ?.classList
                    .toggle(
                        "mobile-open"
                    );

            }
        );


    /*
     * Channel search
     */

    $("channelSearchButton")
        ?.addEventListener(
            "click",
            () => {

                $("messageSearchBar")
                    ?.classList
                    .remove(
                        "hidden"
                    );

                $("messageSearchInput")
                    ?.focus();

            }
        );


    $("closeMessageSearchButton")
        ?.addEventListener(
            "click",
            () => {

                $("messageSearchBar")
                    ?.classList
                    .add(
                        "hidden"
                    );

                $("messageSearchInput")
                    .value =
                    "";

                renderMessages();

            }
        );


    $("messageSearchInput")
        ?.addEventListener(
            "input",
            event => {

                const query =
                    event.target.value
                        .trim()
                        .toLowerCase();


                if (!query) {

                    renderMessages();

                    return;

                }


                const area =
                    $("messageArea");

                const filtered =
                    messages.filter(
                        message => {

                            const content =
                                getField(
                                    message,
                                    [
                                        "content",
                                        "message",
                                        "text"
                                    ],
                                    ""
                                )
                                    .toLowerCase();

                            return content.includes(
                                query
                            );

                        }
                    );


                if (!filtered.length) {

                    area.innerHTML =
                        `
                        <div class="empty-state">
                            No matching messages.
                        </div>
                        `;

                    return;

                }


                area.innerHTML =
                    filtered
                        .map(
                            renderMessage
                        )
                        .join("");

            }
        );


    /*
     * Attachments
     */

    $("attachButton")
        ?.addEventListener(
            "click",
            () => {

                $("attachmentInput")
                    ?.click();

            }
        );


    $("attachmentInput")
        ?.addEventListener(
            "change",
            event => {

                currentAttachments =
                    Array.from(
                        event.target.files ||
                        []
                    );

                renderAttachmentPreview();

            }
        );


    /*
     * Emoji shortcut
     */

    $("emojiButton")
        ?.addEventListener(
            "click",
            () => {

                const input =
                    $("messageInput");

                if (!input) {

                    return;

                }

                input.value +=
                    " 😊";

                input.focus();

            }
        );


    /*
     * Global click
     */

    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".profile-button"
                ) &&
                !event.target.closest(
                    ".profile-menu"
                )
            ) {

                $("communityProfileMenu")
                    ?.classList
                    .add(
                        "hidden"
                    );

            }


            if (
                !event.target.closest(
                    "#communityOptionsButton"
                ) &&
                !event.target.closest(
                    "#communityOptionsMenu"
                )
            ) {

                $("communityOptionsMenu")
                    ?.classList
                    .add(
                        "hidden"
                    );

            }

        }
    );


    /*
     * Search communities/messages.
     */

    $("communitySearch")
        ?.addEventListener(
            "input",
            event => {

                const query =
                    event.target.value
                        .trim()
                        .toLowerCase();

                if (!query) {

                    renderCommunityRail();

                    return;

                }


                const filtered =
                    communities.filter(
                        community => {

                            const text =
                                [
                                    community.name,
                                    community.description,
                                    community.course?.title
                                ]
                                    .filter(Boolean)
                                    .join(" ")
                                    .toLowerCase();

                            return text.includes(
                                query
                            );

                        }
                    );


                const list =
                    $("communityList");


                if (!list) {

                    return;

                }


                list.innerHTML =
                    filtered
                        .map(
                            community => {

                                const active =
                                    currentCommunity &&
                                    String(
                                        currentCommunity.id
                                    ) ===
                                    String(
                                        community.id
                                    );

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
                                            community.name
                                        )}"
                                    >
                                        ${escapeHTML(
                                            getInitials(
                                                community.name
                                            ).slice(0,2)
                                        )}
                                    </button>
                                `;

                            }
                        )
                        .join("");


                list
                    .querySelectorAll(
                        "[data-community-id]"
                    )
                    .forEach(
                        button => {

                            button.addEventListener(
                                "click",
                                async () => {

                                    await switchCommunity(
                                        button.dataset.communityId
                                    );

                                }
                            );

                        }
                    );

            }
        );

}


/* =========================================================
   ATTACHMENT PREVIEW
========================================================= */

function renderAttachmentPreview() {

    const area =
        $("attachmentPreview");

    if (!area) {

        return;

    }


    if (!currentAttachments.length) {

        area.innerHTML =
            "";

        return;

    }


    area.innerHTML =
        currentAttachments
            .map(
                file =>
                    `
                    <span class="attachment-chip">
                        📎 ${escapeHTML(file.name)}
                    </span>
                    `
            )
            .join("");

}


/* =========================================================
   REFRESH
========================================================= */

async function refreshCommunity() {

    showLoading();

    try {

        await loadCourses();

        populateCourseSelectors();

        await loadCommunities();


        if (
            currentCommunity
        ) {

            const stillExists =
                communities.some(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            currentCommunity.id
                        )
                );


            if (
                stillExists
            ) {

                await switchCommunity(
                    currentCommunity.id
                );

            } else if (
                communities.length
            ) {

                await switchCommunity(
                    communities[0].id
                );

            }

        } else if (
            communities.length
        ) {

            await switchCommunity(
                communities[0].id
            );

        }


        loadLocalNotifications();

        renderNotifications();

        updateNotificationBadge();


    } finally {

        hideLoading();

    }

}


/* =========================================================
   AUTH STATE
========================================================= */

function setupAuthListener() {

    supabase.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            console.log(
                "🔐 Community auth:",
                event
            );


            if (
                !session?.user
            ) {

                return;

            }


            currentUser =
                session.user;

            await initializeCommunity();

        }
    );

}


/* =========================================================
   DETERMINE ROLE
========================================================= */

async function determineUserRole() {

    currentRole =
        "student";


    if (
        !currentUser
    ) {

        return;

    }


    /*
     * First inspect community membership if a current
     * community exists.
     */

    if (
        currentCommunity
    ) {

        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_community_members"
                )

                .select("*")

                .eq(
                    "community_id",
                    currentCommunity.id
                )

                .eq(
                    "user_id",
                    currentUser.id
                )
                .maybeSingle();


        if (
            !error &&
            data
        ) {

            currentRole =
                normalizeRole(
                    getField(
                        data,
                        [
                            "role"
                        ],
                        "student"
                    )
                );

            return;

        }

    }


    /*
     * Inspect student profile role if available.
     */

    const profileRole =
        getField(
            currentStudent,
            [
                "role",
                "user_role"
            ]
        );


    if (profileRole) {

        currentRole =
            normalizeRole(
                profileRole
            );

        return;

    }


    /*
     * Auth metadata fallback.
     */

    const metadataRole =
        getField(
            currentUser.user_metadata,
            [
                "role",
                "user_role"
            ]
        );


    if (metadataRole) {

        currentRole =
            normalizeRole(
                metadataRole
            );

    }

}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeCommunity() {

    if (
        initializationComplete
    ) {

        /*
         * Still update identity if auth changed.
         */

        await loadStudentProfile();

        updateIdentityUI();

        return;

    }


    showLoading();


    try {

        await loadAuthenticatedUser();


        if (!currentUser) {

            window.location.href =
                "index.html";

            return;

        }


        await loadStudentProfile();

        await loadCourses();

        populateCourseSelectors();

        loadLocalNotifications();

        await loadCommunities();


        /*
         * Select first community.
         */

        if (
            communities.length
        ) {

            await switchCommunity(
                communities[0].id
            );

        } else {

            renderEmptyChannelState();

        }


        await determineUserRole();

        updateIdentityUI();

        renderActiveCommunity();

        renderCommunityRail();

        renderNotifications();

        updateNotificationBadge();

        await subscribePresence();


        setupEventListeners();

        setupAuthListener();


        initializationComplete =
            true;


        console.log(
            "✅ Mwaniki Community Phase 3 ready."
        );


    } catch (error) {

        console.error(
            "❌ Community initialization failed:",
            error
        );

        showToast(
            "Community initialization failed. Check the browser console.",
            "error"
        );

    } finally {

        hideLoading();

    }

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeCommunity();

    }
);
