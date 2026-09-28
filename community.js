/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   PHASE 3
   ---------------------------------------------------------
   Adds:
   - Multiple communities
   - Course-linked communities
   - Channel categories
   - Public/private channels
   - Role permissions
   - Community creation
   - Channel creation
   - Course-specific discussion
   - Community switching
   - Permission-aware UI
   - Realtime messages
   - Realtime reactions
   - Presence
   - Read status
   - Notifications
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       GLOBAL STATE
    ====================================================== */

    const state = {

        user: null,

        student: null,

        communities: [],

        courses: [],

        channels: [],

        members: [],

        messages: [],

        reactions: [],

        notifications: [],

        presence: [],

        readStatuses: [],

        currentCommunity: null,

        currentChannel: null,

        currentMember: null,

        replyToMessage: null,

        editingMessage: null,

        communityRole: "student",

        channelMember: false,

        subscriptions: [],

        categoryState: {},

        unreadByChannel: {},

        initialized: false,

        loadingMessages: false,

        sendingMessage: false,

        toastTimer: null

    };


    /* =====================================================
       DOM HELPER
    ====================================================== */

    const $ = (id) => document.getElementById(id);


    const escapeHtml = (value) => {

        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };


    const escapeAttribute = (value) => {
        return escapeHtml(value);
    };


    const normalizeRole = (role) => {

        const value = String(role || "student")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

        const aliases = {
            superadmin: "super_admin",
            super_admin: "super_admin",
            "super administrator": "super_admin",
            administrator: "admin",
            admin: "admin",
            moderator: "moderator",
            mod: "moderator",
            tutor: "tutor",
            teacher: "tutor",
            student: "student"
        };

        return aliases[value] || "student";
    };


    const roleLabel = (role) => {

        const normalized = normalizeRole(role);

        const labels = {
            super_admin: "Super Admin",
            admin: "Admin",
            moderator: "Moderator",
            tutor: "Tutor",
            student: "Student"
        };

        return labels[normalized] || "Student";
    };


    const roleRank = (role) => {

        const ranks = {
            student: 1,
            tutor: 2,
            moderator: 3,
            admin: 4,
            super_admin: 5
        };

        return ranks[normalizeRole(role)] || 1;
    };


    /* =====================================================
       PERMISSIONS
    ====================================================== */

    function canCreateCommunity() {

        return [
            "super_admin",
            "admin"
        ].includes(
            normalizeRole(state.communityRole)
        );
    }


    function canCreateChannel() {

        return [
            "super_admin",
            "admin",
            "moderator"
        ].includes(
            normalizeRole(state.communityRole)
        );
    }


    function canManageCommunity() {

        return [
            "super_admin",
            "admin"
        ].includes(
            normalizeRole(state.communityRole)
        );
    }


    function canManageChannel() {

        return [
            "super_admin",
            "admin",
            "moderator"
        ].includes(
            normalizeRole(state.communityRole)
        );
    }


    function canManageMembers() {

        return [
            "super_admin",
            "admin"
        ].includes(
            normalizeRole(state.communityRole)
        );
    }


    function canDeleteMessage(message) {

        if (!message) {
            return false;
        }

        if (
            state.user &&
            message.sender_id === state.user.id
        ) {
            return true;
        }

        return [
            "super_admin",
            "admin",
            "moderator"
        ].includes(
            normalizeRole(state.communityRole)
        );
    }


    function canSendMessages() {

        if (!state.currentChannel) {
            return false;
        }

        if (state.currentChannel.channel_type === "private") {
            return state.channelMember || roleRank(state.communityRole) >= 3;
        }

        return true;
    }


    function canViewPrivateChannel(channel) {

        if (!channel) {
            return false;
        }

        if (
            channel.channel_type !== "private" &&
            String(channel.visibility || "").toLowerCase() !== "private"
        ) {
            return true;
        }

        if (
            roleRank(state.communityRole) >= 3
        ) {
            return true;
        }

        return state.channelMember;
    }


    /* =====================================================
       SUPABASE
    ====================================================== */

    function getSupabase() {

        if (
            typeof window.supabase !== "undefined" &&
            window.supabase &&
            typeof window.supabase.from === "function"
        ) {
            return window.supabase;
        }

        if (
            window.mwanikiSupabase &&
            typeof window.mwanikiSupabase.from === "function"
        ) {
            return window.mwanikiSupabase;
        }

        return null;
    }


    const db = () => getSupabase();


    /* =====================================================
       SAFE DATABASE OPERATIONS
    ====================================================== */

    async function safeSelect(table, options = {}) {

        const client = db();

        if (!client) {
            throw new Error(
                "Supabase client was not found. Check supabase.js."
            );
        }

        let query = client
            .from(table)
            .select(
                options.select || "*"
            );


        if (options.eq) {

            for (const [column, value] of Object.entries(options.eq)) {
                query = query.eq(column, value);
            }

        }


        if (options.in) {

            for (const [column, values] of Object.entries(options.in)) {
                query = query.in(column, values);
            }

        }


        if (options.order) {

            query = query.order(
                options.order.column,
                {
                    ascending:
                        options.order.ascending !== false
                }
            );

        }


        if (options.limit) {
            query = query.limit(options.limit);
        }


        return await query;
    }


    /* =====================================================
       AUTHENTICATION
    ====================================================== */

    async function getCurrentUser() {

        const client = db();

        if (!client) {
            throw new Error("Supabase is unavailable.");
        }

        const {
            data,
            error
        } = await client.auth.getUser();

        if (error) {
            throw error;
        }

        return data?.user || null;
    }


    async function requireAuthentication() {

        state.user = await getCurrentUser();

        if (!state.user) {

            showToast(
                "Please sign in to use Mwaniki Community.",
                "error"
            );

            setTimeout(() => {

                const loginPages = [
                    "index.html",
                    "login.html",
                    "studentLogin.html"
                ];

                const current = location.pathname;

                if (
                    !loginPages.some(
                        page => current.endsWith(page)
                    )
                ) {
                    location.href = "index.html";
                }

            }, 1200);

            return false;
        }

        return true;
    }


    /* =====================================================
       STUDENT PROFILE
    ====================================================== */

    async function loadStudentProfile() {

        if (!state.user) {
            return;
        }

        try {

            const {
                data,
                error
            } = await safeSelect(
                "students",
                {
                    eq: {
                        user_id: state.user.id
                    },
                    limit: 1
                }
            );

            if (
                !error &&
                data &&
                data.length
            ) {
                state.student = data[0];
            }

        } catch (error) {

            console.warn(
                "Community student profile lookup skipped:",
                error
            );

        }


        const name =
            state.student?.full_name ||
            state.student?.name ||
            state.student?.display_name ||
            state.user.user_metadata?.full_name ||
            state.user.user_metadata?.name ||
            state.user.email?.split("@")[0] ||
            "Student";


        const photo =
            state.student?.photo_url ||
            state.student?.avatar_url ||
            state.user.user_metadata?.avatar_url ||
            state.user.user_metadata?.picture ||
            "";


        setText(
            "sidebarUserName",
            name
        );


        setText(
            "sidebarUserRole",
            roleLabel(
                state.communityRole
            )
        );


        setAvatar(
            $("sidebarUserAvatar"),
            name,
            photo
        );

    }


    /* =====================================================
       GENERIC UI
    ====================================================== */

    function setText(id, value) {

        const element = $(id);

        if (element) {
            element.textContent =
                value === null ||
                value === undefined ||
                value === ""
                    ? ""
                    : value;
        }
    }


    function setHidden(element, hidden) {

        if (!element) {
            return;
        }

        element.hidden = Boolean(hidden);
    }


    function showElement(id) {

        const element = $(id);

        if (element) {
            element.hidden = false;
        }
    }


    function hideElement(id) {

        const element = $(id);

        if (element) {
            element.hidden = true;
        }
    }


    function setAvatar(element, name, photoUrl) {

        if (!element) {
            return;
        }

        const safeName =
            name ||
            "Student";

        const initials =
            safeName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(
                    part =>
                        part.charAt(0).toUpperCase()
                )
                .join("") ||
            "S";


        if (photoUrl) {

            element.innerHTML = `
                <img
                    src="${escapeAttribute(photoUrl)}"
                    alt="${escapeAttribute(safeName)}"
                    loading="lazy"
                    onerror="this.remove()"
                >
            `;

        } else {

            element.textContent = initials;

        }

    }


    function showToast(message, type = "success") {

        const toast = $("communityToast");

        if (!toast) {
            return;
        }

        clearTimeout(state.toastTimer);

        toast.textContent = message;

        toast.className =
            `community-toast visible ${type}`;

        toast.hidden = false;


        state.toastTimer =
            setTimeout(() => {

                toast.classList.remove(
                    "visible"
                );

                setTimeout(() => {
                    toast.hidden = true;
                }, 200);

            }, 2800);

    }


    function openModal(id) {

        const modal = $(id);

        if (modal) {
            modal.hidden = false;
        }

    }


    function closeModal(id) {

        const modal = $(id);

        if (modal) {
            modal.hidden = true;
        }

    }


    /* =====================================================
       COMMUNITY NORMALIZATION
    ====================================================== */

    function normalizeCommunity(row) {

        if (!row) {
            return null;
        }

        return {

            ...row,

            id:
                row.id,

            name:
                row.name ||
                row.title ||
                row.community_name ||
                "Unnamed Community",

            description:
                row.description ||
                row.about ||
                "",

            owner_id:
                row.owner_id ||
                row.created_by ||
                row.created_by_user_id ||
                null,

            course_id:
                row.course_id ||
                null,

            visibility:
                String(
                    row.visibility ||
                    row.community_type ||
                    "public"
                ).toLowerCase(),

            created_at:
                row.created_at ||
                null

        };

    }


    function normalizeChannel(row) {

        if (!row) {
            return null;
        }

        return {

            ...row,

            id:
                row.id,

            community_id:
                row.community_id,

            name:
                row.name ||
                row.title ||
                row.channel_name ||
                "channel",

            description:
                row.description ||
                "",

            category:
                row.category ||
                row.channel_category ||
                "Community",

            channel_type:
                String(
                    row.channel_type ||
                    row.visibility ||
                    "public"
                ).toLowerCase(),

            course_id:
                row.course_id ||
                null,

            position:
                Number(
                    row.position ||
                    row.sort_order ||
                    0
                )

        };

    }


    function normalizeMessage(row) {

        if (!row) {
            return null;
        }

        return {

            ...row,

            id:
                row.id,

            channel_id:
                row.channel_id,

            sender_id:
                row.sender_id ||
                row.user_id ||
                row.author_id ||
                null,

            content:
                row.content ||
                row.message ||
                "",

            created_at:
                row.created_at ||
                new Date().toISOString(),

            updated_at:
                row.updated_at ||
                null

        };

    }


    /* =====================================================
       LOAD COMMUNITIES
    ====================================================== */

    async function loadCommunities() {

        const result =
            await safeSelect(
                "chat_communities",
                {
                    order: {
                        column: "created_at",
                        ascending: true
                    }
                }
            );


        if (result.error) {

            console.error(
                "Community load error:",
                result.error
            );

            throw result.error;
        }


        state.communities =
            (result.data || [])
                .map(normalizeCommunity)
                .filter(Boolean);


        /*
         * If no communities exist, do not fabricate database
         * records. The UI explains how an authorized admin can
         * create the first one.
         */


        renderCommunitySwitcher();


        setText(
            "communityCountText",
            `${state.communities.length} ${state.communities.length === 1 ? "Community" : "Communities"}`
        );


        return state.communities;

    }


    /* =====================================================
       COMMUNITY ROLE
    ====================================================== */

    async function loadCurrentCommunityRole() {

        state.communityRole = "student";
        state.channelMember = false;


        if (
            !state.user ||
            !state.currentCommunity
        ) {
            return;
        }


        try {

            const {
                data,
                error
            } = await safeSelect(
                "chat_community_members",
                {
                    eq: {
                        community_id:
                            state.currentCommunity.id,

                        user_id:
                            state.user.id
                    },
                    limit: 1
                }
            );


            if (
                !error &&
                data &&
                data.length
            ) {

                const membership =
                    data[0];

                state.communityRole =
                    normalizeRole(
                        membership.role ||
                        membership.member_role ||
                        "student"
                    );

            } else {

                /*
                 * Owner automatically receives administrative
                 * privileges even if membership row has not
                 * been created yet.
                 */

                if (
                    state.currentCommunity.owner_id ===
                    state.user.id
                ) {
                    state.communityRole =
                        "admin";
                }

            }

        } catch (error) {

            console.warn(
                "Community role lookup failed:",
                error
            );

            if (
                state.currentCommunity.owner_id ===
                state.user.id
            ) {
                state.communityRole =
                    "admin";
            }

        }


        await loadStudentProfile();

        renderPermissionUI();

    }


    /* =====================================================
       RENDER COMMUNITY SWITCHER
    ====================================================== */

    function renderCommunitySwitcher() {

        const list =
            $("communityList");

        if (!list) {
            return;
        }


        if (!state.communities.length) {

            list.innerHTML = `
                <div class="loading-small">
                    No communities are available yet.
                </div>
            `;

            return;
        }


        list.innerHTML =
            state.communities
                .map(community => {

                    const active =
                        state.currentCommunity &&
                        String(
                            state.currentCommunity.id
                        ) === String(
                            community.id
                        );


                    const initials =
                        getInitials(
                            community.name
                        );


                    return `
                        <button
                            type="button"
                            class="community-list-item ${active ? "active" : ""}"
                            data-community-id="${escapeAttribute(community.id)}"
                        >

                            <div class="community-list-item-icon">
                                ${escapeHtml(initials)}
                            </div>

                            <div class="community-list-item-text">

                                <strong>
                                    ${escapeHtml(community.name)}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        community.course_id
                                            ? "Course Community"
                                            : "Community"
                                    )}
                                </span>

                            </div>

                            <span class="community-list-item-role">
                                ${escapeHtml(
                                    roleLabel(
                                        getCommunityMemberRole(
                                            community.id
                                        )
                                    )
                                )}
                            </span>

                        </button>
                    `;

                })
                .join("");


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

                        await switchCommunity(id);

                    }
                );

            });

    }


    function getCommunityMemberRole(communityId) {

        if (
            state.currentCommunity &&
            String(state.currentCommunity.id) ===
                String(communityId)
        ) {
            return state.communityRole;
        }

        return "student";
    }


    function getInitials(name) {

        return String(name || "MC")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
                item =>
                    item
                        .charAt(0)
                        .toUpperCase()
            )
            .join("") || "MC";

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
            return;
        }


        state.currentCommunity =
            community;


        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );


        closeCommunitySwitcher();
        closeMobileSidebar();


        setText(
            "currentCommunityName",
            community.name
        );


        setText(
            "currentCommunityInitials",
            getInitials(
                community.name
            )
        );


        setText(
            "sidebarCommunityName",
            community.name
        );


        setText(
            "sidebarCommunityDescription",
            community.description ||
            "Connect and learn together."
        );


        const privateBadge =
            $("sidebarCommunityPrivateBadge");


        if (privateBadge) {

            privateBadge.hidden =
                community.visibility !==
                "private";

        }


        await clearRealtimeSubscriptions();

        state.currentChannel = null;
        state.channels = [];
        state.members = [];
        state.messages = [];


        await loadCurrentCommunityRole();

        await loadChannels();

        await loadMembers();

        await loadCommunityNotifications();

        await subscribeToCommunity();

        renderPermissionUI();


        if (state.channels.length) {

            const savedChannelId =
                localStorage.getItem(
                    `mwanikiCommunityChannel_${community.id}`
                );


            const savedChannel =
                state.channels.find(
                    channel =>
                        String(channel.id) ===
                        String(savedChannelId)
                );


            const firstVisible =
                state.channels.find(
                    channel =>
                        canViewPrivateChannel(
                            channel
                        )
                );


            await switchChannel(
                savedChannel ||
                firstVisible ||
                state.channels[0]
            );

        } else {

            renderChannels();

            renderEmptyChannelState(
                "No channels yet",
                canCreateChannel()
                    ? "Create the first channel for this community."
                    : "An administrator has not created any channels yet."
            );

        }


        renderCommunitySwitcher();

    }


    /* =====================================================
       LOAD CHANNELS
    ====================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) {
            return;
        }


        const result =
            await safeSelect(
                "chat_channels",
                {
                    eq: {
                        community_id:
                            state.currentCommunity.id
                    },
                    order: {
                        column: "position",
                        ascending: true
                    }
                }
            );


        if (result.error) {

            /*
             * Some schemas may not contain position.
             * Retry without relying on it.
             */

            const retry =
                await safeSelect(
                    "chat_channels",
                    {
                        eq: {
                            community_id:
                                state.currentCommunity.id
                        },
                        order: {
                            column: "created_at",
                            ascending: true
                        }
                    }
                );


            if (retry.error) {
                throw retry.error;
            }


            state.channels =
                (retry.data || [])
                    .map(normalizeChannel)
                    .filter(
                        channel =>
                            canViewPrivateChannel(
                                channel
                            )
                    );

        } else {

            state.channels =
                (result.data || [])
                    .map(normalizeChannel)
                    .filter(
                        channel =>
                            canViewPrivateChannel(
                                channel
                            )
                    );

        }


        renderChannels();

    }


    /* =====================================================
       CHANNEL CATEGORIES
    ====================================================== */

    function getChannelCategory(channel) {

        return (
            channel.category ||
            "Community"
        );

    }


    function renderChannels() {

        const navigation =
            $("channelNavigation");

        if (!navigation) {
            return;
        }


        if (!state.channels.length) {

            navigation.innerHTML = `
                <div class="loading-sidebar">
                    ${
                        canCreateChannel()
                            ? "Create your first channel."
                            : "No channels available."
                    }
                </div>
            `;

            return;
        }


        const search =
            String(
                $("channelSearchInput")?.value ||
                ""
            )
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
                            .toLowerCase()
                            .includes(search) ||
                        String(
                            channel.description || ""
                        )
                            .toLowerCase()
                            .includes(search) ||
                        String(
                            channel.category || ""
                        )
                            .toLowerCase()
                            .includes(search)
                    );

                }
            );


        const categories =
            new Map();


        filtered.forEach(channel => {

            const category =
                getChannelCategory(
                    channel
                );

            if (!categories.has(category)) {
                categories.set(category, []);
            }

            categories
                .get(category)
                .push(channel);

        });


        if (!categories.size) {

            navigation.innerHTML = `
                <div class="loading-sidebar">
                    No matching channels.
                </div>
            `;

            return;
        }


        let html = "";


        categories.forEach(
            (channels, category) => {

                const collapsed =
                    state.categoryState[category] === true;


                html += `
                    <section
                        class="channel-category"
                        data-category="${escapeAttribute(category)}"
                    >

                        <button
                            type="button"
                            class="channel-category-header"
                            data-category-toggle="${escapeAttribute(category)}"
                        >

                            <span class="category-chevron">
                                ${collapsed ? "▸" : "▾"}
                            </span>

                            <span>
                                ${escapeHtml(category)}
                            </span>

                            ${
                                canCreateChannel()
                                    ? `
                                        <button
                                            type="button"
                                            class="category-create-button"
                                            data-category-create="${escapeAttribute(category)}"
                                            title="Create channel in this category"
                                        >
                                            +
                                        </button>
                                    `
                                    : ""
                            }

                        </button>

                        <div
                            class="channel-list"
                            ${collapsed ? 'style="display:none"' : ""}
                        >
                `;


                channels.forEach(
                    channel => {

                        const active =
                            state.currentChannel &&
                            String(
                                state.currentChannel.id
                            ) ===
                            String(
                                channel.id
                            );


                        const unread =
                            Number(
                                state.unreadByChannel[
                                    channel.id
                                ] || 0
                            );


                        const course =
                            findCourse(
                                channel.course_id
                            );


                        html += `
                            <button
                                type="button"
                                class="channel-item ${active ? "active" : ""}"
                                data-channel-id="${escapeAttribute(channel.id)}"
                            >

                                <span class="channel-item-icon">
                                    ${
                                        channel.channel_type === "private"
                                            ? "🔒"
                                            : "#"
                                    }
                                </span>

                                <span
                                    class="channel-item-name"
                                    title="${escapeAttribute(channel.description || channel.name)}"
                                >
                                    ${escapeHtml(channel.name)}

                                    ${
                                        course
                                            ? `
                                                <small class="channel-item-course">
                                                    ${escapeHtml(course.title || course.name)}
                                                </small>
                                            `
                                            : ""
                                    }
                                </span>

                                <span class="channel-item-meta">

                                    ${
                                        unread > 0
                                            ? `
                                                <span class="channel-unread">
                                                    ${unread > 99 ? "99+" : unread}
                                                </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        channel.channel_type === "private"
                                            ? `
                                                <span class="channel-lock">
                                                    🔒
                                                </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        canManageChannel()
                                            ? `
                                                <button
                                                    type="button"
                                                    class="channel-settings-button"
                                                    data-channel-settings="${escapeAttribute(channel.id)}"
                                                    title="Channel settings"
                                                >
                                                    ⚙
                                                </button>
                                            `
                                            : ""
                                    }

                                </span>

                            </button>
                        `;

                    }
                );


                html += `
                        </div>
                    </section>
                `;

            }
        );


        navigation.innerHTML = html;


        /*
         * The category create buttons and channel settings
         * buttons are nested inside channel/header buttons.
         * Stop propagation so the parent doesn't switch channel.
         */

        navigation
            .querySelectorAll(
                "[data-category-toggle]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target.closest(
                                "[data-category-create]"
                            )
                        ) {
                            return;
                        }


                        const category =
                            button.dataset.categoryToggle;

                        state.categoryState[category] =
                            !state.categoryState[category];

                        renderChannels();

                    }
                );

            });


        navigation
            .querySelectorAll(
                "[data-category-create]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        openCreateChannelModal(
                            button.dataset.categoryCreate
                        );

                    }
                );

            });


        navigation
            .querySelectorAll(
                "[data-channel-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target.closest(
                                "[data-channel-settings]"
                            )
                        ) {
                            return;
                        }


                        switchChannel(
                            button.dataset.channelId
                        );

                    }
                );

            });


        navigation
            .querySelectorAll(
                "[data-channel-settings]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        openChannelSettings(
                            button.dataset.channelSettings
                        );

                    }
                );

            });

    }


    /* =====================================================
       FIND COURSE
    ====================================================== */

    function findCourse(courseId) {

        if (!courseId) {
            return null;
        }

        return state.courses.find(
            course =>
                String(course.id) ===
                String(courseId)
        ) || null;

    }


    /* =====================================================
       LOAD COURSES
    ====================================================== */

    async function loadCourses() {

        try {

            const result =
                await safeSelect(
                    "courses",
                    {
                        order: {
                            column: "title",
                            ascending: true
                        }
                    }
                );


            if (result.error) {
                throw result.error;
            }


            state.courses =
                result.data || [];


            populateCourseSelects();


        } catch (error) {

            console.warn(
                "Courses could not be loaded for Community:",
                error
            );

        }

    }


    function populateCourseSelects() {

        const selects = [
            $("communityCourseInput"),
            $("channelCourseInput")
        ];


        selects.forEach(select => {

            if (!select) {
                return;
            }


            const current =
                select.value;


            select.innerHTML = `
                <option value="">
                    No course link
                </option>
            `;


            state.courses.forEach(course => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    course.id;

                option.textContent =
                    course.title ||
                    course.name ||
                    `Course ${course.id}`;

                select.appendChild(
                    option
                );

            });


            if (current) {
                select.value = current;
            }

        });

    }


    /* =====================================================
       SWITCH CHANNEL
    ====================================================== */

    async function switchChannel(channelOrId) {

        let channel =
            typeof channelOrId === "object"
                ? channelOrId
                : state.channels.find(
                    item =>
                        String(item.id) ===
                        String(channelOrId)
                );


        if (!channel) {
            return;
        }


        if (
            !canViewPrivateChannel(
                channel
            )
        ) {

            showToast(
                "You do not have access to this private channel.",
                "error"
            );

            return;
        }


        state.currentChannel =
            channel;


        state.replyToMessage =
            null;


        localStorage.setItem(
            `mwanikiCommunityChannel_${state.currentCommunity.id}`,
            String(channel.id)
        );


        renderChannels();

        renderActiveChannelHeader();

        renderComposerPermission();


        await loadChannelMessages();

        await loadChannelReactions();

        await markChannelRead();

        await subscribeToChannel();

    }


    function renderActiveChannelHeader() {

        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }


        setText(
            "activeChannelName",
            channel.name
        );


        setText(
            "activeChannelDescription",
            channel.description ||
            "Community discussion channel."
        );


        setText(
            "welcomeChannelName",
            `#${channel.name}`
        );


        setText(
            "welcomeChannelDescription",
            channel.description ||
            "This is the beginning of this channel."
        );


        const privacy =
            $("activeChannelPrivacy");


        if (privacy) {

            const privateChannel =
                channel.channel_type ===
                "private";


            privacy.textContent =
                privateChannel
                    ? "Private"
                    : "Public";


            privacy.classList.toggle(
                "private",
                privateChannel
            );

        }


        const course =
            findCourse(
                channel.course_id
            );


        const badge =
            $("activeCourseBadge");


        if (
            badge &&
            course
        ) {

            badge.hidden = false;

            setText(
                "activeCourseName",
                course.title ||
                course.name ||
                "Course Discussion"
            );

        } else if (badge) {

            badge.hidden = true;

        }


        const input =
            $("messageInput");


        if (input) {

            input.placeholder =
                `Message #${channel.name}`;

        }

    }


    /* =====================================================
       CHANNEL MESSAGES
    ====================================================== */

    async function loadChannelMessages() {

        const list =
            $("messagesList");

        if (!list) {
            return;
        }


        if (!state.currentChannel) {
            return;
        }


        state.loadingMessages =
            true;


        list.innerHTML = `
            <div class="messages-loading">
                <div class="loading-spinner"></div>
                <p>Loading messages...</p>
            </div>
        `;


        try {

            const result =
                await safeSelect(
                    "chat_messages",
                    {
                        eq: {
                            channel_id:
                                state.currentChannel.id
                        },
                        order: {
                            column: "created_at",
                            ascending: true
                        }
                    }
                );


            if (result.error) {
                throw result.error;
            }


            state.messages =
                (result.data || [])
                    .map(normalizeMessage)
                    .filter(Boolean);


            await hydrateMessageProfiles();

            renderMessages();

        } catch (error) {

            console.error(
                "Message loading failed:",
                error
            );


            list.innerHTML = `
                <div class="empty-message-state">
                    <strong>
                        Unable to load messages
                    </strong>

                    <span>
                        ${escapeHtml(
                            error.message ||
                            "Please try again."
                        )}
                    </span>
                </div>
            `;

        } finally {

            state.loadingMessages =
                false;

        }

    }


    /* =====================================================
       MESSAGE PROFILE HYDRATION
    ====================================================== */

    const profileCache = new Map();


    async function getProfile(userId) {

        if (!userId) {
            return null;
        }


        if (
            profileCache.has(
                String(userId)
            )
        ) {
            return profileCache.get(
                String(userId)
            );
        }


        try {

            const result =
                await safeSelect(
                    "students",
                    {
                        eq: {
                            user_id: userId
                        },
                        limit: 1
                    }
                );


            const profile =
                !result.error &&
                result.data?.length
                    ? result.data[0]
                    : null;


            profileCache.set(
                String(userId),
                profile
            );


            return profile;

        } catch (error) {

            return null;

        }

    }


    async function hydrateMessageProfiles() {

        const uniqueIds =
            [
                ...new Set(
                    state.messages
                        .map(
                            message =>
                                message.sender_id
                        )
                        .filter(Boolean)
                )
            ];


        await Promise.all(
            uniqueIds.map(
                id =>
                    getProfile(id)
            )
        );

    }


    function getSenderDisplay(message) {

        if (
            state.user &&
            message.sender_id ===
                state.user.id
        ) {

            const name =
                state.student?.full_name ||
                state.student?.name ||
                state.student?.display_name ||
                state.user.user_metadata?.full_name ||
                state.user.user_metadata?.name ||
                state.user.email?.split("@")[0] ||
                "You";


            return {
                name,
                photo:
                    state.student?.photo_url ||
                    state.student?.avatar_url ||
                    state.user.user_metadata?.avatar_url ||
                    "",
                role:
                    state.communityRole
            };

        }


        const profile =
            profileCache.get(
                String(
                    message.sender_id
                )
            );


        return {

            name:
                profile?.full_name ||
                profile?.name ||
                profile?.display_name ||
                message.sender_name ||
                "Community Member",

            photo:
                profile?.photo_url ||
                profile?.avatar_url ||
                "",

            role:
                normalizeRole(
                    profile?.role ||
                    message.sender_role ||
                    "student"
                )

        };

    }


    /* =====================================================
       RENDER MESSAGES
    ====================================================== */

    function renderMessages() {

        const list =
            $("messagesList");

        if (!list) {
            return;
        }


        if (!state.messages.length) {

            list.innerHTML = `
                <div class="empty-message-state">
                    <strong>
                        No messages yet
                    </strong>

                    <span>
                        Start the conversation in this channel.
                    </span>
                </div>
            `;

            return;
        }


        let html = "";


        state.messages.forEach(
            (message, index) => {

                const previous =
                    state.messages[index - 1];


                const grouped =
                    previous &&
                    previous.sender_id ===
                        message.sender_id &&
                    (
                        new Date(
                            message.created_at
                        ).getTime() -
                        new Date(
                            previous.created_at
                        ).getTime()
                    ) < 5 * 60 * 1000;


                const sender =
                    getSenderDisplay(
                        message
                    );


                const date =
                    formatMessageDate(
                        message.created_at
                    );


                const reactions =
                    getMessageReactions(
                        message.id
                    );


                html += `
                    <article
                        class="message-row ${grouped ? "grouped" : ""}"
                        data-message-id="${escapeAttribute(message.id)}"
                    >

                        <div class="message-avatar-column">

                            ${
                                grouped
                                    ? ""
                                    : `
                                        <div class="avatar avatar-medium">
                                            ${
                                                sender.photo
                                                    ? `
                                                        <img
                                                            src="${escapeAttribute(sender.photo)}"
                                                            alt="${escapeAttribute(sender.name)}"
                                                            loading="lazy"
                                                        >
                                                    `
                                                    : escapeHtml(
                                                        getInitials(
                                                            sender.name
                                                        )
                                                    )
                                            }
                                        </div>
                                    `
                            }

                        </div>


                        <div class="message-content-column">

                            ${
                                !grouped
                                    ? `
                                        <div class="message-author-line">

                                            <span class="message-author">
                                                ${escapeHtml(sender.name)}
                                            </span>

                                            <span class="message-role">
                                                ${escapeHtml(
                                                    roleLabel(
                                                        sender.role
                                                    )
                                                )}
                                            </span>

                                            <time class="message-time">
                                                ${escapeHtml(date)}
                                            </time>

                                            ${
                                                message.updated_at
                                                    ? `
                                                        <span class="message-edited">
                                                            edited
                                                        </span>
                                                    `
                                                    : ""
                                            }

                                        </div>
                                    `
                                    : ""
                            }


                            ${
                                message.reply_to_id ||
                                message.parent_message_id ||
                                message.reply_message_id
                                    ? renderReplyPreview(
                                        message
                                    )
                                    : ""
                            }


                            <div class="message-content">
                                ${formatMessageContent(
                                    message.content
                                )}
                            </div>


                            ${renderMessageAttachments(message)}


                            ${
                                reactions.length
                                    ? renderReactionChips(
                                        message.id,
                                        reactions
                                    )
                                    : ""
                            }

                        </div>


                        <div class="message-actions">

                            <button
                                type="button"
                                class="message-action"
                                data-message-reply="${escapeAttribute(message.id)}"
                                title="Reply"
                            >
                                ↩
                            </button>

                            <button
                                type="button"
                                class="message-action"
                                data-message-react="${escapeAttribute(message.id)}"
                                title="React"
                            >
                                ☺
                            </button>

                            ${
                                canDeleteMessage(message)
                                    ? `
                                        <button
                                            type="button"
                                            class="message-action danger"
                                            data-message-delete="${escapeAttribute(message.id)}"
                                            title="Delete"
                                        >
                                            🗑
                                        </button>
                                    `
                                    : ""
                            }

                        </div>

                    </article>
                `;

            }
        );


        list.innerHTML =
            html;


        bindMessageActions();


        requestAnimationFrame(
            () => {
                list.scrollTop =
                    list.scrollHeight;
            }
        );

    }


    function formatMessageContent(content) {

        let safe =
            escapeHtml(
                content || ""
            );


        /*
         * Basic URL linking without
         * executing arbitrary HTML.
         */

        safe =
            safe.replace(
                /(https?:\/\/[^\s<]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            );


        /*
         * Highlight mentions.
         */

        safe =
            safe.replace(
                /(^|\s)(@[a-zA-Z0-9_.-]+)/g,
                '$1<strong>$2</strong>'
            );


        return safe;

    }


    function formatMessageDate(timestamp) {

        if (!timestamp) {
            return "";
        }


        const date =
            new Date(timestamp);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }


        const now =
            new Date();


        const sameDay =
            date.toDateString() ===
            now.toDateString();


        if (sameDay) {

            return date.toLocaleTimeString(
                [],
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            );

        }


        return date.toLocaleDateString(
            [],
            {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );

    }


    function renderReplyPreview(message) {

        const replyId =
            message.reply_to_id ||
            message.parent_message_id ||
            message.reply_message_id;


        const parent =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(replyId)
            );


        if (!parent) {
            return "";
        }


        const sender =
            getSenderDisplay(
                parent
            );


        return `
            <div class="message-reply-preview">
                <strong>
                    ${escapeHtml(sender.name)}
                </strong>

                ${escapeHtml(
                    String(
                        parent.content || ""
                    ).slice(0, 180)
                )}
            </div>
        `;

    }


    function renderMessageAttachments(message) {

        const attachments =
            message.attachments ||
            message.chat_attachments ||
            [];


        if (
            !Array.isArray(
                attachments
            ) ||
            !attachments.length
        ) {
            return "";
        }


        return `
            <div class="message-attachments">

                ${
                    attachments
                        .map(
                            attachment => `
                                <a
                                    class="message-attachment"
                                    href="${escapeAttribute(
                                        attachment.file_url ||
                                        attachment.url ||
                                        attachment.file_path ||
                                        "#"
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >

                                    <span class="attachment-icon">
                                        📎
                                    </span>

                                    <span class="attachment-details">

                                        <strong>
                                            ${escapeHtml(
                                                attachment.file_name ||
                                                attachment.name ||
                                                "Attachment"
                                            )}
                                        </strong>

                                        <span>
                                            Open attachment
                                        </span>

                                    </span>

                                </a>
                            `
                        )
                        .join("")
                }

            </div>
        `;

    }


    /* =====================================================
       REACTIONS
    ====================================================== */

    function getMessageReactions(messageId) {

        return state.reactions.filter(
            reaction =>
                String(
                    reaction.message_id
                ) ===
                String(messageId)
        );

    }


    function renderReactionChips(
        messageId,
        reactions
    ) {

        const grouped =
            new Map();


        reactions.forEach(
            reaction => {

                const emoji =
                    reaction.reaction ||
                    reaction.emoji ||
                    "👍";


                if (!grouped.has(emoji)) {
                    grouped.set(
                        emoji,
                        {
                            count: 0,
                            reacted: false
                        }
                    );
                }


                const item =
                    grouped.get(
                        emoji
                    );


                item.count++;


                if (
                    state.user &&
                    reaction.user_id ===
                        state.user.id
                ) {
                    item.reacted = true;
                }

            }
        );


        return `
            <div class="message-reactions">

                ${
                    [...grouped.entries()]
                        .map(
                            ([emoji, info]) => `
                                <button
                                    type="button"
                                    class="reaction-chip ${info.reacted ? "reacted" : ""}"
                                    data-reaction-message="${escapeAttribute(messageId)}"
                                    data-reaction="${escapeAttribute(emoji)}"
                                >

                                    <span>
                                        ${escapeHtml(emoji)}
                                    </span>

                                    <span class="reaction-count">
                                        ${info.count}
                                    </span>

                                </button>
                            `
                        )
                        .join("")
                }

            </div>
        `;

    }


    async function loadChannelReactions() {

        if (!state.currentChannel) {
            return;
        }


        try {

            const result =
                await safeSelect(
                    "chat_message_reactions",
                    {
                        eq: {
                            channel_id:
                                state.currentChannel.id
                        }
                    }
                );


            /*
             * If reactions table does not contain channel_id,
             * load by message IDs instead.
             */

            if (result.error) {

                const ids =
                    state.messages.map(
                        message =>
                            message.id
                    );


                if (!ids.length) {
                    state.reactions = [];
                    return;
                }


                const retry =
                    await safeSelect(
                        "chat_message_reactions",
                        {
                            in: {
                                message_id: ids
                            }
                        }
                    );


                if (retry.error) {
                    throw retry.error;
                }


                state.reactions =
                    retry.data || [];

            } else {

                state.reactions =
                    result.data || [];

            }


            renderMessages();

        } catch (error) {

            console.warn(
                "Reaction loading skipped:",
                error
            );

            state.reactions = [];

        }

    }


    async function toggleReaction(
        messageId,
        emoji
    ) {

        if (!state.user) {
            return;
        }


        const client =
            db();


        const existing =
            state.reactions.find(
                reaction =>
                    String(
                        reaction.message_id
                    ) ===
                    String(messageId) &&
                    reaction.user_id ===
                    state.user.id &&
                    (
                        reaction.reaction ||
                        reaction.emoji
                    ) === emoji
            );


        try {

            if (existing) {

                const result =
                    await client
                        .from(
                            "chat_message_reactions"
                        )
                        .delete()
                        .eq(
                            "id",
                            existing.id
                        );


                if (result.error) {
                    throw result.error;
                }


            } else {

                const result =
                    await client
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


                if (result.error) {
                    throw result.error;
                }

            }


            await loadChannelReactions();

        } catch (error) {

            console.error(
                "Reaction error:",
                error
            );


            showToast(
                "Reaction could not be saved.",
                "error"
            );

        }

    }


    /* =====================================================
       MESSAGE ACTIONS
    ====================================================== */

    function bindMessageActions() {

        document
            .querySelectorAll(
                "[data-message-reply]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            beginReply(
                                button.dataset.messageReply
                            );

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-message-react]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        event => {

                            openEmojiPicker(
                                event,
                                button.dataset.messageReact
                            );

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-message-delete]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            await deleteMessage(
                                button.dataset.messageDelete
                            );

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-reaction-message]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            await toggleReaction(
                                button.dataset.reactionMessage,
                                button.dataset.reaction
                            );

                        }
                    );

                }
            );

    }


    function beginReply(messageId) {

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );


        if (!message) {
            return;
        }


        state.replyToMessage =
            message;


        const sender =
            getSenderDisplay(
                message
            );


        setText(
            "replyToAuthor",
            sender.name
        );


        showElement(
            "replyBanner"
        );


        const input =
            $("messageInput");


        if (input) {
            input.focus();
        }

    }


    function cancelReply() {

        state.replyToMessage =
            null;

        hideElement(
            "replyBanner"
        );

    }


    /* =====================================================
       SEND MESSAGE
    ====================================================== */

    async function sendMessage() {

        if (
            state.sendingMessage ||
            !state.currentChannel ||
            !state.user
        ) {
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


        const content =
            String(
                input?.value || ""
            ).trim();


        if (!content) {
            return;
        }


        state.sendingMessage =
            true;


        const client =
            db();


        try {

            const payload = {

                channel_id:
                    state.currentChannel.id,

                sender_id:
                    state.user.id,

                content:
                    content

            };


            /*
             * Phase 3 supports replying when the schema
             * contains reply_to_id.
             *
             * We first try the reply field and fall back
             * to a normal message if the current schema
             * does not contain it.
             */

            if (
                state.replyToMessage
            ) {

                payload.reply_to_id =
                    state.replyToMessage.id;

            }


            let result =
                await client
                    .from(
                        "chat_messages"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();


            if (
                result.error &&
                state.replyToMessage
            ) {

                const fallbackPayload = {

                    channel_id:
                        state.currentChannel.id,

                    sender_id:
                        state.user.id,

                    content:
                        content

                };


                result =
                    await client
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
                throw result.error;
            }


            if (input) {
                input.value = "";
                autoResizeTextarea(input);
            }


            cancelReply();


            if (result.data) {

                const message =
                    normalizeMessage(
                        result.data
                    );


                const exists =
                    state.messages.some(
                        item =>
                            String(item.id) ===
                            String(message.id)
                    );


                if (!exists) {

                    state.messages.push(
                        message
                    );

                    await getProfile(
                        message.sender_id
                    );

                    renderMessages();

                }

            }


        } catch (error) {

            console.error(
                "Send message failed:",
                error
            );


            showToast(
                error.message ||
                "Message could not be sent.",
                "error"
            );

        } finally {

            state.sendingMessage =
                false;

        }

    }


    /* =====================================================
       DELETE MESSAGE
    ====================================================== */

    async function deleteMessage(messageId) {

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
            !canDeleteMessage(
                message
            )
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


        try {

            const result =
                await db()
                    .from(
                        "chat_messages"
                    )
                    .delete()
                    .eq(
                        "id",
                        message.id
                    );


            if (result.error) {
                throw result.error;
            }


            state.messages =
                state.messages.filter(
                    item =>
                        String(item.id) !==
                        String(message.id)
                );


            renderMessages();


            showToast(
                "Message deleted."
            );

        } catch (error) {

            console.error(
                "Delete message error:",
                error
            );


            showToast(
                "Message could not be deleted.",
                "error"
            );

        }

    }


    /* =====================================================
       MARK READ
    ====================================================== */

    async function markChannelRead() {

        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }


        const latest =
            state.messages[
                state.messages.length - 1
            ];


        if (!latest) {
            return;
        }


        state.unreadByChannel[
            state.currentChannel.id
        ] = 0;


        renderChannels();


        try {

            const client =
                db();


            /*
             * Try message ID based read status first.
             */

            const payload = {

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                last_read_message_id:
                    latest.id

            };


            let result =
                await client
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


            /*
             * Some installations may use last_read_at
             * instead of last_read_message_id.
             */

            if (result.error) {

                result =
                    await client
                        .from(
                            "chat_read_status"
                        )
                        .upsert(
                            {
                                channel_id:
                                    state.currentChannel.id,

                                user_id:
                                    state.user.id,

                                last_read_at:
                                    new Date()
                                        .toISOString()
                            },
                            {
                                onConflict:
                                    "channel_id,user_id"
                            }
                        );

            }


            if (result.error) {

                console.warn(
                    "Read status could not be saved:",
                    result.error
                );

            }

        } catch (error) {

            console.warn(
                "Read status error:",
                error
            );

        }

    }


    /* =====================================================
       LOAD MEMBERS
    ====================================================== */

    async function loadMembers() {

        if (
            !state.currentCommunity
        ) {
            return;
        }


        try {

            const result =
                await safeSelect(
                    "chat_community_members",
                    {
                        eq: {
                            community_id:
                                state.currentCommunity.id
                        }
                    }
                );


            if (result.error) {
                throw result.error;
            }


            const memberships =
                result.data || [];


            const userIds =
                memberships
                    .map(
                        member =>
                            member.user_id
                    )
                    .filter(Boolean);


            const profiles =
                new Map();


            if (userIds.length) {

                try {

                    const profileResult =
                        await safeSelect(
                            "students",
                            {
                                in: {
                                    user_id:
                                        userIds
                                }
                            }
                        );


                    if (
                        !profileResult.error
                    ) {

                        (
                            profileResult.data ||
                            []
                        ).forEach(
                            profile => {

                                profiles.set(
                                    String(
                                        profile.user_id
                                    ),
                                    profile
                                );

                            }
                        );

                    }

                } catch (error) {

                    console.warn(
                        "Member profile lookup skipped:",
                        error
                    );

                }

            }


            state.members =
                memberships.map(
                    membership => {

                        const profile =
                            profiles.get(
                                String(
                                    membership.user_id
                                )
                            );


                        return {

                            ...membership,

                            user_id:
                                membership.user_id,

                            role:
                                normalizeRole(
                                    membership.role ||
                                    "student"
                                ),

                            name:
                                profile?.full_name ||
                                profile?.name ||
                                profile?.display_name ||
                                membership.display_name ||
                                membership.user_name ||
                                "Community Member",

                            photo:
                                profile?.photo_url ||
                                profile?.avatar_url ||
                                ""

                        };

                    }
                );


            renderMembers();

        } catch (error) {

            console.error(
                "Member loading failed:",
                error
            );


            state.members = [];

            renderMembers();

        }

    }


    /* =====================================================
       RENDER MEMBERS
    ====================================================== */

    function renderMembers() {

        const list =
            $("memberList");


        if (!list) {
            return;
        }


        const search =
            String(
                $("memberSearchInput")?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        let members =
            state.members;


        if (search) {

            members =
                members.filter(
                    member =>
                        String(
                            member.name
                        )
                            .toLowerCase()
                            .includes(search) ||
                        roleLabel(
                            member.role
                        )
                            .toLowerCase()
                            .includes(search)
                );

        }


        setText(
            "memberCount",
            String(
                state.members.length
            )
        );


        if (!members.length) {

            list.innerHTML = `
                <div class="members-loading">
                    No members found.
                </div>
            `;

            return;
        }


        const groups = {

            super_admin: [],
            admin: [],
            moderator: [],
            tutor: [],
            student: []

        };


        members.forEach(
            member => {

                const role =
                    normalizeRole(
                        member.role
                    );


                if (
                    groups[role]
                ) {
                    groups[role].push(
                        member
                    );
                } else {
                    groups.student.push(
                        member
                    );
                }

            }
        );


        const roleOrder = [
            "super_admin",
            "admin",
            "moderator",
            "tutor",
            "student"
        ];


        let html = "";


        roleOrder.forEach(
            role => {

                if (
                    !groups[role].length
                ) {
                    return;
                }


                html += `
                    <section class="member-group">

                        <div class="member-group-title">
                            ${escapeHtml(
                                roleLabel(role)
                            )}
                            —
                            ${groups[role].length}
                        </div>
                `;


                groups[role].forEach(
                    member => {

                        const online =
                            isUserOnline(
                                member.user_id
                            );


                        html += `
                            <button
                                type="button"
                                class="member-item"
                                data-member-id="${escapeAttribute(member.user_id)}"
                            >

                                <div class="avatar avatar-small">

                                    ${
                                        member.photo
                                            ? `
                                                <img
                                                    src="${escapeAttribute(member.photo)}"
                                                    alt="${escapeAttribute(member.name)}"
                                                    loading="lazy"
                                                >
                                            `
                                            : escapeHtml(
                                                getInitials(
                                                    member.name
                                                )
                                            )
                                    }

                                    <span
                                        class="presence-dot ${online ? "online" : ""}"
                                    ></span>

                                </div>


                                <div class="member-item-info">

                                    <strong>
                                        ${escapeHtml(
                                            member.name
                                        )}
                                    </strong>

                                    <span>
                                        ${
                                            online
                                                ? "Online"
                                                : "Offline"
                                        }
                                    </span>

                                </div>


                                <span class="member-role-label">
                                    ${escapeHtml(
                                        roleLabel(
                                            member.role
                                        )
                                    )}
                                </span>

                            </button>
                        `;

                    }
                );


                html += `
                    </section>
                `;

            }
        );


        list.innerHTML =
            html;


        list
            .querySelectorAll(
                "[data-member-id]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            openMemberRoleEditor(
                                button.dataset.memberId
                            );

                        }
                    );

                    if (!canManageMembers()) {
                        button.style.cursor =
                            "default";
                    }

                }
            );

    }


    function isUserOnline(userId) {

        return state.presence.some(
            presence =>
                presence.user_id ===
                userId &&
                (
                    presence.status ===
                        "online" ||
                    presence.status ===
                        "active"
                )
        );

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

            const payload = {

                user_id:
                    state.user.id,

                status:
                    status,

                last_seen:
                    new Date()
                        .toISOString()

            };


            const result =
                await db()
                    .from(
                        "chat_presence"
                    )
                    .upsert(
                        payload,
                        {
                            onConflict:
                                "user_id"
                        }
                    );


            if (result.error) {
                console.warn(
                    "Presence update:",
                    result.error
                );
            }

        } catch (error) {

            console.warn(
                "Presence update failed:",
                error
            );

        }

    }


    async function loadPresence() {

        try {

            const result =
                await safeSelect(
                    "chat_presence"
                );


            if (!result.error) {

                state.presence =
                    result.data || [];

                renderMembers();

            }

        } catch (error) {

            console.warn(
                "Presence loading skipped:",
                error
            );

        }

    }


    /* =====================================================
       REALTIME SUBSCRIPTIONS
    ====================================================== */

    async function clearRealtimeSubscriptions() {

        const client =
            db();


        if (!client) {
            return;
        }


        for (
            const channel
            of state.subscriptions
        ) {

            try {
                await client.removeChannel(
                    channel
                );
            } catch (error) {
                console.warn(
                    "Realtime cleanup:",
                    error
                );
            }

        }


        state.subscriptions = [];

    }


    async function subscribeToCommunity() {

        const client =
            db();


        if (
            !client ||
            !state.currentCommunity
        ) {
            return;
        }


        const communityId =
            state.currentCommunity.id;


        const channel =
            client
                .channel(
                    `mwaniki-community-${communityId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_presence"
                    },
                    payload => {

                        loadPresence();

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
                    payload => {

                        loadMembers();

                        loadCurrentCommunityRole();

                    }
                )
                .subscribe();


        state.subscriptions.push(
            channel
        );

    }


    async function subscribeToChannel() {

        const client =
            db();


        if (
            !client ||
            !state.currentChannel
        ) {
            return;
        }


        /*
         * Remove previous channel-level
         * subscriptions.
         */

        const previous =
            state.subscriptions.filter(
                channel =>
                    channel.__mwanikiChannelSubscription
            );


        for (
            const channel
            of previous
        ) {

            try {

                await client.removeChannel(
                    channel
                );

            } catch (error) {}

            state.subscriptions =
                state.subscriptions.filter(
                    item =>
                        item !== channel
                );

        }


        const channelId =
            state.currentChannel.id;


        const realtime =
            client
                .channel(
                    `mwaniki-chat-channel-${channelId}`
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

                        await handleRealtimeMessage(
                            payload.new
                        );

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

                        await loadChannelReactions();

                    }
                )
                .subscribe();


        realtime.__mwanikiChannelSubscription =
            true;


        state.subscriptions.push(
            realtime
        );

    }


    async function handleRealtimeMessage(
        rawMessage
    ) {

        const message =
            normalizeMessage(
                rawMessage
            );


        if (!message) {
            return;
        }


        const exists =
            state.messages.some(
                item =>
                    String(item.id) ===
                    String(message.id)
            );


        if (exists) {
            return;
        }


        state.messages.push(
            message
        );


        await getProfile(
            message.sender_id
        );


        /*
         * If another user sent the message,
         * create a local unread count until
         * the user opens the channel.
         */

        if (
            !state.user ||
            message.sender_id !==
                state.user.id
        ) {

            state.unreadByChannel[
                message.channel_id
            ] =
                Number(
                    state.unreadByChannel[
                        message.channel_id
                    ] || 0
                ) + 1;

        }


        renderMessages();
        renderChannels();


        /*
         * Keep the active channel at the bottom
         * if the user is already near the bottom.
         */

        const list =
            $("messagesList");


        if (list) {

            const distance =
                list.scrollHeight -
                list.scrollTop -
                list.clientHeight;


            if (
                distance < 180 ||
                message.sender_id ===
                    state.user?.id
            ) {

                requestAnimationFrame(
                    () => {
                        list.scrollTop =
                            list.scrollHeight;
                    }
                );

            }

        }

    }


    /* =====================================================
       NOTIFICATIONS
    ====================================================== */

    async function loadCommunityNotifications() {

        if (!state.user) {
            return;
        }


        try {

            const result =
                await safeSelect(
                    "chat_notifications",
                    {
                        eq: {
                            user_id:
                                state.user.id
                        },
                        order: {
                            column: "created_at",
                            ascending: false
                        },
                        limit: 50
                    }
                );


            if (result.error) {
                throw result.error;
            }


            state.notifications =
                result.data || [];


            renderNotifications();

        } catch (error) {

            console.warn(
                "Community notification loading:",
                error
            );


            state.notifications = [];

            renderNotifications();

        }

    }


    function notificationUnread(
        notification
    ) {

        return (
            notification.read === false ||
            notification.is_read === false ||
            (
                notification.read_at ===
                null &&
                notification.read !== true &&
                notification.is_read !== true
            )
        );

    }


    function renderNotifications() {

        const content =
            $("communityNotificationContent");


        if (!content) {
            return;
        }


        const unread =
            state.notifications.filter(
                notificationUnread
            ).length;


        setText(
            "notificationPanelCount",
            String(unread)
        );


        const badge =
            $("communityNotificationBadge");


        if (badge) {

            badge.textContent =
                unread > 99
                    ? "99+"
                    : String(unread);

            badge.hidden =
                unread === 0;

        }


        if (!state.notifications.length) {

            content.innerHTML = `
                <div class="empty-state-small">
                    No notifications.
                </div>
            `;

            return;
        }


        content.innerHTML =
            state.notifications
                .map(
                    notification => {

                        const unreadItem =
                            notificationUnread(
                                notification
                            );


                        return `
                            <article
                                class="notification-item ${unreadItem ? "unread" : ""}"
                                data-notification-id="${escapeAttribute(notification.id)}"
                            >

                                <div class="notification-item-title">
                                    ${escapeHtml(
                                        notification.title ||
                                        notification.type ||
                                        "Community notification"
                                    )}
                                </div>

                                <div class="notification-item-body">
                                    ${escapeHtml(
                                        notification.message ||
                                        notification.content ||
                                        notification.body ||
                                        ""
                                    )}
                                </div>

                                <div class="notification-item-time">
                                    ${escapeHtml(
                                        formatMessageDate(
                                            notification.created_at
                                        )
                                    )}
                                </div>

                            </article>
                        `;

                    }
                )
                .join("");


        content
            .querySelectorAll(
                "[data-notification-id]"
            )
            .forEach(
                item => {

                    item.addEventListener(
                        "click",
                        async () => {

                            await markNotificationRead(
                                item.dataset.notificationId
                            );

                        }
                    );

                }
            );

    }


    async function markNotificationRead(
        notificationId
    ) {

        if (!notificationId) {
            return;
        }


        try {

            let result =
                await db()
                    .from(
                        "chat_notifications"
                    )
                    .update({
                        read: true
                    })
                    .eq(
                        "id",
                        notificationId
                    );


            if (
                result.error
            ) {

                result =
                    await db()
                        .from(
                            "chat_notifications"
                        )
                        .update({
                            is_read: true
                        })
                        .eq(
                            "id",
                            notificationId
                        );

            }


            if (result.error) {
                throw result.error;
            }


            const notification =
                state.notifications.find(
                    item =>
                        String(item.id) ===
                        String(notificationId)
                );


            if (notification) {

                notification.read =
                    true;

                notification.is_read =
                    true;

            }


            renderNotifications();

        } catch (error) {

            console.warn(
                "Notification read status:",
                error
            );

        }

    }


    async function markAllNotificationsRead() {

        if (!state.user) {
            return;
        }


        try {

            let result =
                await db()
                    .from(
                        "chat_notifications"
                    )
                    .update({
                        read: true
                    })
                    .eq(
                        "user_id",
                        state.user.id
                    );


            if (
                result.error
            ) {

                result =
                    await db()
                        .from(
                            "chat_notifications"
                        )
                        .update({
                            is_read: true
                        })
                        .eq(
                            "user_id",
                            state.user.id
                        );

            }


            if (result.error) {
                throw result.error;
            }


            state.notifications.forEach(
                notification => {

                    notification.read =
                        true;

                    notification.is_read =
                        true;

                }
            );


            renderNotifications();


            showToast(
                "All notifications marked as read."
            );

        } catch (error) {

            console.error(
                "Mark all notifications error:",
                error
            );


            showToast(
                "Notifications could not be updated.",
                "error"
            );

        }

    }


    /* =====================================================
       COMMUNITY CREATION
    ====================================================== */

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


        const name =
            String(
                $("communityNameInput")?.value ||
                ""
            ).trim();


        const description =
            String(
                $("communityDescriptionInput")?.value ||
                ""
            ).trim();


        const visibility =
            $("communityVisibilityInput")?.value ||
            "public";


        const courseId =
            $("communityCourseInput")?.value ||
            null;


        if (!name) {
            showFormError(
                "communityFormError",
                "Community name is required."
            );
            return;
        }


        clearFormError(
            "communityFormError"
        );


        const button =
            $("saveCommunityButton");


        if (button) {
            button.disabled = true;
            button.textContent =
                "Creating...";
        }


        try {

            const client =
                db();


            const basePayload = {

                name:
                    name,

                description:
                    description,

                owner_id:
                    state.user.id

            };


            let payload = {
                ...basePayload
            };


            /*
             * First attempt includes the Phase 3
             * visibility/course fields.
             */

            payload.visibility =
                visibility;


            if (courseId) {
                payload.course_id =
                    Number(courseId);
            }


            let result =
                await client
                    .from(
                        "chat_communities"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();


            /*
             * If optional Phase 3 fields are not present
             * in an older database, fall back to the
             * established Phase 1 fields.
             */

            if (
                result.error
            ) {

                result =
                    await client
                        .from(
                            "chat_communities"
                        )
                        .insert(
                            basePayload
                        )
                        .select()
                        .single();

            }


            if (result.error) {
                throw result.error;
            }


            const community =
                normalizeCommunity(
                    result.data
                );


            if (community) {

                state.communities.push(
                    community
                );


                /*
                 * Create the owner membership.
                 */

                try {

                    await client
                        .from(
                            "chat_community_members"
                        )
                        .insert({
                            community_id:
                                community.id,

                            user_id:
                                state.user.id,

                            role:
                                "admin"
                        });

                } catch (membershipError) {

                    console.warn(
                        "Owner membership creation:",
                        membershipError
                    );

                }


                /*
                 * Create a basic general channel.
                 */

                try {

                    await createInitialGeneralChannel(
                        community.id
                    );

                } catch (channelError) {

                    console.warn(
                        "Initial channel creation:",
                        channelError
                    );

                }


                closeModal(
                    "communityModal"
                );


                resetCommunityForm();


                await loadCommunities();

                await switchCommunity(
                    community.id
                );


                showToast(
                    "Community created successfully."
                );

            }

        } catch (error) {

            console.error(
                "Create community failed:",
                error
            );


            showFormError(
                "communityFormError",
                error.message ||
                "Community could not be created."
            );

        } finally {

            if (button) {
                button.disabled = false;
                button.textContent =
                    "Create Community";
            }

        }

    }


    async function createInitialGeneralChannel(
        communityId
    ) {

        const client =
            db();


        const payload = {

            community_id:
                communityId,

            name:
                "general-chat",

            description:
                "General community discussion.",

            channel_type:
                "public"

        };


        /*
         * Optional category field is attempted first.
         */

        let result =
            await client
                .from(
                    "chat_channels"
                )
                .insert({
                    ...payload,
                    category:
                        "Community"
                });


        if (
            result.error
        ) {

            result =
                await client
                    .from(
                        "chat_channels"
                    )
                    .insert(
                        payload
                    );

        }


        if (result.error) {
            throw result.error;
        }

    }


    function resetCommunityForm() {

        const form =
            $("communityForm");

        if (form) {
            form.reset();
        }


        clearFormError(
            "communityFormError"
        );

    }


    /* =====================================================
       CHANNEL CREATION
    ====================================================== */

    function openCreateChannelModal(
        preferredCategory = ""
    ) {

        if (!canCreateChannel()) {

            showToast(
                "You do not have permission to create channels.",
                "error"
            );

            return;
        }


        if (!state.currentCommunity) {
            return;
        }


        setText(
            "channelModalCommunityText",
            `Add a channel to ${state.currentCommunity.name}.`
        );


        const category =
            $("channelCategoryInput");


        if (
            category &&
            preferredCategory
        ) {

            const exists =
                [...category.options]
                    .some(
                        option =>
                            option.value ===
                            preferredCategory
                    );


            if (exists) {
                category.value =
                    preferredCategory;
            }

        }


        openModal(
            "channelModal"
        );


        setTimeout(
            () => {
                $("channelNameInput")?.focus();
            },
            50
        );

    }


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


        if (!state.currentCommunity) {
            return;
        }


        const name =
            String(
                $("channelNameInput")?.value ||
                ""
            )
                .trim()
                .replace(/^#+/, "");


        const description =
            String(
                $("channelDescriptionInput")?.value ||
                ""
            )
                .trim();


        const category =
            $("channelCategoryInput")?.value ||
            "Community";


        const visibility =
            $("channelVisibilityInput")?.value ||
            "public";


        const courseId =
            $("channelCourseInput")?.value ||
            null;


        if (!name) {

            showFormError(
                "channelFormError",
                "Channel name is required."
            );

            return;
        }


        clearFormError(
            "channelFormError"
        );


        const button =
            $("saveChannelButton");


        if (button) {

            button.disabled =
                true;

            button.textContent =
                "Creating...";

        }


        try {

            const client =
                db();


            const basePayload = {

                community_id:
                    state.currentCommunity.id,

                name:
                    name,

                description:
                    description,

                channel_type:
                    visibility

            };


            let payload = {
                ...basePayload,

                category:
                    category
            };


            if (courseId) {
                payload.course_id =
                    Number(courseId);
            }


            let result =
                await client
                    .from(
                        "chat_channels"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();


            /*
             * Fallback for installations where optional
             * Phase 3 category/course columns aren't yet
             * present.
             */

            if (
                result.error
            ) {

                const fallback =
                    await client
                        .from(
                            "chat_channels"
                        )
                        .insert(
                            basePayload
                        )
                        .select()
                        .single();


                if (
                    !fallback.error
                ) {
                    result =
                        fallback;
                }

            }


            if (result.error) {
                throw result.error;
            }


            const channel =
                normalizeChannel(
                    result.data
                );


            if (channel) {

                state.channels.push(
                    channel
                );

            }


            closeModal(
                "channelModal"
            );


            const form =
                $("channelForm");


            if (form) {
                form.reset();
            }


            await loadChannels();


            if (channel) {

                await switchChannel(
                    channel.id
                );

            }


            showToast(
                "Channel created successfully."
            );

        } catch (error) {

            console.error(
                "Create channel error:",
                error
            );


            showFormError(
                "channelFormError",
                error.message ||
                "Channel could not be created."
            );

        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Create Channel";

            }

        }

    }


    /* =====================================================
       COMMUNITY SETTINGS
    ====================================================== */

    function openCommunitySettings() {

        if (
            !canManageCommunity() ||
            !state.currentCommunity
        ) {

            showToast(
                "You do not have permission to manage this community.",
                "error"
            );

            return;
        }


        const community =
            state.currentCommunity;


        setText(
            "communitySettingsName",
            community.name
        );


        const name =
            $("editCommunityNameInput");


        const description =
            $("editCommunityDescriptionInput");


        const visibility =
            $("editCommunityVisibilityInput");


        if (name) {
            name.value =
                community.name || "";
        }


        if (description) {
            description.value =
                community.description || "";
        }


        if (visibility) {
            visibility.value =
                community.visibility ===
                "private"
                    ? "private"
                    : "public";
        }


        clearFormError(
            "communitySettingsError"
        );


        openModal(
            "communitySettingsModal"
        );

    }


    async function saveCommunitySettings() {

        if (
            !canManageCommunity() ||
            !state.currentCommunity
        ) {
            return;
        }


        const community =
            state.currentCommunity;


        const name =
            String(
                $("editCommunityNameInput")?.value ||
                ""
            ).trim();


        const description =
            String(
                $("editCommunityDescriptionInput")?.value ||
                ""
            ).trim();


        const visibility =
            $("editCommunityVisibilityInput")?.value ||
            "public";


        if (!name) {

            showFormError(
                "communitySettingsError",
                "Community name is required."
            );

            return;
        }


        try {

            let result =
                await db()
                    .from(
                        "chat_communities"
                    )
                    .update({
                        name:
                            name,

                        description:
                            description,

                        visibility:
                            visibility
                    })
                    .eq(
                        "id",
                        community.id
                    );


            if (result.error) {

                result =
                    await db()
                        .from(
                            "chat_communities"
                        )
                        .update({
                            name:
                                name,

                            description:
                                description
                        })
                        .eq(
                            "id",
                            community.id
                        );

            }


            if (result.error) {
                throw result.error;
            }


            Object.assign(
                community,
                {
                    name,
                    description,
                    visibility
                }
            );


            closeModal(
                "communitySettingsModal"
            );


            renderCommunitySwitcher();


            renderCommunityHeader();


            showToast(
                "Community settings saved."
            );

        } catch (error) {

            console.error(
                "Community settings error:",
                error
            );


            showFormError(
                "communitySettingsError",
                error.message ||
                "Settings could not be saved."
            );

        }

    }


    function renderCommunityHeader() {

        if (!state.currentCommunity) {
            return;
        }


        const community =
            state.currentCommunity;


        setText(
            "currentCommunityName",
            community.name
        );


        setText(
            "currentCommunityInitials",
            getInitials(
                community.name
            )
        );


        setText(
            "sidebarCommunityName",
            community.name
        );


        setText(
            "sidebarCommunityDescription",
            community.description ||
            "Connect and learn together."
        );


        const privateBadge =
            $("sidebarCommunityPrivateBadge");


        if (privateBadge) {

            privateBadge.hidden =
                community.visibility !==
                "private";

        }

    }


    /* =====================================================
       CHANNEL SETTINGS
    ====================================================== */

    function openChannelSettings(
        channelId
    ) {

        if (!canManageChannel()) {

            showToast(
                "You do not have permission to manage channels.",
                "error"
            );

            return;
        }


        const channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(channelId)
            );


        if (!channel) {
            return;
        }


        state.editingChannel =
            channel;


        setText(
            "channelSettingsName",
            `#${channel.name}`
        );


        const name =
            $("editChannelNameInput");


        const description =
            $("editChannelDescriptionInput");


        const visibility =
            $("editChannelVisibilityInput");


        const category =
            $("editChannelCategoryInput");


        if (name) {
            name.value =
                channel.name || "";
        }


        if (description) {
            description.value =
                channel.description || "";
        }


        if (visibility) {
            visibility.value =
                channel.channel_type ===
                "private"
                    ? "private"
                    : "public";
        }


        if (category) {

            const exists =
                [...category.options]
                    .some(
                        option =>
                            option.value ===
                            channel.category
                    );


            if (exists) {
                category.value =
                    channel.category;
            }

        }


        clearFormError(
            "channelSettingsError"
        );


        openModal(
            "channelSettingsModal"
        );

    }


    async function saveChannelSettings() {

        if (
            !canManageChannel() ||
            !state.editingChannel
        ) {
            return;
        }


        const channel =
            state.editingChannel;


        const name =
            String(
                $("editChannelNameInput")?.value ||
                ""
            ).trim();


        const description =
            String(
                $("editChannelDescriptionInput")?.value ||
                ""
            ).trim();


        const visibility =
            $("editChannelVisibilityInput")?.value ||
            "public";


        const category =
            $("editChannelCategoryInput")?.value ||
            "Community";


        if (!name) {

            showFormError(
                "channelSettingsError",
                "Channel name is required."
            );

            return;
        }


        try {

            let result =
                await db()
                    .from(
                        "chat_channels"
                    )
                    .update({
                        name:
                            name,

                        description:
                            description,

                        channel_type:
                            visibility,

                        category:
                            category
                    })
                    .eq(
                        "id",
                        channel.id
                    );


            if (result.error) {

                result =
                    await db()
                        .from(
                            "chat_channels"
                        )
                        .update({
                            name:
                                name,

                            description:
                                description,

                            channel_type:
                                visibility
                        })
                        .eq(
                            "id",
                            channel.id
                        );

            }


            if (result.error) {
                throw result.error;
            }


            Object.assign(
                channel,
                {
                    name,
                    description,
                    channel_type:
                        visibility,
                    category
                }
            );


            closeModal(
                "channelSettingsModal"
            );


            renderChannels();


            if (
                state.currentChannel &&
                String(
                    state.currentChannel.id
                ) ===
                String(channel.id)
            ) {

                renderActiveChannelHeader();

            }


            showToast(
                "Channel settings saved."
            );

        } catch (error) {

            console.error(
                "Channel settings error:",
                error
            );


            showFormError(
                "channelSettingsError",
                error.message ||
                "Channel settings could not be saved."
            );

        }

    }


    /* =====================================================
       MEMBER ROLE MANAGEMENT
    ====================================================== */

    function openMemberRoleEditor(
        userId
    ) {

        if (!canManageMembers()) {
            return;
        }


        const member =
            state.members.find(
                item =>
                    String(item.user_id) ===
                    String(userId)
            );


        if (!member) {
            return;
        }


        if (
            state.user &&
            member.user_id ===
                state.user.id
        ) {

            showToast(
                "Your own role should be changed by another administrator.",
                "error"
            );

            return;
        }


        setText(
            "roleMemberName",
            member.name
        );


        const id =
            $("roleMemberId");


        const role =
            $("memberRoleInput");


        if (id) {
            id.value =
                member.user_id;
        }


        if (role) {
            role.value =
                normalizeRole(
                    member.role
                );
        }


        updateRolePermissionSummary();


        clearFormError(
            "roleFormError"
        );


        openModal(
            "memberRoleModal"
        );

    }


    function updateRolePermissionSummary() {

        const role =
            normalizeRole(
                $("memberRoleInput")?.value
            );


        const summary =
            $("rolePermissionSummary");


        if (!summary) {
            return;
        }


        const permissions = {

            student:
                "Can view permitted channels and send messages.",

            tutor:
                "Can participate in discussions and support students.",

            moderator:
                "Can moderate messages and manage channels.",

            admin:
                "Can manage communities, channels and members.",

            super_admin:
                "Full community administration and member management."

        };


        summary.textContent =
            permissions[role] ||
            permissions.student;

    }


    async function saveMemberRole() {

        if (!canManageMembers()) {
            return;
        }


        const userId =
            $("roleMemberId")?.value;


        const role =
            normalizeRole(
                $("memberRoleInput")?.value
            );


        if (!userId) {
            return;
        }


        /*
         * Prevent an admin from promoting another user
         * beyond their own role.
         */

        if (
            roleRank(role) >
            roleRank(state.communityRole)
        ) {

            showFormError(
                "roleFormError",
                "You cannot assign a role higher than your own."
            );

            return;
        }


        try {

            const result =
                await db()
                    .from(
                        "chat_community_members"
                    )
                    .update({
                        role:
                            role
                    })
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )
                    .eq(
                        "user_id",
                        userId
                    );


            if (result.error) {
                throw result.error;
            }


            const member =
                state.members.find(
                    item =>
                        String(
                            item.user_id
                        ) ===
                        String(userId)
                );


            if (member) {
                member.role =
                    role;
            }


            closeModal(
                "memberRoleModal"
            );


            renderMembers();


            showToast(
                "Member role updated."
            );

        } catch (error) {

            console.error(
                "Role update error:",
                error
            );


            showFormError(
                "roleFormError",
                error.message ||
                "Member role could not be updated."
            );

        }

    }


    /* =====================================================
       PERMISSION UI
    ====================================================== */

    function renderPermissionUI() {

        const canCreate =
            canCreateCommunity();


        const canChannel =
            canCreateChannel();


        const canManage =
            canManageCommunity();


        setHidden(
            $("createCommunityButton"),
            !canCreate
        );


        setHidden(
            $("sidebarCreateChannelButton"),
            !canChannel
        );


        setHidden(
            $("sidebarSettingsButton"),
            !canManage
        );


        const canSend =
            canSendMessages();


        const composer =
            $("messageComposer");


        const permissionMessage =
            $("composerPermissionMessage");


        if (composer) {
            composer.hidden =
                !canSend;
        }


        if (permissionMessage) {
            permissionMessage.hidden =
                canSend;
        }


        const memberToggle =
            $("memberListToggle");


        if (memberToggle) {
            memberToggle.hidden =
                false;
        }


        setText(
            "sidebarUserRole",
            roleLabel(
                state.communityRole
            )
        );


        if (
            state.currentChannel
        ) {

            renderComposerPermission();

        }

    }


    function renderComposerPermission() {

        const canSend =
            canSendMessages();


        const composer =
            $("messageComposer");


        const permission =
            $("composerPermissionMessage");


        if (composer) {
            composer.hidden =
                !canSend;
        }


        if (permission) {

            permission.hidden =
                canSend;


            if (
                state.currentChannel?.channel_type ===
                "private"
            ) {

                permission.textContent =
                    "This is a private channel. You need channel membership or an elevated role to send messages.";

            } else {

                permission.textContent =
                    "You do not have permission to send messages in this channel.";

            }

        }

    }


    /* =====================================================
       SEARCH
    ====================================================== */

    async function searchMessages() {

        const input =
            $("messageSearchInput");


        const resultsArea =
            $("messageSearchResults");


        const query =
            String(
                input?.value || ""
            )
                .trim();


        if (
            !query ||
            !state.currentChannel
        ) {

            if (resultsArea) {
                resultsArea.innerHTML = "";
            }

            return;
        }


        if (resultsArea) {

            resultsArea.innerHTML = `
                <div class="messages-loading">
                    Searching...
                </div>
            `;

        }


        try {

            /*
             * Use ilike against content. This relies only
             * on the established chat_messages.content
             * field.
             */

            const result =
                await db()
                    .from(
                        "chat_messages"
                    )
                    .select("*")
                    .eq(
                        "channel_id",
                        state.currentChannel.id
                    )
                    .ilike(
                        "content",
                        `%${query}%`
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(50);


            if (result.error) {
                throw result.error;
            }


            const results =
                result.data || [];


            if (!results.length) {

                resultsArea.innerHTML = `
                    <div class="empty-state-small">
                        No matching messages.
                    </div>
                `;

                return;
            }


            await Promise.all(
                results.map(
                    message =>
                        getProfile(
                            message.sender_id
                        )
                )
            );


            resultsArea.innerHTML =
                results
                    .map(
                        raw => {

                            const message =
                                normalizeMessage(
                                    raw
                                );


                            const sender =
                                getSenderDisplay(
                                    message
                                );


                            return `
                                <article
                                    class="search-result"
                                    data-search-message="${escapeAttribute(message.id)}"
                                >

                                    <div>
                                        <span class="search-result-author">
                                            ${escapeHtml(sender.name)}
                                        </span>

                                        <span class="search-result-date">
                                            ${escapeHtml(
                                                formatMessageDate(
                                                    message.created_at
                                                )
                                            )}
                                        </span>
                                    </div>

                                    <div class="search-result-content">
                                        ${escapeHtml(
                                            message.content
                                        )}
                                    </div>

                                </article>
                            `;

                        }
                    )
                    .join("");


            resultsArea
                .querySelectorAll(
                    "[data-search-message]"
                )
                .forEach(
                    element => {

                        element.addEventListener(
                            "click",
                            () => {

                                const messageId =
                                    element.dataset.searchMessage;


                                const target =
                                    document.querySelector(
                                        `[data-message-id="${CSS.escape(String(messageId))}"]`
                                    );


                                if (target) {

                                    target.scrollIntoView({
                                        behavior:
                                            "smooth",
                                        block:
                                            "center"
                                    });


                                    target.style.background =
                                        "var(--primary-soft)";


                                    setTimeout(
                                        () => {

                                            target.style.background =
                                                "";

                                        },
                                        1300
                                    );

                                }

                            }
                        );

                    }
                );

        } catch (error) {

            console.error(
                "Message search failed:",
                error
            );


            resultsArea.innerHTML = `
                <div class="empty-state-small">
                    Message search is currently unavailable.
                </div>
            `;

        }

    }


    /* =====================================================
       EMOJI
    ====================================================== */

    function openEmojiPicker(
        event,
        messageId = null
    ) {

        const picker =
            $("emojiPicker");


        if (!picker) {
            return;
        }


        state.emojiMessageId =
            messageId;


        picker.hidden =
            false;


        const rect =
            event.currentTarget
                .getBoundingClientRect();


        picker.style.left =
            `${Math.max(
                8,
                rect.left - 90
            )}px`;


        picker.style.top =
            `${Math.max(
                8,
                rect.top - 145
            )}px`;

    }


    function closeEmojiPicker() {

        const picker =
            $("emojiPicker");


        if (picker) {
            picker.hidden =
                true;
        }

    }


    /* =====================================================
       MOBILE SIDEBARS
    ====================================================== */

    function openMobileSidebar() {

        const sidebar =
            $("communitySidebar");


        const overlay =
            $("mobileOverlay");


        sidebar?.classList.add(
            "open"
        );


        overlay?.classList.add(
            "visible"
        );

    }


    function closeMobileSidebar() {

        const sidebar =
            $("communitySidebar");


        const overlay =
            $("mobileOverlay");


        sidebar?.classList.remove(
            "open"
        );


        overlay?.classList.remove(
            "visible"
        );

    }


    function openMemberSidebar() {

        $("memberSidebar")
            ?.classList.add(
                "open"
            );

    }


    function closeMemberSidebar() {

        $("memberSidebar")
            ?.classList.remove(
                "open"
            );

    }


    /* =====================================================
       COMMUNITY SWITCHER
    ====================================================== */

    function toggleCommunitySwitcher() {

        const menu =
            $("communitySwitcherMenu");


        const button =
            $("communitySwitcherButton");


        if (!menu) {
            return;
        }


        const open =
            menu.hidden;


        menu.hidden =
            !open;


        if (button) {
            button.setAttribute(
                "aria-expanded",
                String(open)
            );
        }

    }


    function closeCommunitySwitcher() {

        const menu =
            $("communitySwitcherMenu");


        const button =
            $("communitySwitcherButton");


        if (menu) {
            menu.hidden =
                true;
        }


        if (button) {
            button.setAttribute(
                "aria-expanded",
                "false"
            );
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
       FORMS
    ====================================================== */

    function showFormError(
        id,
        message
    ) {

        const element =
            $(id);


        if (!element) {
            return;
        }


        element.textContent =
            message || "An error occurred.";


        element.hidden =
            false;

    }


    function clearFormError(id) {

        const element =
            $(id);


        if (!element) {
            return;
        }


        element.textContent =
            "";

        element.hidden =
            true;

    }


    /* =====================================================
       EVENT LISTENERS
    ====================================================== */

    function bindEvents() {

        /*
         * Community switcher
         */

        $("communitySwitcherButton")
            ?.addEventListener(
                "click",
                toggleCommunitySwitcher
            );


        $("createCommunityButton")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        canCreateCommunity()
                    ) {

                        closeCommunitySwitcher();

                        openModal(
                            "communityModal"
                        );

                    } else {

                        showToast(
                            "Only authorized administrators can create communities.",
                            "error"
                        );

                    }

                }
            );


        /*
         * Channel creation
         */

        $("sidebarCreateChannelButton")
            ?.addEventListener(
                "click",
                () => {
                    openCreateChannelModal();
                }
            );


        $("channelForm")
            ?.addEventListener(
                "submit",
                createChannel
            );


        /*
         * Community creation
         */

        $("communityForm")
            ?.addEventListener(
                "submit",
                createCommunity
            );


        /*
         * Settings
         */

        $("sidebarSettingsButton")
            ?.addEventListener(
                "click",
                openCommunitySettings
            );


        $("saveCommunitySettingsButton")
            ?.addEventListener(
                "click",
                saveCommunitySettings
            );


        $("saveChannelSettingsButton")
            ?.addEventListener(
                "click",
                saveChannelSettings
            );


        /*
         * Role management
         */

        $("saveMemberRoleButton")
            ?.addEventListener(
                "click",
                saveMemberRole
            );


        $("memberRoleInput")
            ?.addEventListener(
                "change",
                updateRolePermissionSummary
            );


        /*
         * Messaging
         */

        $("sendMessageButton")
            ?.addEventListener(
                "click",
                sendMessage
            );


        $("messageInput")
            ?.addEventListener(
                "input",
                event => {

                    autoResizeTextarea(
                        event.target
                    );

                }
            );


        $("messageInput")
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

                    }

                }
            );


        $("cancelReplyButton")
            ?.addEventListener(
                "click",
                cancelReply
            );


        /*
         * Attachments
         */

        $("attachmentButton")
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

                    const files =
                        [...(
                            event.target.files ||
                            []
                        )];


                    if (files.length) {

                        showToast(
                            `${files.length} file${files.length === 1 ? "" : "s"} selected. Attachment upload will be enabled in the attachments phase.`
                        );

                    }

                }
            );


        /*
         * Emoji
         */

        $("emojiButton")
            ?.addEventListener(
                "click",
                event => {

                    openEmojiPicker(
                        event,
                        null
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-emoji]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const emoji =
                                button.dataset.emoji;


                            if (
                                state.emojiMessageId
                            ) {

                                await toggleReaction(
                                    state.emojiMessageId,
                                    emoji
                                );

                            } else {

                                const input =
                                    $("messageInput");


                                if (input) {

                                    input.value +=
                                        emoji;

                                    input.focus();

                                    autoResizeTextarea(
                                        input
                                    );

                                }

                            }


                            closeEmojiPicker();

                        }
                    );

                }
            );


        /*
         * Channel search
         */

        $("channelSearchInput")
            ?.addEventListener(
                "input",
                event => {

                    const clear =
                        $("clearChannelSearch");


                    if (clear) {

                        clear.hidden =
                            !event.target.value;

                    }


                    renderChannels();

                }
            );


        $("clearChannelSearch")
            ?.addEventListener(
                "click",
                () => {

                    const input =
                        $("channelSearchInput");


                    if (input) {

                        input.value =
                            "";

                        input.focus();

                    }


                    $("clearChannelSearch").hidden =
                        true;


                    renderChannels();

                }
            );


        /*
         * Message search
         */

        $("messageSearchButton")
            ?.addEventListener(
                "click",
                () => {

                    const panel =
                        $("messageSearchPanel");


                    if (panel) {
                        panel.hidden =
                            !panel.hidden;
                    }


                    if (
                        !panel?.hidden
                    ) {
                        $("messageSearchInput")
                            ?.focus();
                    }

                }
            );


        $("closeMessageSearchButton")
            ?.addEventListener(
                "click",
                () => {

                    hideElement(
                        "messageSearchPanel"
                    );

                }
            );


        $("performMessageSearchButton")
            ?.addEventListener(
                "click",
                searchMessages
            );


        $("messageSearchInput")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        searchMessages();

                    }

                }
            );


        /*
         * Member search
         */

        $("memberSearchInput")
            ?.addEventListener(
                "input",
                renderMembers
            );


        /*
         * Member panel
         */

        $("memberListToggle")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <=
                        850
                    ) {

                        const sidebar =
                            $("memberSidebar");


                        if (
                            sidebar?.classList.contains(
                                "open"
                            )
                        ) {

                            closeMemberSidebar();

                        } else {

                            openMemberSidebar();

                        }

                    }

                }
            );


        $("closeMemberSidebar")
            ?.addEventListener(
                "click",
                closeMemberSidebar
            );


        /*
         * Mobile community sidebar
         */

        $("openSidebarButton")
            ?.addEventListener(
                "click",
                openMobileSidebar
            );


        $("closeSidebarButton")
            ?.addEventListener(
                "click",
                closeMobileSidebar
            );


        $("mobileOverlay")
            ?.addEventListener(
                "click",
                () => {

                    closeMobileSidebar();
                    closeMemberSidebar();

                }
            );


        /*
         * Notifications
         */

        $("communityNotificationButton")
            ?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const panel =
                        $("communityNotificationPanel");


                    if (panel) {

                        panel.hidden =
                            !panel.hidden;

                    }

                }
            );


        $("markAllNotificationsReadButton")
            ?.addEventListener(
                "click",
                markAllNotificationsRead
            );


        /*
         * Close modals.
         */

        document
            .querySelectorAll(
                "[data-close-modal]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            closeModal(
                                button.dataset.closeModal
                            );

                        }
                    );

                }
            );


        /*
         * Clicking modal backdrop closes it.
         */

        document
            .querySelectorAll(
                ".modal-backdrop"
            )
            .forEach(
                backdrop => {

                    backdrop.addEventListener(
                        "click",
                        event => {

                            if (
                                event.target ===
                                backdrop
                            ) {

                                backdrop.hidden =
                                    true;

                            }

                        }
                    );

                }
            );


        /*
         * Global outside-click handling.
         */

        document.addEventListener(
            "click",
            event => {

                const switcher =
                    $("communitySwitcherMenu");


                const switcherButton =
                    $("communitySwitcherButton");


                if (
                    switcher &&
                    !switcher.hidden &&
                    !switcher.contains(
                        event.target
                    ) &&
                    !switcherButton?.contains(
                        event.target
                    )
                ) {

                    closeCommunitySwitcher();

                }


                const notificationPanel =
                    $("communityNotificationPanel");


                const notificationButton =
                    $("communityNotificationButton");


                if (
                    notificationPanel &&
                    !notificationPanel.hidden &&
                    !notificationPanel.contains(
                        event.target
                    ) &&
                    !notificationButton?.contains(
                        event.target
                    )
                ) {

                    notificationPanel.hidden =
                        true;

                }


                const picker =
                    $("emojiPicker");


                if (
                    picker &&
                    !picker.hidden &&
                    !picker.contains(
                        event.target
                    ) &&
                    !event.target.closest(
                        ".message-action"
                    ) &&
                    !event.target.closest(
                        "#emojiButton"
                    )
                ) {

                    closeEmojiPicker();

                }

            }
        );


        /*
         * Window resize.
         */

        window.addEventListener(
            "resize",
            () => {

                if (
                    window.innerWidth >
                    650
                ) {
                    closeMobileSidebar();
                }


                if (
                    window.innerWidth >
                    850
                ) {
                    closeMemberSidebar();
                }

            }
        );


        /*
         * Browser/tab visibility.
         */

        document.addEventListener(
            "visibilitychange",
            () => {

                updatePresence(
                    document.hidden
                        ? "offline"
                        : "online"
                );

            }
        );


        window.addEventListener(
            "beforeunload",
            () => {

                updatePresence(
                    "offline"
                );

            }
        );

    }


    /* =====================================================
       EMPTY CHANNEL STATE
    ====================================================== */

    function renderEmptyChannelState(
        title,
        description
    ) {

        const list =
            $("messagesList");


        if (!list) {
            return;
        }


        list.innerHTML = `
            <div class="empty-message-state">

                <strong>
                    ${escapeHtml(title)}
                </strong>

                <span>
                    ${escapeHtml(description)}
                </span>

            </div>
        `;

    }


    /* =====================================================
       RESTORE COMMUNITY
    ====================================================== */

    function getInitialCommunity() {

        if (!state.communities.length) {
            return null;
        }


        const saved =
            localStorage.getItem(
                "mwanikiCommunityId"
            );


        if (saved) {

            const found =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(saved)
                );


            if (found) {
                return found;
            }

        }


        return state.communities[0];

    }


    /* =====================================================
       INITIALIZE
    ====================================================== */

    async function initializeCommunity() {

        if (state.initialized) {
            return;
        }


        state.initialized =
            true;


        console.log(
            "🚀 Mwaniki Community Phase 3 initializing..."
        );


        const authenticated =
            await requireAuthentication();


        if (!authenticated) {
            return;
        }


        try {

            await loadCourses();

            await loadCommunities();

            await loadPresence();


            if (
                state.communities.length
            ) {

                const initial =
                    getInitialCommunity();


                await switchCommunity(
                    initial.id
                );

            } else {

                /*
                 * There are no communities.
                 * Render permission-aware UI.
                 */

                state.currentCommunity =
                    null;


                state.communityRole =
                    "student";


                await loadStudentProfile();


                renderChannels();


                renderEmptyChannelState(
                    "Welcome to Mwaniki Community",
                    canCreateCommunity()
                        ? "Create your first community to get started."
                        : "A community will appear here when an administrator creates one."
                );

            }


            renderPermissionUI();

            await updatePresence(
                "online"
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
                error.message ||
                "Community could not be initialized.",
                "error"
            );

        }

    }


    /* =====================================================
       AUTH STATE
    ====================================================== */

    async function bindAuthState() {

        const client =
            db();


        if (
            !client ||
            !client.auth
        ) {
            return;
        }


        client.auth.onAuthStateChange(
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

                    await clearRealtimeSubscriptions();

                    state.user =
                        null;

                    state.initialized =
                        false;

                    return;

                }


                if (
                    session?.user &&
                    (
                        event ===
                            "SIGNED_IN" ||
                        event ===
                            "INITIAL_SESSION"
                    )
                ) {

                    state.user =
                        session.user;


                    if (
                        !state.initialized
                    ) {

                        await initializeCommunity();

                    }

                }

            }
        );

    }


    /* =====================================================
       BOOT
    ====================================================== */

    async function boot() {

        try {

            bindEvents();

            await bindAuthState();


            /*
             * INITIAL_SESSION is normally delivered
             * through onAuthStateChange. We also initialize
             * directly to avoid waiting indefinitely on
             * older Supabase clients.
             */

            if (!state.user) {

                try {

                    state.user =
                        await getCurrentUser();

                } catch (error) {

                    console.warn(
                        "Initial user lookup:",
                        error
                    );

                }

            }


            if (state.user) {

                await initializeCommunity();

            }


        } catch (error) {

            console.error(
                "❌ Community boot error:",
                error
            );

        }

    }


    /*
     * Make selected functions available for debugging
     * without polluting the global application architecture.
     */

    window.MwanikiCommunity = {

        state,

        switchCommunity,

        switchChannel,

        sendMessage,

        loadCommunities,

        loadChannels,

        loadMembers,

        openCreateChannelModal,

        openCommunitySettings

    };


    /*
     * Start after DOM is ready.
     */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot
        );

    } else {

        boot();

    }

})();
