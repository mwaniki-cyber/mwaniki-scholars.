/* =========================================================
   MWANIKI SCHOLARS
   MWANIKI COMMUNITY — DATABASE ALIGNED ENGINE

   IMPORTANT ARCHITECTURE

   - Uses the existing Supabase ES module.
   - Does NOT create another Supabase client.
   - Is isolated from dashboard.js.
   - Is isolated from Mwaniki AI.
   - Is isolated from Turbo AI.
   - Uses course_id for course identity.
   - Supports duplicate course titles safely.
   - Uses the actual Phase 3 database tables.
========================================================= */

import { supabase } from "./supabase.js";


(() => {

    "use strict";


    console.log(
        "🚀 Mwaniki Community Phase 3 database-aligned engine loaded"
    );


    /* =====================================================
       SUPABASE
    ====================================================== */

    const supabaseClient = supabase;


    if (!supabaseClient) {

        console.error(
            "❌ Supabase client was not created by supabase.js."
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

        currentCommunity: null,

        currentChannel: null,

        currentRole: "student",

        currentReplyMessage: null,

        communityRealtime: null,

        messageRealtime: null,

        presenceTimer: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        collapsedCategories: new Set()

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


    const getElement = id =>
        document.getElementById(id);


    /* =====================================================
       TOAST
    ====================================================== */

    let toastTimer = null;


    function showToast(
        message,
        type = "normal"
    ) {

        const toast =
            getElement(
                "communityToast"
            );

        if (!toast) return;


        toast.textContent =
            String(message || "");


        toast.dataset.type =
            type;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                3500
            );
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
                name ||
                "Student"
            )
                .trim();


        if (!text) {
            return "S";
        }


        const parts =
            text
                .split(/\s+/)
                .filter(Boolean);


        if (
            parts.length === 1
        ) {

            return parts[0]
                .substring(
                    0,
                    2
                )
                .toUpperCase();
        }


        return (
            parts[0][0] +
            parts[
                parts.length - 1
            ][0]
        ).toUpperCase();
    }


    function getDisplayName(record) {

        if (!record) {

            return "Student";
        }


        return (
            record.nickname ||
            record.full_name ||
            record.name ||
            record.display_name ||
            record.username ||
            record.email ||
            record.user_email ||
            record._profile?.full_name ||
            record._profile?.name ||
            record._profile?.email ||
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
            record.id ||
            record.uid ||
            null
        );
    }


    function normalizeRole(role) {

        const value =
            String(
                role ||
                "student"
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[\s_-]+/g,
                    ""
                );


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


        const menuChannel =
            getElement(
                "communityMenuCreateChannel"
            );


        const menuCommunity =
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


        if (menuChannel) {

            menuChannel.style.display =
                can("createChannel")
                    ? "block"
                    : "none";
        }


        if (menuCommunity) {

            menuCommunity.style.display =
                can("createCommunity")
                    ? "block"
                    : "none";
        }


        const badge =
            getElement(
                "activeRoleBadge"
            );


        if (badge) {

            badge.textContent =
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
       AUTH
    ====================================================== */

    async function getAuthenticatedUser() {

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getUser();


        if (error) {

            console.error(
                "❌ Unable to retrieve authenticated user:",
                error
            );

            return null;
        }


        return (
            data?.user ||
            null
        );
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


            if (
                !error &&
                data
            ) {

                state.profile =
                    data;
            }

        } catch (error) {

            console.warn(
                "⚠️ Student profile lookup unavailable:",
                error
            );
        }
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
                        "id,title"
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


            state.courses =
                [];


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
                `
                <option value="">
                    General Community
                </option>
                ` +
                state.courses
                    .map(
                        course => `
                            <option
                                value="${escapeHTML(course.id)}"
                            >
                                ${escapeHTML(course.title)}
                            </option>
                        `
                    )
                    .join("");
        }


        if (channelSelect) {

            channelSelect.innerHTML =
                `
                <option value="">
                    No specific course
                </option>
                ` +
                state.courses
                    .map(
                        course => `
                            <option
                                value="${escapeHTML(course.id)}"
                            >
                                ${escapeHTML(course.title)}
                            </option>
                        `
                    )
                    .join("");
        }
    }


    function getCourseName(courseId) {

        const course =
            state.courses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );


        return (
            course?.title ||
            null
        );
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
                    .from("chat_communities")
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


            state.communities =
                [];


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


        if (
            !state.communities.length
        ) {

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

                                <div
                                    class="community-rail-icon ${
                                        String(icon).length > 2
                                            ? "text-icon"
                                            : ""
                                    }"
                                >
                                    ${escapeHTML(icon)}
                                </div>

                            </button>
                        `;
                    }
                )
                .join("");


        $$(".community-rail-item[data-community-id]")
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
                        "role,nickname,is_muted,is_banned"
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


            if (
                !error &&
                data
            ) {

                state.currentRole =
                    normalizeRole(
                        data.role
                    );


                if (
                    data.is_banned
                ) {

                    state.currentRole =
                        "student";


                    showToast(
                        "Your access to this community has been restricted.",
                        "error"
                    );
                }
            }

        } catch (error) {

            console.warn(
                "⚠️ Could not determine community role:",
                error
            );
        }


        applyPermissionUI();
    }


    /* =====================================================
       ENSURE COMMUNITY MEMBERSHIP
    ====================================================== */

    async function ensureCommunityMembership() {

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
                        state.currentCommunity.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .maybeSingle();


            if (error) {
                return;
            }


            if (!data) {

                const {
                    error:
                    insertError
                } =
                    await supabaseClient
                        .from(
                            "chat_community_members"
                        )
                        .insert({
                            community_id:
                                state.currentCommunity.id,

                            user_id:
                                state.user.id,

                            role:
                                "student"
                        });


                if (
                    insertError
                ) {

                    console.warn(
                        "⚠️ Could not automatically join community:",
                        insertError
                    );
                }
            }

        } catch (error) {

            console.warn(
                "⚠️ Community membership check failed:",
                error
            );
        }
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


        state.messages =
            [];


        state.currentReplyMessage =
            null;


        localStorage.setItem(
            "mwanikiCommunityId",
            String(
                community.id
            )
        );


        renderCommunityRail();

        renderActiveCommunity();


        await ensureCommunityMembership();

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
                community.icon_url ||
                initials(
                    community.name
                );
        }


        /*
         * chat_communities currently does not contain
         * course_id in the confirmed schema.
         *
         * Course context therefore comes from the URL/
         * selected course channel instead.
         */

        if (courseName) {

            courseName.textContent =
                "General Community";
        }


        if (courseLabel) {

            courseLabel.textContent =
                "Community";
        }
    }


    /* =====================================================
       CHANNELS
    ====================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) {
            return;
        }


        const container =
            getElement(
                "channelList"
            );


        if (container) {

            container.innerHTML = `
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
                    .select(
                        "*"
                    )
                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )
                    .eq(
                        "is_active",
                        true
                    )
                    .order(
                        "position",
                        {
                            ascending: true
                        }
                    );


            if (error) {
                throw error;
            }


            let channels =
                Array.isArray(data)
                    ? data
                    : [];


            /*
             * Private channels are visible only to:
             *
             * - members
             * - moderators
             * - admins
             * - super admins
             */

            const privateChannels =
                channels.filter(
                    channel =>
                        channel.is_private === true
                );


            if (
                privateChannels.length
            ) {

                channels =
                    await filterPrivateChannels(
                        channels
                    );
            }


            state.channels =
                channels;


            renderChannels();


            const urlParams =
                new URLSearchParams(
                    window.location.search
                );


            const requestedCourseId =
                urlParams.get(
                    "course_id"
                );


            let selected =
                null;


            /*
             * Course-specific channel gets priority.
             */

            if (
                requestedCourseId
            ) {

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


                if (selected) {

                    const courseName =
                        getCourseName(
                            requestedCourseId
                        );


                    const bannerName =
                        getElement(
                            "communityCourseName"
                        );


                    const bannerLabel =
                        getElement(
                            "communityCourseLabel"
                        );


                    if (bannerName) {

                        bannerName.textContent =
                            courseName ||
                            selected.name;
                    }


                    if (bannerLabel) {

                        bannerLabel.textContent =
                            "Course Community";
                    }
                }
            }


            /*
             * General fallback.
             */

            if (!selected) {

                selected =
                    state.channels.find(
                        channel =>
                            String(
                                channel.name
                            ).toLowerCase() ===
                            "general"
                    );
            }


            if (!selected) {

                selected =
                    state.channels[0];
            }


            if (selected) {

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


            state.channels =
                [];


            if (container) {

                container.innerHTML = `
                    <div class="channel-empty">
                        Unable to load channels.
                    </div>
                `;
            }
        }
    }


    async function filterPrivateChannels(
        channels
    ) {

        if (!state.user) {

            return channels.filter(
                channel =>
                    channel.is_private !== true
            );
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


            const allowed =
                new Set(
                    (data || [])
                        .map(
                            row =>
                                String(
                                    row.channel_id
                                )
                        )
                );


            return channels.filter(
                channel => {

                    if (
                        channel.is_private !== true
                    ) {

                        return true;
                    }


                    if (
                        can("manageMembers") ||
                        can("manageCommunity")
                    ) {

                        return true;
                    }


                    return allowed.has(
                        String(
                            channel.id
                        )
                    );
                }
            );

        } catch (error) {

            console.warn(
                "⚠️ Private channel filtering failed:",
                error
            );


            return channels.filter(
                channel =>
                    channel.is_private !== true
            );
        }
    }


    /* =====================================================
       CHANNEL RENDERING
    ====================================================== */

    function getChannelCategory(
        channel
    ) {

        /*
         * The confirmed schema has no category column.
         *
         * Categories are therefore derived from the
         * actual channel type/course relationship.
         */

        if (
            channel.course_id !== null &&
            channel.course_id !== undefined
        ) {

            return "Course Communities";
        }


        switch (
            channel.channel_type
        ) {

            case "announcement":
                return "Information";

            case "study":
                return "Study Hub";

            case "voice":
                return "Voice";

            default:
                return "Community";
        }
    }


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


                    const courseName =
                        getCourseName(
                            channel.course_id
                        ) ||
                        "";


                    return (
                        String(
                            channel.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(search) ||

                        String(
                            channel.description ||
                            ""
                        )
                            .toLowerCase()
                            .includes(search) ||

                        courseName
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
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            toggleCategory(
                                button.dataset.category
                            );
                        }
                    );
                }
            );


        $$(".channel-row")
            .forEach(
                row => {

                    row.addEventListener(
                        "click",
                        async () => {

                            await selectChannel(
                                row.dataset.channelId
                            );
                        }
                    );
                }
            );
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
                            ${collapsed ? "▸" : "▾"}
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

                    ${
                        collapsed
                            ? ""
                            : channels
                                .map(
                                    renderChannelRow
                                )
                                .join("")
                    }

                </div>

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


        const privateChannel =
            channel.is_private === true;


        const courseName =
            getCourseName(
                channel.course_id
            );


        const icon =
            privateChannel
                ? "🔒"
                : channel.icon ||
                  "#";


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
                    ${escapeHTML(icon)}
                </span>


                <span class="channel-row-content">

                    <span class="channel-row-name">
                        ${escapeHTML(
                            channel.name ||
                            "channel"
                        )}
                    </span>


                    <span class="channel-row-meta">

                        <span>
                            ${
                                privateChannel
                                    ? "Private"
                                    : "Public"
                            }
                        </span>


                        ${
                            courseName
                                ? `
                                    <span class="course-mini-badge">
                                        ${escapeHTML(
                                            courseName
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


        state.messages =
            [];


        clearReply();


        renderChannels();

        renderActiveChannel();

        applyPermissionUI();


        await loadMessages();

        await markChannelRead();

        setupChannelRealtime();


        closeCommunityMenu();
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


        if (name) {

            name.textContent =
                channel.name ||
                "channel";
        }


        if (description) {

            description.textContent =
                channel.description ||
                "Community discussion channel.";
        }


        applyPermissionUI();
    }


    /* =====================================================
       MESSAGES
    ====================================================== */

    async function loadMessages() {

        const container =
            getElement(
                "messageList"
            );


        if (!container) {
            return;
        }


        if (!state.currentChannel) {
            return;
        }


        container.innerHTML = `
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
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    )
                    .limit(
                        300
                    );


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


            state.messages =
                [];


            container.innerHTML = `
                <div class="channel-empty">
                    Unable to load messages.
                </div>
            `;
        }
    }


    function renderMessages() {

        const container =
            getElement(
                "messageList"
            );


        if (!container) {
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
                            message.content ||
                            ""
                        )
                            .toLowerCase()
                            .includes(search)
                );
        }


        if (!messages.length) {

            container.innerHTML = `
                <div class="welcome-message">

                    <div class="welcome-icon">
                        #
                    </div>

                    <h2>
                        ${
                            search
                                ? "No matching messages"
                                : `Welcome to #${
                                    escapeHTML(
                                        state.currentChannel?.name ||
                                        "channel"
                                    )
                                }`
                        }
                    </h2>

                    <p>
                        ${
                            search
                                ? "Try another search."
                                : "This is the beginning of this discussion. Start the conversation."
                        }
                    </p>

                </div>
            `;

            return;
        }


        container.innerHTML =
            messages
                .map(
                    renderMessage
                )
                .join("");


        bindMessageActions();


        requestAnimationFrame(
            () => {

                container.scrollTop =
                    container.scrollHeight;
            }
        );
    }


    function renderMessage(
        message
    ) {

        const sender =
            resolveMember(
                message.user_id
            );


        const senderName =
            message.user_id
                ? getDisplayName(
                    sender
                )
                : "Mwaniki Scholars";


        const avatarUrl =
            sender?.photo_url ||
            sender?._profile?.photo_url ||
            null;


        const avatar =
            avatarUrl
                ? `
                    <img
                        src="${escapeHTML(
                            avatarUrl
                        )}"
                        alt=""
                    >
                `
                : initials(
                    senderName
                );


        const isOwn =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );


        const canDelete =
            isOwn ||
            can("moderate");


        const canPin =
            can("moderate");


        const deleted =
            message.is_deleted === true;


        const content =
            deleted
                ? "This message was deleted."
                : escapeHTML(
                    message.content ||
                    ""
                );


        const replyMessage =
            message.parent_message_id
                ? state.messages.find(
                    item =>
                        String(item.id) ===
                        String(
                            message.parent_message_id
                        )
                )
                : null;


        return `
            <article
                class="message ${
                    isOwn
                        ? "own-message"
                        : ""
                } ${
                    deleted
                        ? "deleted-message"
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
                                formatDateTime(
                                    message.created_at
                                )
                            )}
                        </span>


                        ${
                            message.is_pinned
                                ? `
                                    <span
                                        title="Pinned message"
                                    >
                                        📌
                                    </span>
                                `
                                : ""
                        }

                    </div>


                    ${
                        replyMessage
                            ? `
                                <div
                                    class="message-reply-reference"
                                >
                                    Replying to:
                                    ${escapeHTML(
                                        replyMessage.content ||
                                        ""
                                    )}
                                </div>
                            `
                            : ""
                    }


                    <div class="message-content">
                        ${content}
                    </div>


                    ${
                        deleted
                            ? ""
                            : `
                                <div class="message-actions">

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
                                        canPin
                                            ? `
                                                <button
                                                    type="button"
                                                    class="message-action"
                                                    data-action="pin"
                                                    data-message-id="${escapeHTML(
                                                        message.id
                                                    )}"
                                                >
                                                    ${
                                                        message.is_pinned
                                                            ? "Unpin"
                                                            : "Pin"
                                                    }
                                                </button>
                                            `
                                            : ""
                                    }


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
                            `
                            : ""
                    }

                </div>

            </article>
        `;
    }


    function bindMessageActions() {

        $$(".message-action")
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async event => {

                            event.stopPropagation();


                            const action =
                                button.dataset.action;


                            const id =
                                button.dataset.messageId;


                            if (
                                action ===
                                "reply"
                            ) {

                                setReplyMessage(
                                    id
                                );

                            }


                            if (
                                action ===
                                "delete"
                            ) {

                                await deleteMessage(
                                    id
                                );

                            }


                            if (
                                action ===
                                "pin"
                            ) {

                                await togglePin(
                                    id
                                );
                            }
                        }
                    );
                }
            );
    }


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
                        getUserId(
                            member
                        )
                    ) ===
                    String(
                        userId
                    )
            ) ||
            null
        );
    }


    function formatDateTime(
        value
    ) {

        if (!value) {
            return "";
        }


        const date =
            new Date(
                value
            );


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
            content.length > 5000
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

            sendButton.disabled =
                true;
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

                parent_message_id:
                    state.currentReplyMessage?.id ||
                    null
            };


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

                addMessageIfMissing(
                    data
                );


                renderMessages();
            }


            await markChannelRead();


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


    function addMessageIfMissing(
        message
    ) {

        if (!message?.id) {
            return;
        }


        const exists =
            state.messages.some(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        message.id
                    )
            );


        if (!exists) {

            state.messages.push(
                message
            );
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
             * Soft-delete is used because the database
             * already contains is_deleted/deleted_at.
             */

            const {
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
                                .toISOString(),

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        messageId
                    );


            if (error) {
                throw error;
            }


            const localMessage =
                state.messages.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            messageId
                        )
                );


            if (localMessage) {

                localMessage.is_deleted =
                    true;

                localMessage.deleted_at =
                    new Date()
                        .toISOString();
            }


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
       PIN MESSAGE
    ====================================================== */

    async function togglePin(
        messageId
    ) {

        if (!can("moderate")) {

            showToast(
                "You do not have permission to pin messages.",
                "error"
            );

            return;
        }


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


        try {

            const newValue =
                !Boolean(
                    message.is_pinned
                );


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "chat_messages"
                    )
                    .update({
                        is_pinned:
                            newValue,

                        updated_at:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "id",
                        messageId
                    );


            if (error) {
                throw error;
            }


            message.is_pinned =
                newValue;


            renderMessages();


            showToast(
                newValue
                    ? "Message pinned."
                    : "Message unpinned."
            );

        } catch (error) {

            console.error(
                "❌ Pin update failed:",
                error
            );


            showToast(
                "Unable to update pinned status.",
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


        getElement(
            "replyPreview"
        )?.classList.add(
            "hidden"
        );


        const text =
            getElement(
                "replyPreviewText"
            );


        if (text) {

            text.textContent =
                "";
        }
    }


    /* =====================================================
       MEMBERS
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
                    );


            if (error) {
                throw error;
            }


            state.members =
                Array.isArray(data)
                    ? data
                    : [];


            await enrichMembers();


            renderMembers();

        } catch (error) {

            console.error(
                "❌ Failed to load community members:",
                error
            );


            state.members =
                [];


            renderMembers();
        }
    }


    async function enrichMembers() {

        const ids =
            state.members
                .map(
                    getUserId
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
                    .select(
                        "*"
                    )
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

                            ...member,

                            ...profile,

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
                (
                    a,
                    b
                ) => {

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
            member._profile?.photo_url ||
            null;


        const avatar =
            avatarUrl
                ? `
                    <img
                        src="${escapeHTML(
                            avatarUrl
                        )}"
                        alt=""
                    >
                `
                : initials(
                    name
                );


        return `
            <div
                class="member-row"
                data-user-id="${escapeHTML(
                    getUserId(member) ||
                    ""
                )}"
            >

                <div class="member-avatar">

                    ${avatar}

                    <span
                        class="presence-dot"
                        data-presence-user="${escapeHTML(
                            getUserId(member) ||
                            ""
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

            const latest =
                state.messages[
                    state.messages.length - 1
                ];


            const {
                data: existing
            } =
                await supabaseClient
                    .from(
                        "chat_read_status"
                    )
                    .select(
                        "id"
                    )
                    .eq(
                        "channel_id",
                        state.currentChannel.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .maybeSingle();


            const payload = {

                last_read_message_id:
                    latest?.id ||
                    null,

                last_read_at:
                    new Date()
                        .toISOString()
            };


            if (existing?.id) {

                await supabaseClient
                    .from(
                        "chat_read_status"
                    )
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        existing.id
                    );

            } else {

                await supabaseClient
                    .from(
                        "chat_read_status"
                    )
                    .insert({

                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        ...payload

                    });
            }

        } catch (error) {

            console.warn(
                "⚠️ Read status unavailable:",
                error
            );
        }
    }


    /* =====================================================
       REALTIME — COMMUNITY
    ====================================================== */

    async function setupCommunityRealtime() {

        if (
            state.communityRealtime
        ) {

            await supabaseClient
                .removeChannel(
                    state.communityRealtime
                );

            state.communityRealtime =
                null;
        }


        if (!state.currentCommunity) {
            return;
        }


        state.communityRealtime =
            supabaseClient
                .channel(
                    `community-${state.currentCommunity.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",

                        schema: "public",

                        table:
                            "chat_channels",

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
       REALTIME — MESSAGES
    ====================================================== */

    async function setupChannelRealtime() {

        if (
            state.messageRealtime
        ) {

            await supabaseClient
                .removeChannel(
                    state.messageRealtime
                );

            state.messageRealtime =
                null;
        }


        if (!state.currentChannel) {
            return;
        }


        const channelId =
            state.currentChannel.id;


        state.messageRealtime =
            supabaseClient
                .channel(
                    `messages-${channelId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",

                        schema: "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    payload => {

                        const incoming =
                            payload.new;


                        if (!incoming) {
                            return;
                        }


                        addMessageIfMissing(
                            incoming
                        );


                        renderMessages();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",

                        schema: "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    payload => {

                        const updated =
                            payload.new;


                        const index =
                            state.messages.findIndex(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        updated.id
                                    )
                            );


                        if (
                            index >= 0
                        ) {

                            state.messages[
                                index
                            ] =
                                updated;

                        } else {

                            addMessageIfMissing(
                                updated
                            );
                        }


                        renderMessages();
                    }
                )
                .subscribe(
                    status => {

                        console.log(
                            "📡 Message realtime:",
                            status
                        );
                    }
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

                status,

                last_seen_at:
                    new Date()
                        .toISOString(),

                updated_at:
                    new Date()
                        .toISOString()
            };


            const {
                error
            } =
                await supabaseClient
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


        const courseId =
            getElement(
                "communityCourseSelect"
            )?.value ||
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
             * Confirmed chat_communities schema:
             *
             * id
             * name
             * slug
             * description
             * icon_url
             * banner_url
             * is_public
             * is_active
             * created_by
             * created_at
             * updated_at
             *
             * There is NO course_id column.
             */

            const slug =
                createSlug(
                    name
                );


            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_communities"
                    )
                    .insert({

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

                    })
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


                /*
                 * If a course was selected, create a
                 * course-linked channel in the new community.
                 */

                if (courseId) {

                    const course =
                        state.courses.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    courseId
                                )
                        );


                    if (course) {

                        await supabaseClient
                            .from(
                                "chat_channels"
                            )
                            .insert({

                                community_id:
                                    data.id,

                                name:
                                    course.title,

                                slug:
                                    `course-${course.id}`,

                                description:
                                    course.description ||
                                    `Discussion for ${course.title}`,

                                channel_type:
                                    "course",

                                icon:
                                    "🎓",

                                position:
                                    1000 +
                                    Number(
                                        course.id
                                    ),

                                is_private:
                                    false,

                                is_archived:
                                    false,

                                is_active:
                                    true,

                                course_id:
                                    Number(
                                        course.id
                                    ),

                                created_by:
                                    state.user.id

                            });
                    }
                }
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
            !state.currentCommunity
        ) {

            showToast(
                "Select a community first.",
                "error"
            );

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
            createSlug(
                name
            );


        try {

            const course =
                courseId
                    ? state.courses.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                courseId
                            )
                    )
                    : null;


            const {
                data,
                error
            } =
                await supabaseClient
                    .from(
                        "chat_channels"
                    )
                    .insert({

                        community_id:
                            state.currentCommunity.id,

                        name,

                        slug,

                        description:
                            description ||
                            null,

                        channel_type:
                            course
                                ? "course"
                                : "text",

                        icon:
                            course
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
                            course
                                ? Number(
                                    course.id
                                )
                                : null,

                        created_by:
                            state.user.id

                    })
                    .select()
                    .single();


            if (error) {
                throw error;
            }


            /*
             * Private channel creator gets membership.
             */

            if (
                data?.id &&
                visibility === "private"
            ) {

                await supabaseClient
                    .from(
                        "chat_channel_members"
                    )
                    .insert({

                        channel_id:
                            data.id,

                        user_id:
                            state.user.id
                    });
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


    function createSlug(
        value
    ) {

        return String(
            value ||
            ""
        )
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .substring(
                0,
                100
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

                input.value =
                    "";
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
                "Only admins and super admins can create communities.",
                "error"
            );

            return;
        }


        getElement(
            "communityModal"
        )?.classList.remove(
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

            message.textContent =
                "";
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

            message.textContent =
                "";
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

                    const currentId =
                        state.currentCommunity.id;


                    const stillExists =
                        state.communities.some(
                            community =>
                                String(
                                    community.id
                                ) ===
                                String(
                                    currentId
                                )
                        );


                    if (
                        stillExists
                    ) {

                        await switchCommunity(
                            currentId
                        );
                    }
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
                    "Attachment storage will be connected after the core chat is verified."
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

        if (
            !state.communities.length
        ) {

            renderEmptyChannelState();

            return;
        }


        const urlParams =
            new URLSearchParams(
                window.location.search
            );


        const requestedCourseId =
            urlParams.get(
                "course_id"
            );


        /*
         * Currently Mwaniki Scholars has one main community.
         *
         * We still keep the architecture multi-community.
         */

        let selected =
            null;


        const stored =
            localStorage.getItem(
                "mwanikiCommunityId"
            );


        if (stored) {

            selected =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            stored
                        )
                );
        }


        if (!selected) {

            selected =
                state.communities[0];
        }


        if (selected) {

            await switchCommunity(
                selected.id
            );
        }


        /*
         * requestedCourseId is intentionally handled
         * by loadChannels() so the actual course_id is
         * used to identify duplicate course titles.
         */

        void requestedCourseId;
    }


    /* =====================================================
       PRESENCE CLEANUP
    ====================================================== */

    function setupPresence() {

        updatePresence(
            "online"
        );


        state.presenceTimer =
            setInterval(
                () => {

                    updatePresence(
                        "online"
                    );

                },
                60000
            );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    updatePresence(
                        "online"
                    );

                } else {

                    updatePresence(
                        "away"
                    );
                }
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
                "./index.html";


            return;
        }


        console.log(
            "🔐 Community authenticated user:",
            state.user.email
        );


        await loadCurrentProfile();

        await loadCourses();

        await loadCommunities();


        if (
            !state.communities.length
        ) {

            showToast(
                "No active Mwaniki community is available.",
                "error"
            );

        } else {

            await selectInitialCommunity();
        }


        applyPermissionUI();

        setupEventListeners();

        setupMobileControls();

        setupPresence();


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

                window.location.href =
                    "./index.html";


                return;
            }


            if (
                (
                    event ===
                    "SIGNED_IN" ||
                    event ===
                    "INITIAL_SESSION"
                ) &&
                session?.user
            ) {

                if (
                    !state.user
                ) {

                    state.user =
                        session.user;


                    await initializeCommunity();
                }
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
