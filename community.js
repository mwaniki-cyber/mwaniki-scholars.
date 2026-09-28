/* =========================================================
   MWANIKI SCHOLARS
   MWANIKI COMMUNITY — PHASE 3 ENGINE

   Features:
   - Multiple communities
   - Community switching
   - Course-linked communities
   - Course-linked channels
   - Channel categories
   - Public/private channels
   - Student/Tutor/Moderator/Admin/Super Admin permissions
   - Permission-aware controls
   - Channel creation
   - Community creation
   - Realtime messages
   - Member loading
   - Message search
   - Existing Phase 2 chat compatibility

   IMPORTANT:
   This file is isolated from dashboard.js,
   Mwaniki AI and Turbo AI.
========================================================= */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Community Phase 3 engine loaded");


    /* =====================================================
       SUPABASE
    ====================================================== */

    const supabaseClient =
        window.supabaseClient ||
        window.supabase ||
        null;

    if (!supabaseClient) {
        console.error(
            "❌ Supabase client was not found. Make sure supabase.js loads first."
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

        messages: [],

        reactions: [],

        currentCommunity: null,

        currentChannel: null,

        currentRole: "student",

        currentReplyMessage: null,

        realtimeChannel: null,

        presenceChannel: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        collapsedCategories: new Set(),

        loading: false

    };


    /* =====================================================
       DOM HELPERS
    ====================================================== */

    const $ = (selector) =>
        document.querySelector(selector);

    const $$ = (selector) =>
        Array.from(document.querySelectorAll(selector));


    function getElement(id) {
        return document.getElementById(id);
    }


    /* =====================================================
       TOAST
    ====================================================== */

    let toastTimer = null;

    function showToast(message, type = "normal") {

        const toast = getElement("communityToast");

        if (!toast) return;

        toast.textContent = message;

        toast.dataset.type = type;

        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }


    /* =====================================================
       TEXT HELPERS
    ====================================================== */

    function escapeHTML(value) {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function initials(name) {

        const text =
            String(name || "Student")
                .trim();

        if (!text) return "S";

        const parts =
            text.split(/\s+/)
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
            "Student"
        );
    }


    function getUserId(record) {

        if (!record) return null;

        return (
            record.user_id ||
            record.userId ||
            record.id ||
            record.uid ||
            null
        );
    }


    function getCommunityCourseId(community) {

        if (!community) return null;

        return (
            community.course_id ??
            community.courseId ??
            null
        );
    }


    function getChannelCourseId(channel) {

        if (!channel) return null;

        return (
            channel.course_id ??
            channel.courseId ??
            null
        );
    }


    function getChannelVisibility(channel) {

        if (!channel) return "public";

        if (
            channel.is_private === true ||
            channel.private === true
        ) {
            return "private";
        }

        const visibility =
            String(
                channel.visibility ||
                channel.channel_visibility ||
                "public"
            ).toLowerCase();

        return visibility === "private"
            ? "private"
            : "public";
    }


    function getChannelCategory(channel) {

        if (!channel) {
            return "General";
        }

        return (
            channel.category ||
            channel.category_name ||
            channel.categoryName ||
            channel.section ||
            "General"
        );
    }


    function normalizeRole(role) {

        const value =
            String(role || "student")
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

        switch (normalizeRole(role)) {

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
            normalizeRole(state.currentRole);

        return Boolean(
            permissions[role] &&
            permissions[role][permission]
        );
    }


    function applyPermissionUI() {

        const createChannelButton =
            getElement("createChannelButton");

        const createCommunityButton =
            getElement("createCommunityButton");

        const communityMenuCreateChannel =
            getElement("communityMenuCreateChannel");

        const communityMenuCreateCommunity =
            getElement("communityMenuCreateCommunity");

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

        if (communityMenuCreateChannel) {
            communityMenuCreateChannel.style.display =
                can("createChannel")
                    ? "block"
                    : "none";
        }

        if (communityMenuCreateCommunity) {
            communityMenuCreateCommunity.style.display =
                can("createCommunity")
                    ? "block"
                    : "none";
        }

        const badge =
            getElement("activeRoleBadge");

        if (badge) {
            badge.textContent =
                roleLabel(state.currentRole);
        }

        const messageInput =
            getElement("messageInput");

        const sendButton =
            getElement("sendMessageButton");

        if (messageInput) {

            messageInput.disabled =
                !can("send");

            messageInput.placeholder =
                can("send")
                    ? `Message #${state.currentChannel?.name || "channel"}`
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

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();

        if (error) {
            console.error(
                "❌ Unable to retrieve authenticated user:",
                error
            );
            return null;
        }

        return data?.user || null;
    }


    /* =====================================================
       PROFILE
    ====================================================== */

    async function loadCurrentProfile() {

        if (!state.user) {
            return;
        }

        const possibleTables = [
            "students",
            "profiles"
        ];

        for (const table of possibleTables) {

            try {

                const {
                    data,
                    error
                } = await supabaseClient
                    .from(table)
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

                if (!error && data) {

                    state.profile = data;

                    return;
                }

            } catch (error) {

                console.warn(
                    `⚠️ Profile lookup failed for ${table}:`,
                    error
                );
            }
        }
    }


    /* =====================================================
       LOAD COURSES
    ====================================================== */

    async function loadCourses() {

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("courses")
                .select("id,title")
                .order("title", {
                    ascending: true
                });

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
            getElement("communityCourseSelect");

        const channelSelect =
            getElement("channelCourseSelect");

        if (communitySelect) {

            communitySelect.innerHTML =
                `<option value="">
                    General Community
                </option>` +
                state.courses
                    .map(course => `
                        <option value="${escapeHTML(course.id)}">
                            ${escapeHTML(course.title)}
                        </option>
                    `)
                    .join("");
        }

        if (channelSelect) {

            channelSelect.innerHTML =
                `<option value="">
                    No specific course
                </option>` +
                state.courses
                    .map(course => `
                        <option value="${escapeHTML(course.id)}">
                            ${escapeHTML(course.title)}
                        </option>
                    `)
                    .join("");
        }
    }


    /* =====================================================
       LOAD COMMUNITIES
    ====================================================== */

    async function loadCommunities() {

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("chat_communities")
                .select("*")
                .order("created_at", {
                    ascending: true
                });

            if (error) {
                throw error;
            }

            state.communities =
                Array.isArray(data)
                    ? data
                    : [];

            console.log(
                "🏘️ Communities loaded:",
                state.communities.length
            );

            renderCommunityRail();

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
            getElement("communityRail");

        if (!rail) return;

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
                .map(community => {

                    const id =
                        String(community.id);

                    const active =
                        state.currentCommunity &&
                        String(
                            state.currentCommunity.id
                        ) === id;

                    const icon =
                        community.icon_url ||
                        community.icon ||
                        community.emoji ||
                        initials(
                            community.name
                        );

                    const isText =
                        String(icon).length > 2;

                    return `
                        <button
                            type="button"
                            class="community-rail-item ${active ? "active" : ""}"
                            data-community-id="${escapeHTML(id)}"
                            title="${escapeHTML(community.name || "Community")}"
                        >
                            <div class="community-rail-icon ${isText ? "text-icon" : ""}">
                                ${escapeHTML(icon)}
                            </div>
                        </button>
                    `;
                })
                .join("");

        $$(".community-rail-item[data-community-id]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const id =
                            button.dataset.communityId;

                        switchCommunity(id);
                    }
                );
            });
    }


    /* =====================================================
       COMMUNITY ROLE
    ====================================================== */

    async function loadCommunityRole() {

        state.currentRole = "student";

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
            } = await supabaseClient
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

            if (!error && data) {

                state.currentRole =
                    normalizeRole(
                        data.role ||
                        data.member_role
                    );
            }

        } catch (error) {

            console.warn(
                "⚠️ Could not determine community role:",
                error
            );
        }

        /*
         * Community owners are treated as super admins
         * within their own community if owner_id exists.
         */

        const ownerId =
            state.currentCommunity.owner_id ||
            state.currentCommunity.ownerId;

        if (
            ownerId &&
            String(ownerId) ===
            String(state.user.id)
        ) {
            state.currentRole = "super_admin";
        }

        applyPermissionUI();
    }


    /* =====================================================
       SWITCH COMMUNITY
    ====================================================== */

    async function switchCommunity(communityId) {

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

        state.currentCommunity = community;

        state.currentChannel = null;

        state.channels = [];

        state.members = [];

        state.messages = [];

        state.reactions = [];

        renderCommunityRail();

        renderActiveCommunity();

        await loadCommunityRole();

        await loadChannels();

        await loadMembers();

        setupCommunityRealtime();

        console.log(
            "🔄 Switched community:",
            community.name
        );
    }


    /* =====================================================
       ACTIVE COMMUNITY
    ====================================================== */

    function renderActiveCommunity() {

        const community =
            state.currentCommunity;

        if (!community) return;

        const name =
            getElement("activeCommunityName");

        const description =
            getElement("activeCommunityDescription");

        const icon =
            getElement("activeCommunityIcon");

        const courseName =
            getElement("communityCourseName");

        const courseLabel =
            getElement("communityCourseLabel");

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
                community.icon_url ||
                community.icon ||
                community.emoji ||
                initials(community.name);
        }

        const courseId =
            getCommunityCourseId(
                community
            );

        const course =
            state.courses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

        if (courseName) {

            courseName.textContent =
                course?.title ||
                "General Community";
        }

        if (courseLabel) {

            courseLabel.textContent =
                course
                    ? "Course Community"
                    : "Community";
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
            getElement("channelList");

        if (channelList) {

            channelList.innerHTML =
                `<div class="channel-loading">
                    Loading channels...
                </div>`;
        }

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .order("position", {
                    ascending: true,
                    nullsFirst: false
                });

            if (error) {
                throw error;
            }

            state.channels =
                Array.isArray(data)
                    ? data
                    : [];

            /*
             * Private channel filtering is performed at the
             * UI layer in addition to RLS.
             */

            const privateChannels =
                state.channels.filter(
                    channel =>
                        getChannelVisibility(
                            channel
                        ) === "private"
                );

            if (privateChannels.length) {

                await filterPrivateChannels();
            }

            renderChannels();

            if (state.channels.length) {

                let selected =
                    state.channels.find(
                        channel =>
                            channel.is_default === true
                    );

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

                channelList.innerHTML =
                    `<div class="channel-empty">
                        Unable to load channels.
                    </div>`;
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
                        getChannelVisibility(channel) !==
                        "private"
                );

            return;
        }

        const privateIds =
            state.channels
                .filter(
                    channel =>
                        getChannelVisibility(channel) ===
                        "private"
                )
                .map(channel => channel.id);

        if (!privateIds.length) {
            return;
        }

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("chat_channel_members")
                .select("*")
                .eq(
                    "user_id",
                    state.user.id
                );

            if (error) {
                throw error;
            }

            const memberships =
                Array.isArray(data)
                    ? data
                    : [];

            const allowedIds =
                new Set(
                    memberships.map(
                        item =>
                            String(
                                item.channel_id
                            )
                    )
                );

            state.channels =
                state.channels.filter(
                    channel => {

                        const visibility =
                            getChannelVisibility(
                                channel
                            );

                        if (
                            visibility !==
                            "private"
                        ) {
                            return true;
                        }

                        /*
                         * Moderators and above can see private
                         * channels belonging to the community.
                         */

                        if (
                            can("manageMembers") ||
                            can("manageCommunity")
                        ) {
                            return true;
                        }

                        return allowedIds.has(
                            String(channel.id)
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
            getElement("channelList");

        if (!container) return;

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
                            getChannelCategory(channel)
                        )
                            .toLowerCase()
                            .includes(search)
                    );
                }
            );

        if (!filtered.length) {

            container.innerHTML =
                `<div class="channel-empty">
                    No channels found.
                </div>`;

            return;
        }


        const categories = new Map();

        filtered.forEach(channel => {

            const category =
                getChannelCategory(
                    channel
                );

            if (!categories.has(category)) {
                categories.set(
                    category,
                    []
                );
            }

            categories
                .get(category)
                .push(channel);
        });


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

                        const category =
                            button.dataset.category;

                        toggleCategory(
                            category
                        );
                    }
                );
            });


        $$(".channel-row")
            .forEach(row => {

                row.addEventListener(
                    "click",
                    () => {

                        const id =
                            row.dataset.channelId;

                        selectChannel(id);
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
                class="channel-category ${collapsed ? "collapsed" : ""}"
                data-category="${escapeHTML(category)}"
            >

                <button
                    type="button"
                    class="channel-category-header"
                    data-category="${escapeHTML(category)}"
                >

                    <span class="channel-category-title">
                        <span class="channel-category-arrow">
                            ▾
                        </span>

                        <span>
                            ${escapeHTML(category)}
                        </span>
                    </span>

                    <span>
                        ${channels.length}
                    </span>

                </button>


                <div class="channel-category-items">

                    ${channels
                        .map(
                            channel =>
                                renderChannelRow(
                                    channel
                                )
                        )
                        .join("")}

                </div>

            </div>
        `;
    }


    function renderChannelRow(channel) {

        const active =
            state.currentChannel &&
            String(
                state.currentChannel.id
            ) ===
            String(channel.id);

        const privateChannel =
            getChannelVisibility(
                channel
            ) === "private";

        const courseId =
            getChannelCourseId(channel);

        const course =
            state.courses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

        return `
            <button
                type="button"
                class="channel-row ${active ? "active" : ""}"
                data-channel-id="${escapeHTML(channel.id)}"
            >

                <span class="channel-row-icon">
                    ${privateChannel ? "🔒" : "#"}
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
                            privateChannel
                                ? `<span class="private-lock">
                                    Private
                                </span>`
                                : `<span>
                                    Public
                                </span>`
                        }

                        ${
                            course
                                ? `<span class="course-mini-badge">
                                    ${escapeHTML(
                                        course.title
                                    )}
                                </span>`
                                : ""
                        }

                    </span>

                </span>

            </button>
        `;
    }


    function toggleCategory(category) {

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
            getElement("channelList");

        if (!container) return;

        container.innerHTML = `
            <div class="channel-empty">

                <div style="font-size:26px;margin-bottom:8px;">
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

        state.currentChannel =
            channel;

        renderChannels();

        renderActiveChannel();

        await loadMessages();

        await loadChannelMembers();

        markChannelRead();

        setupChannelRealtime();

        closeCommunityMenu();
    }


    function renderActiveChannel() {

        const channel =
            state.currentChannel;

        if (!channel) return;

        const name =
            getElement("activeChannelName");

        const description =
            getElement(
                "activeChannelDescription"
            );

        const input =
            getElement("messageInput");

        if (name) {
            name.textContent =
                channel.name ||
                "channel";
        }

        if (description) {
            description.textContent =
                channel.description ||
                (
                    getChannelVisibility(
                        channel
                    ) === "private"
                        ? "Private discussion channel."
                        : "Community discussion channel."
                );
        }

        if (input) {
            input.placeholder =
                can("send")
                    ? `Message #${channel.name || "channel"}`
                    : "You cannot send messages here.";
        }
    }


    /* =====================================================
       LOAD MESSAGES
    ====================================================== */

    async function loadMessages() {

        const messageList =
            getElement("messageList");

        if (!messageList) return;

        if (!state.currentChannel) {

            messageList.innerHTML =
                `<div class="welcome-message">
                    <div class="welcome-icon">#</div>
                    <h2>Select a channel</h2>
                    <p>
                        Choose a channel from the community sidebar.
                    </p>
                </div>`;

            return;
        }

        messageList.innerHTML =
            `<div class="channel-loading">
                Loading messages...
            </div>`;

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("chat_messages")
                .select("*")
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

            messageList.innerHTML =
                `<div class="channel-empty">
                    Unable to load messages.
                </div>`;
        }
    }


    /* =====================================================
       MESSAGE RENDERING
    ====================================================== */

    function renderMessages() {

        const container =
            getElement("messageList");

        if (!container) return;

        if (!state.messages.length) {

            container.innerHTML = `
                <div class="welcome-message">

                    <div class="welcome-icon">
                        #
                    </div>

                    <h2>
                        Welcome to #${escapeHTML(
                            state.currentChannel?.name ||
                            "channel"
                        )}
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

            container.innerHTML =
                `<div class="channel-empty">
                    No matching messages.
                </div>`;

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

        $$(".message-action[data-action='reply']")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        setReplyMessage(
                            button.dataset.messageId
                        );
                    }
                );
            });


        $$(".message-action[data-action='delete']")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteMessage(
                            button.dataset.messageId
                        );
                    }
                );
            });


        container.scrollTop =
            container.scrollHeight;
    }


    function renderMessage(message) {

        const sender =
            resolveMember(
                message.sender_id ||
                message.user_id ||
                message.author_id
            );

        const senderName =
            getDisplayName(
                sender
            );

        const timestamp =
            formatDateTime(
                message.created_at
            );

        const content =
            escapeHTML(
                message.content || ""
            );

        const avatarUrl =
            sender?.photo_url ||
            sender?.avatar_url ||
            sender?.avatar ||
            null;

        const avatar =
            avatarUrl
                ? `
                    <img
                        src="${escapeHTML(avatarUrl)}"
                        alt=""
                    >
                `
                : initials(senderName);


        const canDelete =
            can("moderate") ||
            String(
                message.sender_id ||
                message.user_id
            ) ===
            String(state.user?.id);


        return `
            <article
                class="message"
                data-message-id="${escapeHTML(message.id)}"
            >

                <div class="message-avatar">
                    ${avatar}
                </div>

                <div class="message-body">

                    <div class="message-meta">

                        <span class="message-author">
                            ${escapeHTML(senderName)}
                        </span>

                        <span class="message-time">
                            ${escapeHTML(timestamp)}
                        </span>

                    </div>

                    <div class="message-content">
                        ${content}
                    </div>

                    <div class="message-actions">

                        <button
                            type="button"
                            class="message-action"
                            data-action="reply"
                            data-message-id="${escapeHTML(message.id)}"
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
                                        data-message-id="${escapeHTML(message.id)}"
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


    function formatDateTime(value) {

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

    function resolveMember(userId) {

        if (!userId) {
            return null;
        }

        return (
            state.members.find(
                member =>
                    String(
                        getUserId(member)
                    ) ===
                    String(userId)
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
            getElement("messageInput");

        if (!input) return;

        const content =
            input.value.trim();

        if (!content) {
            return;
        }

        if (content.length > 5000) {

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

                sender_id:
                    state.user.id,

                content
            };


            /*
             * Preserve compatibility with Phase 2.
             *
             * If your existing schema includes
             * parent_message_id, replies are supported.
             */

            if (
                state.currentReplyMessage
            ) {

                payload.parent_message_id =
                    state.currentReplyMessage.id;
            }


            let result =
                await supabaseClient
                    .from("chat_messages")
                    .insert(payload)
                    .select()
                    .single();


            /*
             * If parent_message_id does not exist in the
             * current schema, retry without it.
             */

            if (
                result.error &&
                state.currentReplyMessage &&
                /parent_message_id|column/i.test(
                    result.error.message || ""
                )
            ) {

                const fallbackPayload = {
                    channel_id:
                        state.currentChannel.id,

                    sender_id:
                        state.user.id,

                    content
                };

                result =
                    await supabaseClient
                        .from("chat_messages")
                        .insert(
                            fallbackPayload
                        )
                        .select()
                        .single();
            }


            if (result.error) {
                throw result.error;
            }

            input.value = "";

            autoResizeTextarea(
                input
            );

            clearReply();

            if (result.data) {

                const exists =
                    state.messages.some(
                        item =>
                            String(item.id) ===
                            String(result.data.id)
                    );

                if (!exists) {

                    state.messages.push(
                        result.data
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

    async function deleteMessage(messageId) {

        if (!messageId) return;

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) return;

        const owner =
            String(
                message.sender_id ||
                message.user_id
            ) ===
            String(state.user?.id);

        if (!owner && !can("moderate")) {

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

            const {
                error
            } = await supabaseClient
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    messageId
                );

            if (error) {
                throw error;
            }

            state.messages =
                state.messages.filter(
                    item =>
                        String(item.id) !==
                        String(messageId)
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

    function setReplyMessage(messageId) {

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) return;

        state.currentReplyMessage =
            message;

        const preview =
            getElement("replyPreview");

        const text =
            getElement("replyPreviewText");

        if (preview) {
            preview.classList.remove(
                "hidden"
            );
        }

        if (text) {
            text.textContent =
                message.content || "";
        }

        const input =
            getElement("messageInput");

        if (input) {
            input.focus();
        }
    }


    function clearReply() {

        state.currentReplyMessage =
            null;

        const preview =
            getElement("replyPreview");

        if (preview) {
            preview.classList.add(
                "hidden"
            );
        }

        const text =
            getElement("replyPreviewText");

        if (text) {
            text.textContent = "";
        }
    }


    /* =====================================================
       LOAD COMMUNITY MEMBERS
    ====================================================== */

    async function loadMembers() {

        if (!state.currentCommunity) {
            return;
        }

        try {

            const {
                data,
                error
            } = await supabaseClient
                .from("chat_community_members")
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
                );

            if (error) {
                throw error;
            }

            state.members =
                Array.isArray(data)
                    ? data
                    : [];

            /*
             * If membership rows only contain user_id,
             * enrich them from students.
             */

            await enrichMembers();

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
            } = await supabaseClient
                .from("students")
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
                            String(profile.id),
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
                                String(userId)
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
                "⚠️ Member profile enrichment unavailable:",
                error
            );
        }
    }


    /* =====================================================
       LOAD CHANNEL MEMBERS
    ====================================================== */

    async function loadChannelMembers() {

        if (
            !state.currentChannel
        ) {
            return;
        }

        /*
         * The community member list remains visible.
         * This function is intentionally lightweight so
         * existing Phase 2 member behavior is preserved.
         */

        renderMembers();
    }


    /* =====================================================
       RENDER MEMBERS
    ====================================================== */

    function renderMembers() {

        const container =
            getElement("memberList");

        const count =
            getElement("memberCount");

        if (!container) return;

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
                        ).toLowerCase();

                    const role =
                        roleLabel(
                            member.role
                        ).toLowerCase();

                    return (
                        name.includes(search) ||
                        role.includes(search)
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

            container.innerHTML =
                `<div class="member-empty">
                    No members found.
                </div>`;

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

                    return getDisplayName(a)
                        .localeCompare(
                            getDisplayName(b)
                        );
                }
            );


        container.innerHTML =
            sorted
                .map(
                    member =>
                        renderMember(
                            member
                        )
                )
                .join("");
    }


    function renderMember(member) {

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
            member.avatar ||
            member._profile?.photo_url ||
            null;

        const avatar =
            avatarUrl
                ? `
                    <img
                        src="${escapeHTML(avatarUrl)}"
                        alt=""
                    >
                `
                : initials(name);


        return `
            <div
                class="member-row"
                data-user-id="${escapeHTML(
                    getUserId(member) || ""
                )}"
            >

                <div class="member-avatar">

                    ${avatar}

                    <span
                        class="presence-dot"
                        data-presence-user="${escapeHTML(
                            getUserId(member) || ""
                        )}"
                    ></span>

                </div>

                <div class="member-info">

                    <span class="member-name">
                        ${escapeHTML(name)}
                    </span>

                    <span class="member-role">
                        ${escapeHTML(role)}
                    </span>

                </div>

            </div>
        `;
    }


    /* =====================================================
       COMMUNITY CREATION
    ====================================================== */

    async function createCommunity(event) {

        event.preventDefault();

        if (!can("createCommunity")) {

            showToast(
                "You do not have permission to create communities.",
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
            )
                ?.value
                .trim();

        const description =
            getElement(
                "communityDescriptionInput"
            )
                ?.value
                .trim();

        const icon =
            getElement(
                "communityIconInput"
            )
                ?.value
                .trim();

        const courseId =
            getElement(
                "communityCourseSelect"
            )
                ?.value ||
            null;

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


        try {

            /*
             * Desired Phase 3 payload.
             */

            let payload = {
                name,
                description:
                    description || null,

                icon:
                    icon || "📚",

                icon_url:
                    icon || null,

                owner_id:
                    state.user.id,

                course_id:
                    courseId
                        ? Number(courseId)
                        : null
            };


            let result =
                await supabaseClient
                    .from("chat_communities")
                    .insert(payload)
                    .select()
                    .single();


            /*
             * Compatibility fallback:
             * if optional Phase 3 columns are not yet present,
             * retry using the safest common fields.
             */

            if (
                result.error &&
                isSchemaColumnError(
                    result.error
                )
            ) {

                payload = {
                    name,
                    description:
                        description || null,

                    owner_id:
                        state.user.id
                };

                result =
                    await supabaseClient
                        .from("chat_communities")
                        .insert(payload)
                        .select()
                        .single();
            }


            if (result.error) {
                throw result.error;
            }


            const newCommunity =
                result.data;

            /*
             * Add creator as super admin / owner member.
             */

            if (newCommunity?.id) {

                await createCommunityMembership(
                    newCommunity.id
                );
            }


            closeCommunityModal();

            await loadCommunities();

            if (newCommunity?.id) {

                await switchCommunity(
                    newCommunity.id
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


    async function createCommunityMembership(
        communityId
    ) {

        try {

            const {
                error
            } = await supabaseClient
                .from("chat_community_members")
                .insert({
                    community_id:
                        communityId,

                    user_id:
                        state.user.id,

                    role:
                        "super_admin"
                });

            if (error) {

                console.warn(
                    "⚠️ Creator membership could not be created:",
                    error
                );
            }

        } catch (error) {

            console.warn(
                "⚠️ Creator membership failed:",
                error
            );
        }
    }


    /* =====================================================
       CHANNEL CREATION
    ====================================================== */

    async function createChannel(event) {

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
            )
                ?.value
                .trim();

        const description =
            getElement(
                "channelDescriptionInput"
            )
                ?.value
                .trim();

        const category =
            getElement(
                "channelCategoryInput"
            )
                ?.value
                .trim() ||
            "General";

        const visibility =
            getElement(
                "channelVisibilitySelect"
            )
                ?.value ||
            "public";

        const courseId =
            getElement(
                "channelCourseSelect"
            )
                ?.value ||
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


        const normalizedName =
            name
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-_]/g, "");


        try {

            /*
             * First attempt uses the complete Phase 3
             * channel structure.
             */

            let payload = {

                community_id:
                    state.currentCommunity.id,

                name:
                    normalizedName,

                description:
                    description || null,

                category:
                    category,

                is_private:
                    visibility === "private",

                visibility:
                    visibility,

                course_id:
                    courseId
                        ? Number(courseId)
                        : null,

                created_by:
                    state.user.id,

                position:
                    state.channels.length

            };


            let result =
                await supabaseClient
                    .from("chat_channels")
                    .insert(payload)
                    .select()
                    .single();


            /*
             * Schema compatibility fallback.
             */

            if (
                result.error &&
                isSchemaColumnError(
                    result.error
                )
            ) {

                payload = {

                    community_id:
                        state.currentCommunity.id,

                    name:
                        normalizedName,

                    description:
                        description || null
                };

                result =
                    await supabaseClient
                        .from("chat_channels")
                        .insert(payload)
                        .select()
                        .single();
            }


            if (result.error) {
                throw result.error;
            }


            const newChannel =
                result.data;


            /*
             * If private, automatically add creator.
             */

            if (
                newChannel?.id &&
                visibility === "private"
            ) {

                await addChannelMember(
                    newChannel.id,
                    state.user.id
                );
            }


            closeChannelModal();

            await loadChannels();

            if (newChannel?.id) {

                await selectChannel(
                    newChannel.id
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
            } = await supabaseClient
                .from("chat_channel_members")
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
       SCHEMA ERROR DETECTION
    ====================================================== */

    function isSchemaColumnError(
        error
    ) {

        if (!error) {
            return false;
        }

        const message =
            String(
                error.message || ""
            ).toLowerCase();

        return (
            message.includes(
                "column"
            ) ||
            message.includes(
                "schema cache"
            ) ||
            message.includes(
                "does not exist"
            ) ||
            message.includes(
                "could not find"
            )
        );
    }


    /* =====================================================
       COURSE LOOKUP
    ====================================================== */

    function getCourseName(
        courseId
    ) {

        const course =
            state.courses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

        return course?.title || null;
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

            const payload = {

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                last_read_at:
                    new Date().toISOString()
            };


            const {
                error
            } = await supabaseClient
                .from("chat_read_status")
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
            state.realtimeChannel
        ) {

            try {
                supabaseClient
                    .removeChannel(
                        state.realtimeChannel
                    );
            } catch (_) {}
        }


        if (
            !state.currentCommunity
        ) {
            return;
        }


        state.realtimeChannel =
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
                .subscribe();
    }


    /* =====================================================
       REALTIME — CHANNEL
    ====================================================== */

    function setupChannelRealtime() {

        if (
            state.presenceChannel
        ) {

            try {
                supabaseClient
                    .removeChannel(
                        state.presenceChannel
                    );
            } catch (_) {}
        }


        if (
            !state.currentChannel
        ) {
            return;
        }


        state.presenceChannel =
            supabaseClient
                .channel(
                    `messages-${state.currentChannel.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    payload => {

                        const incoming =
                            payload.new;

                        if (
                            !incoming
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
                            `channel_id=eq.${state.currentChannel.id}`
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
                .subscribe();
    }


    /* =====================================================
       PRESENCE
    ====================================================== */

    async function updatePresence(
        status = "online"
    ) {

        if (!state.user) {
            return;
        }

        try {

            const {
                error
            } = await supabaseClient
                .from("chat_presence")
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        status,

                        last_seen:
                            new Date().toISOString()
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

        } catch (error) {

            console.warn(
                "⚠️ Presence error:",
                error
            );
        }
    }


    /* =====================================================
       MESSAGE SEARCH
    ====================================================== */

    function toggleMessageSearch() {

        const panel =
            getElement(
                "messageSearchPanel"
            );

        if (!panel) return;

        panel.classList.toggle(
            "hidden"
        );

        if (
            !panel.classList.contains(
                "hidden"
            )
        ) {

            const input =
                getElement(
                    "messageSearchInput"
                );

            input?.focus();

        } else {

            state.messageSearch = "";

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

        if (!menu) return;

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

        if (!rect) return;

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
       MODAL CONTROLS
    ====================================================== */

    function openCommunityModal() {

        if (!can("createCommunity")) {

            showToast(
                "Only admins and super admins can create communities.",
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

        const modal =
            getElement(
                "communityModal"
            );

        modal?.classList.add(
            "hidden"
        );

        const form =
            getElement(
                "communityForm"
            );

        form?.reset();

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

        const modal =
            getElement(
                "channelModal"
            );

        modal?.classList.remove(
            "hidden"
        );

        getElement(
            "channelNameInput"
        )?.focus();
    }


    function closeChannelModal() {

        const modal =
            getElement(
                "channelModal"
            );

        modal?.classList.add(
            "hidden"
        );

        const form =
            getElement(
                "channelForm"
            );

        form?.reset();

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

        const channelSidebar =
            $(".channel-sidebar");

        if (!channelSidebar) {
            return;
        }


        /*
         * On small screens, clicking the community header
         * can open/close the channel drawer.
         */

        const header =
            $(".community-header");

        header?.addEventListener(
            "dblclick",
            () => {

                if (
                    window.innerWidth <=
                    760
                ) {

                    channelSidebar.classList.toggle(
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

                    channelSidebar.classList.remove(
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

        /*
         * Community creation
         */

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


        /*
         * Channel creation
         */

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


        /*
         * Community menu
         */

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


        /*
         * Message form
         */

        getElement(
            "messageForm"
        )?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await sendMessage();
            }
        );


        /*
         * Message input
         */

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
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    await sendMessage();
                }
            }
        );


        /*
         * Reply
         */

        getElement(
            "cancelReplyButton"
        )?.addEventListener(
            "click",
            clearReply
        );


        /*
         * Members
         */

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


        /*
         * Channel search
         */

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


        /*
         * Message search
         */

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


        /*
         * Attachment button
         *
         * Attachments remain reserved for the existing
         * Phase 1 attachment infrastructure.
         */

        getElement(
            "attachmentButton"
        )?.addEventListener(
            "click",
            () => {

                showToast(
                    "Attachment support is ready for the next community phase."
                );
            }
        );


        /*
         * Close menus/modals by clicking outside.
         */

        document.addEventListener(
            "click",
            event => {

                const menu =
                    getElement(
                        "communityMenu"
                    );

                const menuButton =
                    getElement(
                        "communityMenuButton"
                    );

                if (
                    menu &&
                    !menu.classList.contains(
                        "hidden"
                    ) &&
                    !menu.contains(event.target) &&
                    !menuButton?.contains(event.target)
                ) {

                    closeCommunityMenu();
                }
            }
        );


        /*
         * Escape key.
         */

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


        /*
         * Modal background click.
         */

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


        /*
         * Preserve the last selected community locally.
         */

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
                    String(stored)
            );


        if (!selected) {

            selected =
                state.communities[0];
        }


        await switchCommunity(
            selected.id
        );
    }


    /* =====================================================
       STORE COMMUNITY
    ====================================================== */

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
       PATCH SWITCH TO PERSIST
    ====================================================== */

    const originalSwitchCommunity =
        switchCommunity;

    /*
     * We cannot reassign the function declaration directly
     * in all environments, so persistence happens through
     * this wrapper used by initialization and rail clicks.
     */

    async function switchAndPersist(
        communityId
    ) {

        await originalSwitchCommunity(
            communityId
        );

        persistCurrentCommunity();
    }


    /* =====================================================
       REPLACE RAIL HANDLERS
    ====================================================== */

    function refreshRailHandlers() {

        $$(".community-rail-item[data-community-id]")
            .forEach(button => {

                /*
                 * Remove old listeners by cloning.
                 */

                const clone =
                    button.cloneNode(true);

                button.replaceWith(
                    clone
                );
            });


        $$(".community-rail-item[data-community-id]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await switchAndPersist(
                            button.dataset.communityId
                        );
                    }
                );
            });
    }


    /* =====================================================
       PATCH COMMUNITY RAIL RENDER
    ====================================================== */

    const originalRenderCommunityRail =
        renderCommunityRail;


    /*
     * Re-render and then attach persistent switching.
     */

    function renderRailWithPersistence() {

        originalRenderCommunityRail();

        refreshRailHandlers();
    }


    /*
     * Replace render after declarations are available.
     */

    function safeRenderRail() {

        renderRailWithPersistence();
    }


    /* =====================================================
       INITIALIZATION
    ====================================================== */

    async function initializeCommunity() {

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


        /*
         * Re-render with persistent handlers.
         */

        safeRenderRail();


        await selectInitialCommunity();


        await updatePresence(
            "online"
        );


        applyPermissionUI();

        setupEventListeners();

        setupMobileControls();


        /*
         * Presence heartbeat.
         */

        setInterval(
            () => {

                updatePresence(
                    "online"
                );

            },
            60000
        );


        /*
         * When user leaves page, mark offline.
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
                event === "SIGNED_OUT"
            ) {

                window.location.href =
                    "index.html";

                return;
            }

            if (
                session?.user &&
                !state.user
            ) {

                state.user =
                    session.user;

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
            initializeCommunity
        );

    } else {

        initializeCommunity();
    }


})();
