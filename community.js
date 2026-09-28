/* =========================================================
   MWANIKI SCHOLARS
   MWANIKI COMMUNITY — PHASE 3 ENGINE
   DATABASE-ALIGNED VERSION

   REAL SUPABASE SCHEMA:
   ---------------------------------------------------------
   chat_communities
   chat_community_members
   chat_channels
   chat_channel_members
   chat_messages
   chat_message_reactions
   chat_presence
   chat_read_status
   chat_notifications
   chat_attachments
   chat_reports

   IMPORTANT:
   - chat_messages.user_id is the sender
   - chat_channels.course_id links channels to courses
   - chat_channels.unit_id links channels to units
   - chat_channels.channel_type defines channel type
   - chat_channels.is_private controls privacy
   - chat_communities.created_by identifies creator
   - No fake schema columns are used
   - Mwaniki AI and Turbo AI remain completely isolated
========================================================= */

(() => {
    "use strict";

    console.log(
        "🚀 Mwaniki Community Phase 3 database-aligned engine loaded"
    );


    /* =====================================================
       SUPABASE
    ====================================================== */

    const supabaseClient =
        window.supabaseClient ||
        window.supabase ||
        null;

    if (!supabaseClient) {

        console.error(
            "❌ Supabase client was not found."
        );

        return;
    }


    /* =====================================================
       STATE
    ====================================================== */

    const state = {

        user: null,

        profile: null,

        communities: [],

        courses: [],

        channels: [],

        members: [],

        presences: [],

        messages: [],

        reactions: [],

        currentCommunity: null,

        currentChannel: null,

        currentRole: "student",

        currentReplyMessage: null,

        communityRealtimeChannel: null,

        messageRealtimeChannel: null,

        presenceRealtimeChannel: null,

        presenceHeartbeat: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        collapsedCategories: new Set(),

        loading: false

    };


    /* =====================================================
       DOM HELPERS
    ====================================================== */

    const $ = selector =>
        document.querySelector(selector);

    const $$ = selector =>
        Array.from(
            document.querySelectorAll(selector)
        );


    function getElement(id) {
        return document.getElementById(id);
    }


    /* =====================================================
       TOAST
    ====================================================== */

    let toastTimer = null;

    function showToast(
        message,
        type = "normal"
    ) {

        const toast =
            getElement("communityToast");

        if (!toast) return;

        toast.textContent =
            String(message || "");

        toast.dataset.type =
            type;

        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer =
            setTimeout(() => {

                toast.classList.remove(
                    "show"
                );

            }, 3000);
    }


    /* =====================================================
       TEXT HELPERS
    ====================================================== */

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


    function initials(name) {

        const text =
            String(
                name || "Student"
            ).trim();

        if (!text) {
            return "S";
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


    function getDisplayName(record) {

        if (!record) {
            return "Student";
        }

        return (
            record.full_name ||
            record.name ||
            record.display_name ||
            record.username ||
            record.email ||
            record.user_email ||
            record._profile?.full_name ||
            record._profile?.name ||
            "Student"
        );
    }


    function getUserId(record) {

        if (!record) {
            return null;
        }

        return (
            record.user_id ||
            record.userId ||
            record.uid ||
            record.id ||
            null
        );
    }


    function normalizeRole(role) {

        const value =
            String(
                role || "student"
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[\s_-]+/g,
                    ""
                );

        if (
            value === "superadmin" ||
            value === "superadministrator" ||
            value === "owner"
        ) {
            return "super_admin";
        }

        if (
            value === "admin" ||
            value === "administrator"
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

        switch (
            normalizeRole(role)
        ) {

            case "super_admin":
                return "Super Admin";

            case "admin":
                return "Admin";

            case "moderator":
                return "Moderator";

            case "tutor":
                return "Tutor";

            default:
                return "Student";
        }
    }


    function getChannelCourseId(channel) {

        if (!channel) {
            return null;
        }

        return (
            channel.course_id ??
            null
        );
    }


    function getChannelType(channel) {

        return String(
            channel?.channel_type ||
            "text"
        ).toLowerCase();
    }


    function isPrivateChannel(channel) {

        return Boolean(
            channel?.is_private === true
        );
    }


    function getChannelCategory(channel) {

        const type =
            getChannelType(
                channel
            );

        if (type === "announcement") {
            return "Announcements";
        }

        if (type === "study") {
            return "Study Hub";
        }

        if (type === "course") {
            return "Course Communities";
        }

        if (type === "voice") {
            return "Voice Rooms";
        }

        return "General";
    }


    function getChannelIcon(channel) {

        const type =
            getChannelType(
                channel
            );

        switch (type) {

            case "announcement":
                return "📢";

            case "study":
                return "📚";

            case "course":
                return "🎓";

            case "voice":
                return "🔊";

            default:
                return "#";
        }
    }


    /* =====================================================
       PERMISSIONS
    ====================================================== */

    const permissions = {

        student: {
            view: true,
            send: true,
            react: true,
            createChannel: false,
            createCommunity: false,
            moderate: false,
            manageMembers: false,
            manageCommunity: false
        },

        tutor: {
            view: true,
            send: true,
            react: true,
            createChannel: true,
            createCommunity: false,
            moderate: false,
            manageMembers: false,
            manageCommunity: false
        },

        moderator: {
            view: true,
            send: true,
            react: true,
            createChannel: true,
            createCommunity: false,
            moderate: true,
            manageMembers: true,
            manageCommunity: false
        },

        admin: {
            view: true,
            send: true,
            react: true,
            createChannel: true,
            createCommunity: true,
            moderate: true,
            manageMembers: true,
            manageCommunity: true
        },

        super_admin: {
            view: true,
            send: true,
            react: true,
            createChannel: true,
            createCommunity: true,
            moderate: true,
            manageMembers: true,
            manageCommunity: true
        }

    };


    function can(permission) {

        const role =
            normalizeRole(
                state.currentRole
            );

        return Boolean(
            permissions[role] &&
            permissions[role][permission]
        );
    }


    function applyPermissionUI() {

        const createChannelButton =
            getElement(
                "createChannelButton"
            );

        const createCommunityButton =
            getElement(
                "createCommunityButton"
            );

        const menuCreateChannel =
            getElement(
                "communityMenuCreateChannel"
            );

        const menuCreateCommunity =
            getElement(
                "communityMenuCreateCommunity"
            );

        if (createChannelButton) {

            createChannelButton.style.display =
                can("createChannel")
                    ? "flex"
                    : "none";
        }

        if (createCommunityButton) {

            createCommunityButton.style.display =
                can("createCommunity")
                    ? "flex"
                    : "none";
        }

        if (menuCreateChannel) {

            menuCreateChannel.style.display =
                can("createChannel")
                    ? "block"
                    : "none";
        }

        if (menuCreateCommunity) {

            menuCreateCommunity.style.display =
                can("createCommunity")
                    ? "block"
                    : "none";
        }

        const roleBadge =
            getElement(
                "activeRoleBadge"
            );

        if (roleBadge) {

            roleBadge.textContent =
                roleLabel(
                    state.currentRole
                );
        }

        const input =
            getElement(
                "messageInput"
            );

        const sendButton =
            getElement(
                "sendMessageButton"
            );

        if (input) {

            input.disabled =
                !can("send");

            input.placeholder =
                can("send")
                    ? `Message #${
                        state.currentChannel?.name ||
                        "channel"
                    }`
                    : "You cannot send messages here.";
        }

        if (sendButton) {

            sendButton.disabled =
                !can("send");
        }
    }


    /* =====================================================
       AUTHENTICATION
    ====================================================== */

    async function getAuthenticatedUser() {

        try {

            const {
                data,
                error
            } =
                await supabaseClient.auth.getUser();

            if (error) {

                console.error(
                    "❌ Unable to retrieve authenticated user:",
                    error
                );

                return null;
            }

            return data?.user || null;

        } catch (error) {

            console.error(
                "❌ Authentication lookup failed:",
                error
            );

            return null;
        }
    }


    /* =====================================================
       PROFILE
    ====================================================== */

    async function loadCurrentProfile() {

        if (!state.user) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("students")
                    .select("*")
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();

            if (!error && data) {

                state.profile =
                    data;

                return;
            }

        } catch (error) {

            console.warn(
                "⚠️ Student profile lookup failed:",
                error
            );
        }

        /*
         * Optional fallback for installations
         * that have a profiles table.
         */

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("profiles")
                    .select("*")
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();

            if (!error && data) {

                state.profile =
                    data;
            }

        } catch (_) {}
    }


    /* =====================================================
       COURSES
    ====================================================== */

    async function loadCourses() {

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from("courses")
                    .select(
                        "id,title,description"
                    )
                    .order(
                        "title",
                        {
                            ascending: true
                        }
                    );

            if (error) {
                throw error;
            }

            state.courses =
                Array.isArray(data)
                    ? data
                    : [];

            populateCourseSelects();

            console.log(
                "📚 Community courses loaded:",
                state.courses.length
            );

        } catch (error) {

            console.warn(
                "⚠️ Could not load courses:",
                error
            );

            state.courses = [];

            populateCourseSelects();
        }
    }


    function populateCourseSelects() {

        const communitySelect =
            getElement(
                "communityCourseSelect"
            );

        const channelSelect =
            getElement(
                "channelCourseSelect"
            );

        if (communitySelect) {

            communitySelect.innerHTML =
                `<option value="">
                    General Community
                </option>` +

                state.courses
                    .map(
                        course => `
                            <option
                                value="${escapeHTML(course.id)}"
                            >
                                ${escapeHTML(
                                    course.title
                                )}
                            </option>
                        `
                    )
                    .join("");
        }

        if (channelSelect) {

            channelSelect.innerHTML =
                `<option value="">
                    No specific course
                </option>` +

                state.courses
                    .map(
                        course => `
                            <option
                                value="${escapeHTML(course.id)}"
                            >
                                ${escapeHTML(
                                    course.title
                                )}
                            </option>
                        `
                    )
                    .join("");
        }
    }


    /* =====================================================
       COMMUNITY MEMBERSHIP
    ====================================================== */

    async function ensureCommunityMembership(
        communityId
    ) {

        if (
            !state.user ||
            !communityId
        ) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_community_members"
                    )
                    .select(
                        "id,role,is_banned"
                    )
                    .eq(
                        "community_id",
                        communityId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .maybeSingle();

            if (
                !error &&
                data
            ) {

                if (data.is_banned) {

                    showToast(
                        "You cannot access this community.",
                        "error"
                    );
                }

                return;
            }

            /*
             * New students join as students.
             */

            const result =
                await supabaseClient
                    .from(
                        "chat_community_members"
                    )
                    .insert({
                        community_id:
                            communityId,

                        user_id:
                            state.user.id,

                        role:
                            "student"
                    });

            if (result.error) {

                console.warn(
                    "⚠️ Automatic community membership unavailable:",
                    result.error
                );
            }

        } catch (error) {

            console.warn(
                "⚠️ Community membership check failed:",
                error
            );
        }
    }


    /* =====================================================
       COMMUNITIES
    ====================================================== */

    async function loadCommunities() {

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_communities"
                    )
                    .select("*")
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
                throw error;
            }

            state.communities =
                Array.isArray(data)
                    ? data
                    : [];

            renderCommunityRail();

            console.log(
                "🏘️ Communities loaded:",
                state.communities.length
            );

        } catch (error) {

            console.error(
                "❌ Failed to load communities:",
                error
            );

            state.communities = [];

            renderCommunityRail();

            showToast(
                "Could not load communities.",
                "error"
            );
        }
    }


    /* =====================================================
       COMMUNITY RAIL
    ====================================================== */

    function renderCommunityRail() {

        const rail =
            getElement(
                "communityRail"
            );

        if (!rail) {
            return;
        }

        if (!state.communities.length) {

            rail.innerHTML = `
                <div class="community-rail-item active">
                    <div class="community-rail-icon text-icon">
                        MS
                    </div>
                </div>
            `;

            return;
        }

        rail.innerHTML =
            state.communities
                .map(
                    community => {

                        const active =
                            state.currentCommunity &&
                            String(
                                state.currentCommunity.id
                            ) ===
                            String(
                                community.id
                            );

                        const icon =
                            community.icon_url ||
                            initials(
                                community.name
                            );

                        const image =
                            String(icon)
                                .startsWith(
                                    "http"
                                );

                        return `
                            <button
                                type="button"
                                class="community-rail-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-community-id="${
                                    escapeHTML(
                                        community.id
                                    )
                                }"
                                title="${
                                    escapeHTML(
                                        community.name ||
                                        "Community"
                                    )
                                }"
                            >

                                <div
                                    class="community-rail-icon ${
                                        image
                                            ? "image-icon"
                                            : "text-icon"
                                    }"
                                >

                                    ${
                                        image
                                            ? `
                                                <img
                                                    src="${escapeHTML(icon)}"
                                                    alt=""
                                                >
                                            `
                                            : escapeHTML(icon)
                                    }

                                </div>

                            </button>
                        `;
                    }
                )
                .join("");

        refreshRailHandlers();
    }


    function refreshRailHandlers() {

        $$(".community-rail-item[data-community-id]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await switchCommunity(
                            button.dataset.communityId
                        );
                    }
                );
            });
    }


    /* =====================================================
       COMMUNITY ROLE
    ====================================================== */

    async function loadCommunityRole() {

        state.currentRole =
            "student";

        if (
            !state.user ||
            !state.currentCommunity
        ) {

            applyPermissionUI();

            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_community_members"
                    )
                    .select(
                        "role,is_banned"
                    )
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .maybeSingle();

            if (!error && data) {

                if (data.is_banned) {

                    state.currentRole =
                        "student";

                    showToast(
                        "You are currently restricted from this community.",
                        "error"
                    );

                } else {

                    state.currentRole =
                        normalizeRole(
                            data.role
                        );
                }
            }

        } catch (error) {

            console.warn(
                "⚠️ Could not determine community role:",
                error
            );
        }

        /*
         * The real schema has created_by, not owner_id.
         */

        if (
            state.currentCommunity.created_by &&
            String(
                state.currentCommunity.created_by
            ) ===
            String(
                state.user.id
            )
        ) {

            state.currentRole =
                "super_admin";
        }

        applyPermissionUI();
    }


    /* =====================================================
       SWITCH COMMUNITY
    ====================================================== */

    async function switchCommunity(
        communityId
    ) {

        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(communityId)
            );

        if (!community) {

            showToast(
                "Community could not be found.",
                "error"
            );

            return;
        }

        state.currentCommunity =
            community;

        state.currentChannel =
            null;

        state.channels =
            [];

        state.members =
            [];

        state.presences =
            [];

        state.messages =
            [];

        state.reactions =
            [];

        persistCurrentCommunity();

        renderCommunityRail();

        renderActiveCommunity();

        await ensureCommunityMembership(
            community.id
        );

        await loadCommunityRole();

        await loadChannels();

        await loadMembers();

        setupCommunityRealtime();

        setupPresenceRealtime();

        console.log(
            "🔄 Switched community:",
            community.name
        );
    }


    function persistCurrentCommunity() {

        if (
            state.currentCommunity
        ) {

            localStorage.setItem(
                "mwanikiCommunityId",
                String(
                    state.currentCommunity.id
                )
            );
        }
    }


    /* =====================================================
       ACTIVE COMMUNITY
    ====================================================== */

    function renderActiveCommunity() {

        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        const name =
            getElement(
                "activeCommunityName"
            );

        const description =
            getElement(
                "activeCommunityDescription"
            );

        const icon =
            getElement(
                "activeCommunityIcon"
            );

        const courseName =
            getElement(
                "communityCourseName"
            );

        const courseLabel =
            getElement(
                "communityCourseLabel"
            );

        if (name) {

            name.textContent =
                community.name ||
                "Community";
        }

        if (description) {

            description.textContent =
                community.description ||
                "Mwaniki Scholars learning community";
        }

        if (icon) {

            icon.textContent =
                initials(
                    community.name
                );
        }

        if (courseName) {

            courseName.textContent =
                "Mwaniki Scholars";
        }

        if (courseLabel) {

            courseLabel.textContent =
                "Learning Community";
        }
    }


    /* =====================================================
       LOAD CHANNELS
    ====================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) {
            return;
        }

        const channelList =
            getElement(
                "channelList"
            );

        if (channelList) {

            channelList.innerHTML = `
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
                await supabaseClient
                    .from(
                        "chat_channels"
                    )
                    .select("*")
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
                            ascending: true,
                            nullsFirst: false
                        }
                    );

            if (error) {
                throw error;
            }

            state.channels =
                Array.isArray(data)
                    ? data
                    : [];

            await filterPrivateChannels();

            renderChannels();

            if (state.channels.length) {

                const url =
                    new URL(
                        window.location.href
                    );

                const requestedCourseId =
                    url.searchParams.get(
                        "course_id"
                    ) ||
                    localStorage.getItem(
                        "communityCourseId"
                    );

                let selected = null;

                /*
                 * Course-specific channel gets priority.
                 */

                if (requestedCourseId) {

                    selected =
                        state.channels.find(
                            channel =>
                                String(
                                    channel.course_id
                                ) ===
                                String(
                                    requestedCourseId
                                )
                        );
                }

                /*
                 * Otherwise choose a sensible default.
                 */

                if (!selected) {

                    selected =
                        state.channels.find(
                            channel =>
                                channel.name ===
                                "general"
                        );
                }

                if (!selected) {

                    selected =
                        state.channels.find(
                            channel =>
                                channel.position ===
                                0
                        );
                }

                if (!selected) {
                    selected =
                        state.channels[0];
                }

                await selectChannel(
                    selected.id
                );

            } else {

                renderEmptyChannelState();
            }

            console.log(
                "📢 Channels loaded:",
                state.channels.length
            );

        } catch (error) {

            console.error(
                "❌ Failed to load channels:",
                error
            );

            state.channels = [];

            if (channelList) {

                channelList.innerHTML = `
                    <div class="channel-empty">
                        Unable to load channels.
                    </div>
                `;
            }
        }
    }


    /* =====================================================
       PRIVATE CHANNEL FILTER
    ====================================================== */

    async function filterPrivateChannels() {

        if (!state.user) {

            state.channels =
                state.channels.filter(
                    channel =>
                        !isPrivateChannel(
                            channel
                        )
                );

            return;
        }

        const privateChannels =
            state.channels.filter(
                channel =>
                    isPrivateChannel(
                        channel
                    )
            );

        if (!privateChannels.length) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_channel_members"
                    )
                    .select(
                        "channel_id"
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (error) {
                throw error;
            }

            const allowedIds =
                new Set(
                    (data || [])
                        .map(
                            row =>
                                String(
                                    row.channel_id
                                )
                        )
                );

            state.channels =
                state.channels.filter(
                    channel => {

                        if (
                            !isPrivateChannel(
                                channel
                            )
                        ) {
                            return true;
                        }

                        if (
                            can("manageMembers") ||
                            can("manageCommunity")
                        ) {
                            return true;
                        }

                        return allowedIds.has(
                            String(
                                channel.id
                            )
                        );
                    }
                );

        } catch (error) {

            console.warn(
                "⚠️ Private channel membership lookup failed:",
                error
            );
        }
    }


    /* =====================================================
       RENDER CHANNELS
    ====================================================== */

    function renderChannels() {

        const container =
            getElement(
                "channelList"
            );

        if (!container) {
            return;
        }

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

                        String(
                            channel.name || ""
                        )
                            .toLowerCase()
                            .includes(search) ||

                        String(
                            channel.description || ""
                        )
                            .toLowerCase()
                            .includes(search) ||

                        String(
                            getChannelCategory(
                                channel
                            )
                        )
                            .toLowerCase()
                            .includes(search)
                    );
                }
            );

        if (!filtered.length) {

            container.innerHTML = `
                <div class="channel-empty">
                    No channels found.
                </div>
            `;

            return;
        }

        const categories =
            new Map();

        filtered.forEach(
            channel => {

                const category =
                    getChannelCategory(
                        channel
                    );

                if (
                    !categories.has(
                        category
                    )
                ) {

                    categories.set(
                        category,
                        []
                    );
                }

                categories
                    .get(category)
                    .push(channel);
            }
        );

        container.innerHTML =
            Array.from(
                categories.entries()
            )
                .map(
                    ([category, channels]) =>
                        renderChannelCategory(
                            category,
                            channels
                        )
                )
                .join("");

        $$(".channel-category-header")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        toggleCategory(
                            button.dataset.category
                        );
                    }
                );
            });

        $$(".channel-row")
            .forEach(row => {

                row.addEventListener(
                    "click",
                    async () => {

                        await selectChannel(
                            row.dataset.channelId
                        );
                    }
                );
            });
    }


    function renderChannelCategory(
        category,
        channels
    ) {

        const collapsed =
            state.collapsedCategories.has(
                category
            );

        return `
            <div
                class="channel-category ${
                    collapsed
                        ? "collapsed"
                        : ""
                }"
            >

                <button
                    type="button"
                    class="channel-category-header"
                    data-category="${escapeHTML(
                        category
                    )}"
                >

                    <span class="channel-category-title">

                        <span class="channel-category-arrow">
                            ${
                                collapsed
                                    ? "▸"
                                    : "▾"
                            }
                        </span>

                        <span>
                            ${escapeHTML(
                                category
                            )}
                        </span>

                    </span>

                    <span>
                        ${channels.length}
                    </span>

                </button>

                ${
                    collapsed
                        ? ""
                        : `
                            <div class="channel-category-items">

                                ${channels
                                    .map(
                                        renderChannelRow
                                    )
                                    .join("")}

                            </div>
                        `
                }

            </div>
        `;
    }


    function renderChannelRow(
        channel
    ) {

        const active =
            state.currentChannel &&
            String(
                state.currentChannel.id
            ) ===
            String(
                channel.id
            );

        const courseId =
            getChannelCourseId(
                channel
            );

        const course =
            state.courses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

        const icon =
            isPrivateChannel(
                channel
            )
                ? "🔒"
                : getChannelIcon(
                    channel
                );

        return `
            <button
                type="button"
                class="channel-row ${
                    active
                        ? "active"
                        : ""
                }"
                data-channel-id="${escapeHTML(
                    channel.id
                )}"
            >

                <span class="channel-row-icon">
                    ${icon}
                </span>

                <span class="channel-row-content">

                    <span class="channel-row-name">
                        ${escapeHTML(
                            channel.name ||
                            "channel"
                        )}
                    </span>

                    <span class="channel-row-meta">

                        ${
                            isPrivateChannel(
                                channel
                            )
                                ? `
                                    <span class="private-lock">
                                        Private
                                    </span>
                                `
                                : `
                                    <span>
                                        ${escapeHTML(
                                            getChannelType(
                                                channel
                                            )
                                        )}
                                    </span>
                                `
                        }

                        ${
                            course
                                ? `
                                    <span class="course-mini-badge">
                                        ${escapeHTML(
                                            course.title
                                        )}
                                    </span>
                                `
                                : ""
                        }

                    </span>

                </span>

            </button>
        `;
    }


    function toggleCategory(
        category
    ) {

        if (
            state.collapsedCategories.has(
                category
            )
        ) {

            state.collapsedCategories.delete(
                category
            );

        } else {

            state.collapsedCategories.add(
                category
            );
        }

        renderChannels();
    }


    function renderEmptyChannelState() {

        const container =
            getElement(
                "channelList"
            );

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="channel-empty">

                <div
                    style="
                        font-size:26px;
                        margin-bottom:8px;
                    "
                >
                    #
                </div>

                <strong>
                    No channels yet
                </strong>

                <p>
                    ${
                        can("createChannel")
                            ? "Create the first channel for this community."
                            : "A community administrator can create channels."
                    }
                </p>

            </div>
        `;
    }


    /* =====================================================
       SELECT CHANNEL
    ====================================================== */

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

        state.messages = [];

        state.reactions = [];

        renderChannels();

        renderActiveChannel();

        await loadMessages();

        await loadReactions();

        await loadChannelMembers();

        await markChannelRead();

        setupChannelRealtime();

        closeCommunityMenu();

        /*
         * Keep course channel information locally.
         */

        if (
            channel.course_id !== null &&
            channel.course_id !== undefined
        ) {

            localStorage.setItem(
                "communityCourseId",
                String(
                    channel.course_id
                )
            );

            const course =
                state.courses.find(
                    item =>
                        String(item.id) ===
                        String(channel.course_id)
                );

            if (course) {

                localStorage.setItem(
                    "communityCourseName",
                    course.title
                );
            }
        }
    }


    function renderActiveChannel() {

        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }

        const name =
            getElement(
                "activeChannelName"
            );

        const description =
            getElement(
                "activeChannelDescription"
            );

        const input =
            getElement(
                "messageInput"
            );

        if (name) {

            name.textContent =
                channel.name ||
                "channel";
        }

        if (description) {

            description.textContent =
                channel.description ||
                (
                    isPrivateChannel(
                        channel
                    )
                        ? "Private discussion channel."
                        : "Community discussion channel."
                );
        }

        if (input) {

            input.placeholder =
                can("send")
                    ? `Message #${
                        channel.name ||
                        "channel"
                    }`
                    : "You cannot send messages here.";
        }
    }


    /* =====================================================
       LOAD MESSAGES
    ====================================================== */

    async function loadMessages() {

        const messageList =
            getElement(
                "messageList"
            );

        if (!messageList) {
            return;
        }

        if (!state.currentChannel) {

            messageList.innerHTML = `
                <div class="welcome-message">

                    <div class="welcome-icon">
                        #
                    </div>

                    <h2>
                        Select a channel
                    </h2>

                    <p>
                        Choose a channel from the community sidebar.
                    </p>

                </div>
            `;

            return;
        }

        messageList.innerHTML = `
            <div class="channel-loading">
                Loading messages...
            </div>
        `;

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_messages"
                    )
                    .select("*")
                    .eq(
                        "channel_id",
                        state.currentChannel.id
                    )
                    .eq(
                        "is_deleted",
                        false
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    )
                    .limit(200);

            if (error) {
                throw error;
            }

            state.messages =
                Array.isArray(data)
                    ? data
                    : [];

            renderMessages();

            console.log(
                "💬 Messages loaded:",
                state.messages.length
            );

        } catch (error) {

            console.error(
                "❌ Failed to load messages:",
                error
            );

            state.messages = [];

            messageList.innerHTML = `
                <div class="channel-empty">
                    Unable to load messages.
                </div>
            `;
        }
    }


    /* =====================================================
       LOAD REACTIONS
    ====================================================== */

    async function loadReactions() {

        if (!state.currentChannel) {
            return;
        }

        if (!state.messages.length) {

            state.reactions = [];

            return;
        }

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
                await supabaseClient
                    .from(
                        "chat_message_reactions"
                    )
                    .select("*")
                    .in(
                        "message_id",
                        ids
                    );

            if (error) {
                throw error;
            }

            state.reactions =
                Array.isArray(data)
                    ? data
                    : [];

            renderMessages();

        } catch (error) {

            console.warn(
                "⚠️ Reactions could not be loaded:",
                error
            );

            state.reactions = [];
        }
    }


    /* =====================================================
       MESSAGE RENDERING
    ====================================================== */

    function renderMessages() {

        const container =
            getElement(
                "messageList"
            );

        if (!container) {
            return;
        }

        if (!state.messages.length) {

            container.innerHTML = `
                <div class="welcome-message">

                    <div class="welcome-icon">
                        #
                    </div>

                    <h2>
                        Welcome to #${
                            escapeHTML(
                                state.currentChannel?.name ||
                                "channel"
                            )
                        }
                    </h2>

                    <p>
                        This is the beginning of this discussion.
                        Start the conversation.
                    </p>

                </div>
            `;

            return;
        }

        let messages =
            [...state.messages];

        const search =
            state.messageSearch
                .trim()
                .toLowerCase();

        if (search) {

            messages =
                messages.filter(
                    message =>
                        String(
                            message.content || ""
                        )
                            .toLowerCase()
                            .includes(search)
                );
        }

        if (!messages.length) {

            container.innerHTML = `
                <div class="channel-empty">
                    No matching messages.
                </div>
            `;

            return;
        }

        container.innerHTML =
            messages
                .map(
                    message =>
                        renderMessage(
                            message
                        )
                )
                .join("");

        setupMessageActionHandlers();

        container.scrollTop =
            container.scrollHeight;
    }


    function setupMessageActionHandlers() {

        $$(".message-action")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.stopPropagation();

                        const action =
                            button.dataset.action;

                        const messageId =
                            button.dataset.messageId;

                        if (
                            action ===
                            "reply"
                        ) {

                            setReplyMessage(
                                messageId
                            );
                        }

                        if (
                            action ===
                            "delete"
                        ) {

                            await deleteMessage(
                                messageId
                            );
                        }

                        if (
                            action ===
                            "react"
                        ) {

                            await toggleReaction(
                                messageId,
                                button.dataset.reaction
                            );
                        }
                    }
                );
            });
    }


    function renderMessage(
        message
    ) {

        const sender =
            resolveMember(
                message.user_id
            );

        const senderName =
            sender
                ? getDisplayName(
                    sender
                )
                : (
                    message.user_id ===
                    state.user?.id
                        ? getDisplayName(
                            state.profile
                        )
                        : "Student"
                );

        const timestamp =
            formatDateTime(
                message.created_at
            );

        const avatarUrl =
            sender?.photo_url ||
            sender?.avatar_url ||
            sender?._profile?.photo_url ||
            (
                message.user_id ===
                state.user?.id
                    ? state.profile?.photo_url
                    : null
            ) ||
            null;

        const avatar =
            avatarUrl
                ? `
                    <img
                        src="${escapeHTML(
                            avatarUrl
                        )}"
                        alt=""
                        loading="lazy"
                    >
                `
                : initials(
                    senderName
                );

        const owner =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );

        const canDelete =
            owner ||
            can("moderate");

        const reactionHTML =
            renderMessageReactions(
                message.id
            );

        const replyHTML =
            message.parent_message_id
                ? `
                    <div class="message-reply-reference">
                        ↩ Reply
                    </div>
                `
                : "";

        return `
            <article
                class="message ${
                    message.is_pinned
                        ? "message-pinned"
                        : ""
                }"
                data-message-id="${escapeHTML(
                    message.id
                )}"
            >

                <div class="message-avatar">
                    ${avatar}
                </div>

                <div class="message-body">

                    <div class="message-meta">

                        <span class="message-author">
                            ${escapeHTML(
                                senderName
                            )}
                        </span>

                        <span class="message-time">
                            ${escapeHTML(
                                timestamp
                            )}
                        </span>

                        ${
                            message.is_pinned
                                ? `
                                    <span class="message-pin-badge">
                                        📌 Pinned
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    ${replyHTML}

                    <div class="message-content">
                        ${escapeHTML(
                            message.content || ""
                        )}
                    </div>

                    <div class="message-actions">

                        ${
                            can("react")
                                ? `
                                    <button
                                        type="button"
                                        class="message-action"
                                        data-action="react"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                        data-reaction="👍"
                                    >
                                        👍
                                    </button>

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-action="react"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                        data-reaction="❤️"
                                    >
                                        ❤️
                                    </button>

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-action="react"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                        data-reaction="🎓"
                                    >
                                        🎓
                                    </button>
                                `
                                : ""
                        }

                        <button
                            type="button"
                            class="message-action"
                            data-action="reply"
                            data-message-id="${escapeHTML(
                                message.id
                            )}"
                        >
                            ↩ Reply
                        </button>

                        ${
                            canDelete
                                ? `
                                    <button
                                        type="button"
                                        class="message-action"
                                        data-action="delete"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                    >
                                        Delete
                                    </button>
                                `
                                : ""
                        }

                    </div>

                    ${reactionHTML}

                </div>

            </article>
        `;
    }


    function renderMessageReactions(
        messageId
    ) {

        const reactions =
            state.reactions.filter(
                reaction =>
                    String(
                        reaction.message_id
                    ) ===
                    String(
                        messageId
                    )
            );

        if (!reactions.length) {
            return "";
        }

        const groups =
            new Map();

        reactions.forEach(
            reaction => {

                const key =
                    reaction.reaction ||
                    "👍";

                if (
                    !groups.has(key)
                ) {

                    groups.set(
                        key,
                        []
                    );
                }

                groups
                    .get(key)
                    .push(
                        reaction
                    );
            }
        );

        return `
            <div class="message-reactions">

                ${
                    Array.from(
                        groups.entries()
                    )
                        .map(
                            ([reaction, items]) => {

                                const mine =
                                    items.some(
                                        item =>
                                            String(
                                                item.user_id
                                            ) ===
                                            String(
                                                state.user?.id
                                            )
                                    );

                                return `
                                    <button
                                        type="button"
                                        class="message-reaction ${
                                            mine
                                                ? "active"
                                                : ""
                                        }"
                                        data-action="react"
                                        data-message-id="${escapeHTML(
                                            messageId
                                        )}"
                                        data-reaction="${escapeHTML(
                                            reaction
                                        )}"
                                    >
                                        ${escapeHTML(
                                            reaction
                                        )}
                                        ${items.length}
                                    </button>
                                `;
                            }
                        )
                        .join("")
                }

            </div>
        `;
    }


    function formatDateTime(
        value
    ) {

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

        return date.toLocaleString(
            [],
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );
    }


    /* =====================================================
       MEMBER RESOLUTION
    ====================================================== */

    function resolveMember(
        userId
    ) {

        if (!userId) {
            return null;
        }

        return (
            state.members.find(
                member =>
                    String(
                        getUserId(member)
                    ) ===
                    String(
                        userId
                    )
            ) ||
            null
        );
    }


    /* =====================================================
       SEND MESSAGE
    ====================================================== */

    async function sendMessage() {

        if (!can("send")) {

            showToast(
                "You do not have permission to send messages.",
                "error"
            );

            return;
        }

        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }

        const input =
            getElement(
                "messageInput"
            );

        if (!input) {
            return;
        }

        const content =
            input.value.trim();

        if (!content) {
            return;
        }

        if (
            content.length >
            5000
        ) {

            showToast(
                "Message is too long.",
                "error"
            );

            return;
        }

        const sendButton =
            getElement(
                "sendMessageButton"
            );

        if (sendButton) {
            sendButton.disabled = true;
        }

        try {

            const payload = {

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text",

                is_edited:
                    false,

                is_deleted:
                    false,

                is_pinned:
                    false
            };

            if (
                state.currentReplyMessage
            ) {

                payload.parent_message_id =
                    state.currentReplyMessage.id;
            }

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_messages"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            input.value = "";

            autoResizeTextarea(
                input
            );

            clearReply();

            if (data) {

                const exists =
                    state.messages.some(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                data.id
                            )
                    );

                if (!exists) {

                    state.messages.push(
                        data
                    );

                    renderMessages();
                }
            }

        } catch (error) {

            console.error(
                "❌ Message send failed:",
                error
            );

            showToast(
                error.message ||
                "Unable to send message.",
                "error"
            );

        } finally {

            applyPermissionUI();
        }
    }


    /* =====================================================
       DELETE MESSAGE
    ====================================================== */

    async function deleteMessage(
        messageId
    ) {

        const message =
            state.messages.find(
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

        const owner =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );

        if (
            !owner &&
            !can("moderate")
        ) {

            showToast(
                "You cannot delete this message.",
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
             * Soft delete first because the real schema
             * explicitly supports is_deleted/deleted_at.
             */

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_messages"
                    )
                    .update({
                        is_deleted:
                            true,

                        deleted_at:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "id",
                        messageId
                    )
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            state.messages =
                state.messages.filter(
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
                "Message deleted."
            );

        } catch (error) {

            console.error(
                "❌ Message deletion failed:",
                error
            );

            showToast(
                "Unable to delete message.",
                "error"
            );
        }
    }


    /* =====================================================
       REPLY
    ====================================================== */

    function setReplyMessage(
        messageId
    ) {

        const message =
            state.messages.find(
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

        state.currentReplyMessage =
            message;

        const preview =
            getElement(
                "replyPreview"
            );

        const text =
            getElement(
                "replyPreviewText"
            );

        if (preview) {

            preview.classList.remove(
                "hidden"
            );
        }

        if (text) {

            text.textContent =
                message.content ||
                "";
        }

        getElement(
            "messageInput"
        )?.focus();
    }


    function clearReply() {

        state.currentReplyMessage =
            null;

        const preview =
            getElement(
                "replyPreview"
            );

        if (preview) {

            preview.classList.add(
                "hidden"
            );
        }

        const text =
            getElement(
                "replyPreviewText"
            );

        if (text) {

            text.textContent = "";
        }
    }


    /* =====================================================
       REACTIONS
    ====================================================== */

    async function toggleReaction(
        messageId,
        reaction
    ) {

        if (
            !state.user ||
            !messageId ||
            !reaction ||
            !can("react")
        ) {
            return;
        }

        try {

            const {
                data: existing,
                error: lookupError
            } =
                await supabaseClient
                    .from(
                        "chat_message_reactions"
                    )
                    .select(
                        "id"
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

            if (lookupError) {
                throw lookupError;
            }

            if (existing) {

                const {
                    error
                } =
                    await supabaseClient
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
                    await supabaseClient
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

            await loadReactions();

        } catch (error) {

            console.error(
                "❌ Reaction update failed:",
                error
            );

            showToast(
                "Unable to update reaction.",
                "error"
            );
        }
    }


    /* =====================================================
       LOAD MEMBERS
    ====================================================== */

    async function loadMembers() {

        if (!state.currentCommunity) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_community_members"
                    )
                    .select("*")
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )
                    .eq(
                        "is_banned",
                        false
                    );

            if (error) {
                throw error;
            }

            state.members =
                Array.isArray(data)
                    ? data
                    : [];

            await enrichMembers();

            await loadPresence();

            renderMembers();

        } catch (error) {

            console.error(
                "❌ Failed to load community members:",
                error
            );

            state.members = [];

            renderMembers();
        }
    }


    async function enrichMembers() {

        const ids =
            state.members
                .map(
                    member =>
                        getUserId(member)
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
                await supabaseClient
                    .from(
                        "students"
                    )
                    .select("*")
                    .in(
                        "id",
                        ids
                    );

            if (error) {
                throw error;
            }

            const profiles =
                Array.isArray(data)
                    ? data
                    : [];

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
                state.members.map(
                    member => {

                        const userId =
                            getUserId(
                                member
                            );

                        const profile =
                            profileMap.get(
                                String(
                                    userId
                                )
                            );

                        if (!profile) {
                            return member;
                        }

                        return {
                            ...profile,
                            ...member,
                            _profile:
                                profile
                        };
                    }
                );

        } catch (error) {

            console.warn(
                "⚠️ Student profile enrichment unavailable:",
                error
            );
        }
    }


    /* =====================================================
       PRESENCE
    ====================================================== */

    async function loadPresence() {

        const ids =
            state.members
                .map(
                    member =>
                        getUserId(member)
                )
                .filter(Boolean);

        if (!ids.length) {

            state.presences = [];

            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_presence"
                    )
                    .select("*")
                    .in(
                        "user_id",
                        ids
                    );

            if (error) {
                throw error;
            }

            state.presences =
                Array.isArray(data)
                    ? data
                    : [];

            renderMembers();

        } catch (error) {

            console.warn(
                "⚠️ Presence lookup unavailable:",
                error
            );
        }
    }


    function getPresenceStatus(
        userId
    ) {

        const record =
            state.presences.find(
                item =>
                    String(
                        item.user_id
                    ) ===
                    String(
                        userId
                    )
            );

        return (
            record?.status ||
            "offline"
        );
    }


    /* =====================================================
       RENDER MEMBERS
    ====================================================== */

    function renderMembers() {

        const container =
            getElement(
                "memberList"
            );

        const count =
            getElement(
                "memberCount"
            );

        if (!container) {
            return;
        }

        const search =
            state.memberSearch
                .trim()
                .toLowerCase();

        const filtered =
            state.members.filter(
                member => {

                    if (!search) {
                        return true;
                    }

                    const name =
                        getDisplayName(
                            member
                        )
                            .toLowerCase();

                    const role =
                        roleLabel(
                            member.role
                        )
                            .toLowerCase();

                    return (
                        name.includes(
                            search
                        ) ||
                        role.includes(
                            search
                        )
                    );
                }
            );

        if (count) {

            count.textContent =
                `${state.members.length} ${
                    state.members.length === 1
                        ? "member"
                        : "members"
                }`;
        }

        if (!filtered.length) {

            container.innerHTML = `
                <div class="member-empty">
                    No members found.
                </div>
            `;

            return;
        }

        const roleOrder = {

            super_admin: 1,
            admin: 2,
            moderator: 3,
            tutor: 4,
            student: 5

        };

        const sorted =
            [...filtered].sort(
                (a, b) => {

                    const aRole =
                        roleOrder[
                            normalizeRole(
                                a.role
                            )
                        ] || 99;

                    const bRole =
                        roleOrder[
                            normalizeRole(
                                b.role
                            )
                        ] || 99;

                    if (
                        aRole !==
                        bRole
                    ) {

                        return (
                            aRole -
                            bRole
                        );
                    }

                    return getDisplayName(
                        a
                    ).localeCompare(
                        getDisplayName(
                            b
                        )
                    );
                }
            );

        container.innerHTML =
            sorted
                .map(
                    renderMember
                )
                .join("");
    }


    function renderMember(
        member
    ) {

        const userId =
            getUserId(
                member
            );

        const name =
            getDisplayName(
                member
            );

        const role =
            roleLabel(
                member.role
            );

        const avatarUrl =
            member.photo_url ||
            member.avatar_url ||
            member._profile?.photo_url ||
            null;

        const status =
            getPresenceStatus(
                userId
            );

        const avatar =
            avatarUrl
                ? `
                    <img
                        src="${escapeHTML(
                            avatarUrl
                        )}"
                        alt=""
                        loading="lazy"
                    >
                `
                : initials(
                    name
                );

        return `
            <div
                class="member-row"
                data-user-id="${escapeHTML(
                    userId || ""
                )}"
            >

                <div class="member-avatar">

                    ${avatar}

                    <span
                        class="presence-dot presence-${escapeHTML(
                            status
                        )}"
                        data-presence-user="${escapeHTML(
                            userId || ""
                        )}"
                        title="${escapeHTML(
                            status
                        )}"
                    ></span>

                </div>

                <div class="member-info">

                    <span class="member-name">
                        ${escapeHTML(
                            name
                        )}
                    </span>

                    <span class="member-role">
                        ${escapeHTML(
                            role
                        )}
                    </span>

                </div>

            </div>
        `;
    }


    /* =====================================================
       COMMUNITY CREATION
    ====================================================== */

    async function createCommunity(
        event
    ) {

        event.preventDefault();

        if (!can("createCommunity")) {

            showToast(
                "Only admins can create communities.",
                "error"
            );

            return;
        }

        if (!state.user) {
            return;
        }

        const name =
            getElement(
                "communityNameInput"
            )?.value.trim();

        const description =
            getElement(
                "communityDescriptionInput"
            )?.value.trim();

        const icon =
            getElement(
                "communityIconInput"
            )?.value.trim();

        const message =
            getElement(
                "communityFormMessage"
            );

        if (!name) {

            if (message) {

                message.textContent =
                    "Community name is required.";
            }

            return;
        }

        const slug =
            createUniqueSlug(
                name
            );

        try {

            /*
             * ONLY REAL chat_communities columns.
             */

            const payload = {

                name,

                slug,

                description:
                    description ||
                    null,

                icon_url:
                    icon ||
                    null,

                is_public:
                    true,

                is_active:
                    true,

                created_by:
                    state.user.id
            };

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_communities"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            if (data?.id) {

                await supabaseClient
                    .from(
                        "chat_community_members"
                    )
                    .insert({
                        community_id:
                            data.id,

                        user_id:
                            state.user.id,

                        role:
                            "super_admin"
                    });
            }

            closeCommunityModal();

            await loadCommunities();

            if (data?.id) {

                await switchCommunity(
                    data.id
                );
            }

            showToast(
                "Community created successfully."
            );

        } catch (error) {

            console.error(
                "❌ Community creation failed:",
                error
            );

            if (message) {

                message.textContent =
                    error.message ||
                    "Unable to create community.";
            }

            showToast(
                "Unable to create community.",
                "error"
            );
        }
    }


    /* =====================================================
       CHANNEL CREATION
    ====================================================== */

    async function createChannel(
        event
    ) {

        event.preventDefault();

        if (!can("createChannel")) {

            showToast(
                "You do not have permission to create channels.",
                "error"
            );

            return;
        }

        if (
            !state.currentCommunity ||
            !state.user
        ) {
            return;
        }

        const name =
            getElement(
                "channelNameInput"
            )?.value.trim();

        const description =
            getElement(
                "channelDescriptionInput"
            )?.value.trim();

        const visibility =
            getElement(
                "channelVisibilitySelect"
            )?.value ||
            "public";

        const courseId =
            getElement(
                "channelCourseSelect"
            )?.value ||
            null;

        const message =
            getElement(
                "channelFormMessage"
            );

        if (!name) {

            if (message) {

                message.textContent =
                    "Channel name is required.";
            }

            return;
        }

        const slug =
            createChannelSlug(
                name
            );

        /*
         * Determine actual database channel_type.
         */

        let channelType =
            "text";

        if (courseId) {

            channelType =
                "course";
        }

        try {

            /*
             * ONLY REAL chat_channels columns.
             */

            const payload = {

                community_id:
                    state.currentCommunity.id,

                name:
                    slug,

                slug,

                description:
                    description ||
                    null,

                channel_type:
                    channelType,

                icon:
                    courseId
                        ? "🎓"
                        : "#",

                position:
                    state.channels.length,

                is_private:
                    visibility ===
                    "private",

                is_archived:
                    false,

                is_active:
                    true,

                course_id:
                    courseId
                        ? Number(courseId)
                        : null,

                unit_id:
                    null,

                created_by:
                    state.user.id
            };

            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_channels"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();

            if (error) {
                throw error;
            }

            if (
                data?.id &&
                visibility ===
                "private"
            ) {

                await addChannelMember(
                    data.id,
                    state.user.id
                );
            }

            closeChannelModal();

            await loadChannels();

            if (data?.id) {

                await selectChannel(
                    data.id
                );
            }

            showToast(
                "Channel created successfully."
            );

        } catch (error) {

            console.error(
                "❌ Channel creation failed:",
                error
            );

            if (message) {

                message.textContent =
                    error.message ||
                    "Unable to create channel.";
            }

            showToast(
                "Unable to create channel.",
                "error"
            );
        }
    }


    async function addChannelMember(
        channelId,
        userId
    ) {

        try {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "chat_channel_members"
                    )
                    .insert({
                        channel_id:
                            channelId,

                        user_id:
                            userId
                    });

            if (error) {

                console.warn(
                    "⚠️ Channel membership failed:",
                    error
                );
            }

        } catch (error) {

            console.warn(
                "⚠️ Channel membership failed:",
                error
            );
        }
    }


    /* =====================================================
       SLUG HELPERS
    ====================================================== */

    function createChannelSlug(
        value
    ) {

        const slug =
            String(
                value || "channel"
            )
                .toLowerCase()
                .trim()
                .replace(
                    /\s+/g,
                    "-"
                )
                .replace(
                    /[^a-z0-9-_]/g,
                    ""
                );

        return (
            slug ||
            `channel-${Date.now()}`
        );
    }


    function createUniqueSlug(
        value
    ) {

        const base =
            String(
                value || "community"
            )
                .toLowerCase()
                .trim()
                .replace(
                    /\s+/g,
                    "-"
                )
                .replace(
                    /[^a-z0-9-_]/g,
                    ""
                );

        return (
            base ||
            `community-${Date.now()}`
        );
    }


    /* =====================================================
       READ STATUS
    ====================================================== */

    async function markChannelRead() {

        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }

        try {

            /*
             * The actual schema has:
             *
             * channel_id
             * user_id
             * last_read_message_id
             * last_read_at
             */

            const lastMessage =
                state.messages[
                    state.messages.length - 1
                ];

            const payload = {

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                last_read_message_id:
                    lastMessage?.id ||
                    null,

                last_read_at:
                    new Date()
                        .toISOString()
            };

            const {
                error
            } =
                await supabaseClient
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

                console.warn(
                    "⚠️ Read status update unavailable:",
                    error
                );
            }

        } catch (error) {

            console.warn(
                "⚠️ Read status error:",
                error
            );
        }
    }


    /* =====================================================
       REALTIME — COMMUNITY
    ====================================================== */

    function setupCommunityRealtime() {

        if (
            state.communityRealtimeChannel
        ) {

            try {

                supabaseClient
                    .removeChannel(
                        state.communityRealtimeChannel
                    );

            } catch (_) {}
        }

        if (!state.currentCommunity) {
            return;
        }

        state.communityRealtimeChannel =
            supabaseClient
                .channel(
                    `community-${state.currentCommunity.id}`
                )

                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
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
                        event: "UPDATE",
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
                        event: "DELETE",
                        schema: "public",
                        table: "chat_channels",
                        filter:
                            `community_id=eq.${state.currentCommunity.id}`
                    },
                    async () => {

                        await loadChannels();
                    }
                )

                .subscribe(
                    status => {

                        console.log(
                            "📡 Community realtime:",
                            status
                        );
                    }
                );
    }


    /* =====================================================
       REALTIME — CHANNEL MESSAGES
    ====================================================== */

    function setupChannelRealtime() {

        if (
            state.messageRealtimeChannel
        ) {

            try {

                supabaseClient
                    .removeChannel(
                        state.messageRealtimeChannel
                    );

            } catch (_) {}
        }

        if (!state.currentChannel) {
            return;
        }

        const channelId =
            state.currentChannel.id;

        state.messageRealtimeChannel =
            supabaseClient
                .channel(
                    `messages-${channelId}`
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

                        const incoming =
                            payload.new;

                        if (!incoming) {
                            return;
                        }

                        if (
                            incoming.is_deleted
                        ) {
                            return;
                        }

                        const exists =
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        incoming.id
                                    )
                            );

                        if (!exists) {

                            state.messages.push(
                                incoming
                            );

                            renderMessages();

                            if (
                                incoming.user_id !==
                                state.user?.id
                            ) {

                                await markChannelRead();
                            }
                        }
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
                    payload => {

                        const updated =
                            payload.new;

                        if (!updated) {
                            return;
                        }

                        state.messages =
                            state.messages.map(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        updated.id
                                    )
                                        ? updated
                                        : message
                            );

                        state.messages =
                            state.messages.filter(
                                message =>
                                    !message.is_deleted
                            );

                        renderMessages();
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
                    payload => {

                        const deletedId =
                            payload.old?.id;

                        if (!deletedId) {
                            return;
                        }

                        state.messages =
                            state.messages.filter(
                                message =>
                                    String(
                                        message.id
                                    ) !==
                                    String(
                                        deletedId
                                    )
                            );

                        renderMessages();
                    }
                )

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_message_reactions"
                    },
                    async payload => {

                        const messageId =
                            payload.new?.message_id ||
                            payload.old?.message_id;

                        if (!messageId) {
                            return;
                        }

                        const belongs =
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        messageId
                                    )
                            );

                        if (!belongs) {
                            return;
                        }

                        await loadReactions();
                    }
                )

                .subscribe(
                    status => {

                        console.log(
                            "📡 Channel realtime:",
                            status
                        );
                    }
                );
    }


    /* =====================================================
       PRESENCE DATABASE
    ====================================================== */

    async function updatePresence(
        status = "online"
    ) {

        if (!state.user) {
            return;
        }

        try {

            const now =
                new Date()
                    .toISOString();

            /*
             * Actual chat_presence schema:
             *
             * user_id
             * status
             * custom_status
             * last_seen_at
             * updated_at
             */

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "chat_presence"
                    )
                    .upsert(
                        {
                            user_id:
                                state.user.id,

                            status,

                            last_seen_at:
                                now,

                            updated_at:
                                now
                        },
                        {
                            onConflict:
                                "user_id"
                        }
                    );

            if (error) {

                console.warn(
                    "⚠️ Presence update unavailable:",
                    error
                );
            }

            await loadPresence();

        } catch (error) {

            console.warn(
                "⚠️ Presence error:",
                error
            );
        }
    }


    function setupPresenceRealtime() {

        if (
            state.presenceRealtimeChannel
        ) {

            try {

                supabaseClient
                    .removeChannel(
                        state.presenceRealtimeChannel
                    );

            } catch (_) {}
        }

        state.presenceRealtimeChannel =
            supabaseClient
                .channel(
                    `presence-db-${state.currentCommunity?.id || "community"}`
                )

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_presence"
                    },
                    async () => {

                        await loadPresence();
                    }
                )

                .subscribe(
                    status => {

                        console.log(
                            "🟢 Presence realtime:",
                            status
                        );
                    }
                );
    }


    /* =====================================================
       MESSAGE SEARCH
    ====================================================== */

    function toggleMessageSearch() {

        const panel =
            getElement(
                "messageSearchPanel"
            );

        if (!panel) {
            return;
        }

        panel.classList.toggle(
            "hidden"
        );

        if (
            !panel.classList.contains(
                "hidden"
            )
        ) {

            getElement(
                "messageSearchInput"
            )?.focus();

        } else {

            state.messageSearch =
                "";

            const input =
                getElement(
                    "messageSearchInput"
                );

            if (input) {
                input.value = "";
            }

            renderMessages();
        }
    }


    /* =====================================================
       COMMUNITY MENU
    ====================================================== */

    function toggleCommunityMenu() {

        const menu =
            getElement(
                "communityMenu"
            );

        if (!menu) {
            return;
        }

        if (
            !menu.classList.contains(
                "hidden"
            )
        ) {

            closeCommunityMenu();

            return;
        }

        const button =
            getElement(
                "communityMenuButton"
            );

        const rect =
            button?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        menu.style.top =
            `${rect.bottom + 5}px`;

        menu.style.left =
            `${Math.max(
                10,
                rect.right - 195
            )}px`;

        menu.classList.remove(
            "hidden"
        );
    }


    function closeCommunityMenu() {

        getElement(
            "communityMenu"
        )?.classList.add(
            "hidden"
        );
    }


    /* =====================================================
       MODALS
    ====================================================== */

    function openCommunityModal() {

        if (!can("createCommunity")) {

            showToast(
                "Only admins can create communities.",
                "error"
            );

            return;
        }

        const modal =
            getElement(
                "communityModal"
            );

        modal?.classList.remove(
            "hidden"
        );

        getElement(
            "communityNameInput"
        )?.focus();
    }


    function closeCommunityModal() {

        getElement(
            "communityModal"
        )?.classList.add(
            "hidden"
        );

        getElement(
            "communityForm"
        )?.reset();

        const message =
            getElement(
                "communityFormMessage"
            );

        if (message) {
            message.textContent = "";
        }
    }


    function openChannelModal() {

        if (!can("createChannel")) {

            showToast(
                "You do not have permission to create channels.",
                "error"
            );

            return;
        }

        if (!state.currentCommunity) {

            showToast(
                "Select a community first.",
                "error"
            );

            return;
        }

        getElement(
            "channelModal"
        )?.classList.remove(
            "hidden"
        );

        getElement(
            "channelNameInput"
        )?.focus();
    }


    function closeChannelModal() {

        getElement(
            "channelModal"
        )?.classList.add(
            "hidden"
        );

        getElement(
            "channelForm"
        )?.reset();

        const message =
            getElement(
                "channelFormMessage"
            );

        if (message) {
            message.textContent = "";
        }
    }


    /* =====================================================
       TEXTAREA
    ====================================================== */

    function autoResizeTextarea(
        textarea
    ) {

        if (!textarea) {
            return;
        }

        textarea.style.height =
            "auto";

        textarea.style.height =
            `${Math.min(
                textarea.scrollHeight,
                150
            )}px`;
    }


    /* =====================================================
       MOBILE
    ====================================================== */

    function setupMobileControls() {

        const sidebar =
            $(".channel-sidebar");

        if (!sidebar) {
            return;
        }

        const header =
            $(".community-header");

        header?.addEventListener(
            "dblclick",
            () => {

                if (
                    window.innerWidth <=
                    760
                ) {

                    sidebar.classList.toggle(
                        "mobile-open"
                    );
                }
            }
        );

        window.addEventListener(
            "resize",
            () => {

                if (
                    window.innerWidth >
                    760
                ) {

                    sidebar.classList.remove(
                        "mobile-open"
                    );
                }
            }
        );
    }


    /* =====================================================
       EVENT LISTENERS
    ====================================================== */

    function setupEventListeners() {

        getElement(
            "createCommunityButton"
        )?.addEventListener(
            "click",
            openCommunityModal
        );

        getElement(
            "communityForm"
        )?.addEventListener(
            "submit",
            createCommunity
        );

        getElement(
            "closeCommunityModalButton"
        )?.addEventListener(
            "click",
            closeCommunityModal
        );

        getElement(
            "cancelCommunityButton"
        )?.addEventListener(
            "click",
            closeCommunityModal
        );


        getElement(
            "createChannelButton"
        )?.addEventListener(
            "click",
            openChannelModal
        );

        getElement(
            "channelForm"
        )?.addEventListener(
            "submit",
            createChannel
        );

        getElement(
            "closeChannelModalButton"
        )?.addEventListener(
            "click",
            closeChannelModal
        );

        getElement(
            "cancelChannelButton"
        )?.addEventListener(
            "click",
            closeChannelModal
        );


        getElement(
            "communityMenuButton"
        )?.addEventListener(
            "click",
            toggleCommunityMenu
        );


        getElement(
            "communityMenuCreateChannel"
        )?.addEventListener(
            "click",
            () => {

                closeCommunityMenu();

                openChannelModal();
            }
        );


        getElement(
            "communityMenuCreateCommunity"
        )?.addEventListener(
            "click",
            () => {

                closeCommunityMenu();

                openCommunityModal();
            }
        );


        getElement(
            "communityMenuRefresh"
        )?.addEventListener(
            "click",
            async () => {

                closeCommunityMenu();

                await loadCommunities();

                if (
                    state.currentCommunity
                ) {

                    await switchCommunity(
                        state.currentCommunity.id
                    );
                }

                showToast(
                    "Community refreshed."
                );
            }
        );


        getElement(
            "messageForm"
        )?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await sendMessage();
            }
        );


        getElement(
            "messageInput"
        )?.addEventListener(
            "input",
            event => {

                autoResizeTextarea(
                    event.target
                );
            }
        );


        getElement(
            "messageInput"
        )?.addEventListener(
            "keydown",
            async event => {

                if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    await sendMessage();
                }
            }
        );


        getElement(
            "cancelReplyButton"
        )?.addEventListener(
            "click",
            clearReply
        );


        getElement(
            "memberToggleButton"
        )?.addEventListener(
            "click",
            () => {

                getElement(
                    "memberSidebar"
                )?.classList.toggle(
                    "open"
                );
            }
        );


        getElement(
            "closeMemberSidebarButton"
        )?.addEventListener(
            "click",
            () => {

                getElement(
                    "memberSidebar"
                )?.classList.remove(
                    "open"
                );
            }
        );


        getElement(
            "memberSearchInput"
        )?.addEventListener(
            "input",
            event => {

                state.memberSearch =
                    event.target.value;

                renderMembers();
            }
        );


        getElement(
            "channelSearchInput"
        )?.addEventListener(
            "input",
            event => {

                state.channelSearch =
                    event.target.value;

                renderChannels();
            }
        );


        getElement(
            "chatSearchButton"
        )?.addEventListener(
            "click",
            toggleMessageSearch
        );


        getElement(
            "closeMessageSearchButton"
        )?.addEventListener(
            "click",
            toggleMessageSearch
        );


        getElement(
            "messageSearchInput"
        )?.addEventListener(
            "input",
            event => {

                state.messageSearch =
                    event.target.value;

                renderMessages();
            }
        );


        getElement(
            "attachmentButton"
        )?.addEventListener(
            "click",
            () => {

                showToast(
                    "Attachments will be connected to the existing Supabase attachment system next."
                );
            }
        );


        document.addEventListener(
            "click",
            event => {

                const menu =
                    getElement(
                        "communityMenu"
                    );

                const button =
                    getElement(
                        "communityMenuButton"
                    );

                if (
                    menu &&
                    !menu.classList.contains(
                        "hidden"
                    ) &&
                    !menu.contains(
                        event.target
                    ) &&
                    !button?.contains(
                        event.target
                    )
                ) {

                    closeCommunityMenu();
                }
            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                closeCommunityMenu();

                closeCommunityModal();

                closeChannelModal();

                clearReply();
            }
        );


        getElement(
            "communityModal"
        )?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    event.currentTarget
                ) {

                    closeCommunityModal();
                }
            }
        );


        getElement(
            "channelModal"
        )?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    event.currentTarget
                ) {

                    closeChannelModal();
                }
            }
        );
    }


    /* =====================================================
       INITIAL COMMUNITY
    ====================================================== */

    async function selectInitialCommunity() {

        if (!state.communities.length) {

            renderActiveCommunity();

            renderEmptyChannelState();

            return;
        }

        const stored =
            localStorage.getItem(
                "mwanikiCommunityId"
            );

        let selected =
            state.communities.find(
                community =>
                    stored &&
                    String(
                        community.id
                    ) ===
                    String(
                        stored
                    )
            );

        if (!selected) {

            /*
             * Mwaniki Scholars official community
             * is preferred.
             */

            selected =
                state.communities.find(
                    community =>
                        community.slug ===
                        "mwaniki-scholars"
                );
        }

        if (!selected) {

            selected =
                state.communities[0];
        }

        await switchCommunity(
            selected.id
        );
    }


    /* =====================================================
       CLEANUP
    ====================================================== */

    function cleanupRealtime() {

        const channels = [

            state.communityRealtimeChannel,

            state.messageRealtimeChannel,

            state.presenceRealtimeChannel

        ];

        channels.forEach(
            channel => {

                if (!channel) {
                    return;
                }

                try {

                    supabaseClient
                        .removeChannel(
                            channel
                        );

                } catch (_) {}
            }
        );

        state.communityRealtimeChannel =
            null;

        state.messageRealtimeChannel =
            null;

        state.presenceRealtimeChannel =
            null;
    }


    /* =====================================================
       INITIALIZATION
    ====================================================== */

    let initialized =
        false;

    async function initializeCommunity() {

        if (initialized) {
            return;
        }

        initialized = true;

        console.log(
            "🚀 Initializing Mwaniki Community..."
        );

        state.user =
            await getAuthenticatedUser();

        if (!state.user) {

            console.warn(
                "⚠️ No authenticated user."
            );

            window.location.href =
                "index.html";

            return;
        }

        console.log(
            "🔐 Community authenticated user:",
            state.user.email
        );

        await loadCurrentProfile();

        await loadCourses();

        await loadCommunities();

        await selectInitialCommunity();

        await updatePresence(
            "online"
        );

        applyPermissionUI();

        setupEventListeners();

        setupMobileControls();

        /*
         * Presence heartbeat every minute.
         */

        state.presenceHeartbeat =
            setInterval(
                () => {

                    updatePresence(
                        "online"
                    );

                },
                60000
            );

        /*
         * Mark offline when leaving.
         */

        window.addEventListener(
            "beforeunload",
            () => {

                updatePresence(
                    "offline"
                );
            }
        );

        console.log(
            "✅ Mwaniki Community Phase 3 ready."
        );
    }


    /* =====================================================
       AUTH STATE
    ====================================================== */

    supabaseClient.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            console.log(
                "🔐 Community auth state:",
                event
            );

            if (
                event ===
                "SIGNED_OUT"
            ) {

                cleanupRealtime();

                window.location.href =
                    "index.html";

                return;
            }

            if (
                session?.user &&
                !state.user
            ) {

                await initializeCommunity();
            }
        }
    );


    /* =====================================================
       START
    ====================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeCommunity,
            {
                once: true
            }
        );

    } else {

        initializeCommunity();
    }

})();
