/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   =========================================================

   IMPORTANT:
   - community.js is an ES module.
   - Supabase comes from ./supabase.js.
   - Does not create another Supabase client.
   - Uses the confirmed database schema.
   - Course communities are identified by course_id.
   - chat_messages uses user_id.
   - chat_presence uses last_seen_at.
   - chat_channels uses channel_type / is_private.
   - chat_communities uses created_by / icon_url.
========================================================= */

import { supabase } from "./supabase.js";


(() => {

    "use strict";


    console.log(
        "🚀 Mwaniki Community engine loaded"
    );


    /* =====================================================
       SUPABASE
    ===================================================== */

    const db = supabase;


    if (!db) {

        console.error(
            "❌ Supabase client is unavailable."
        );

        return;
    }


    /* =====================================================
       APPLICATION STATE
    ===================================================== */

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

        currentRole: "student",

        replyMessage: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        collapsedCategories: new Set(),

        communityRealtime: null,

        messageRealtime: null,

        presenceInterval: null

    };


    /* =====================================================
       DOM
    ===================================================== */

    function byId(id) {

        return document.getElementById(id);
    }


    function query(selector) {

        return document.querySelector(selector);
    }


    function queryAll(selector) {

        return Array.from(
            document.querySelectorAll(selector)
        );
    }


    /* =====================================================
       HTML SAFETY
    ===================================================== */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }


        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function initials(name) {

        const value = String(
            name || "Student"
        ).trim();


        if (!value) {

            return "ST";
        }


        const parts =
            value.split(/\s+/);


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


    function slugify(value) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, "")
            .substring(0, 90);
    }


    /* =====================================================
       TOAST
    ===================================================== */

    let toastTimer = null;


    function toast(message, type = "normal") {

        const element =
            byId("communityToast");


        if (!element) {

            console.log(message);

            return;
        }


        element.textContent =
            String(message || "");


        element.dataset.type =
            type;


        element.classList.add("show");


        clearTimeout(toastTimer);


        toastTimer = setTimeout(() => {

            element.classList.remove("show");

        }, 3500);
    }


    /* =====================================================
       ROLE
    ===================================================== */

    function normalizeRole(role) {

        const value =
            String(role || "student")
                .toLowerCase()
                .replace(/[\s_-]/g, "");


        if (
            value === "superadmin" ||
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


    function can(permission) {

        const role =
            normalizeRole(
                state.currentRole
            );


        const permissions = {

            student: {
                send: true,
                createChannel: false,
                createCommunity: false,
                moderate: false
            },

            tutor: {
                send: true,
                createChannel: true,
                createCommunity: false,
                moderate: false
            },

            moderator: {
                send: true,
                createChannel: true,
                createCommunity: false,
                moderate: true
            },

            admin: {
                send: true,
                createChannel: true,
                createCommunity: true,
                moderate: true
            },

            super_admin: {
                send: true,
                createChannel: true,
                createCommunity: true,
                moderate: true
            }

        };


        return Boolean(
            permissions[role] &&
            permissions[role][permission]
        );
    }


    /* =====================================================
       USER / MEMBER HELPERS
    ===================================================== */

    function memberUserId(member) {

        if (!member) {

            return null;
        }


        return (
            member.user_id ||
            member.id ||
            null
        );
    }


    function displayName(member) {

        if (!member) {

            return "Student";
        }


        return (
            member.nickname ||
            member.full_name ||
            member.name ||
            member.display_name ||
            member.username ||
            member.email ||
            member._profile?.full_name ||
            member._profile?.name ||
            member._profile?.email ||
            "Student"
        );
    }


    function findMember(userId) {

        if (!userId) {

            return null;
        }


        return (
            state.members.find(
                member =>
                    String(
                        memberUserId(member)
                    ) ===
                    String(userId)
            ) ||
            null
        );
    }


    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    async function getUser() {

        const result =
            await db.auth.getUser();


        if (result.error) {

            console.error(
                "❌ Auth error:",
                result.error
            );

            return null;
        }


        return result.data?.user || null;
    }


    /* =====================================================
       STUDENT PROFILE
    ===================================================== */

    async function loadProfile() {

        if (!state.user) {

            return;
        }


        try {

            const result =
                await db
                    .from("students")
                    .select("*")
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();


            if (
                !result.error &&
                result.data
            ) {

                state.profile =
                    result.data;
            }

        } catch (error) {

            console.warn(
                "⚠️ Profile lookup unavailable:",
                error
            );
        }
    }


    /* =====================================================
       COURSES
    ===================================================== */

    async function loadCourses() {

        try {

            const result =
                await db
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


            if (result.error) {

                throw result.error;
            }


            state.courses =
                Array.isArray(result.data)
                    ? result.data
                    : [];


            populateCourseSelects();


            console.log(
                "📚 Courses loaded:",
                state.courses.length
            );

        } catch (error) {

            console.error(
                "❌ Course loading failed:",
                error
            );


            state.courses = [];

            populateCourseSelects();
        }
    }


    function getCourse(courseId) {

        if (
            courseId === null ||
            courseId === undefined
        ) {

            return null;
        }


        return (
            state.courses.find(
                course =>
                    String(course.id) ===
                    String(courseId)
            ) ||
            null
        );
    }


    function getCourseName(courseId) {

        return (
            getCourse(courseId)?.title ||
            ""
        );
    }


    function populateCourseSelects() {

        const communitySelect =
            byId("communityCourseSelect");


        const channelSelect =
            byId("channelCourseSelect");


        if (communitySelect) {

            let html =
                '<option value="">General Community</option>';


            state.courses.forEach(
                course => {

                    html +=
                        "<option value=\"" +
                        escapeHTML(course.id) +
                        "\">" +
                        escapeHTML(course.title) +
                        "</option>";
                }
            );


            communitySelect.innerHTML =
                html;
        }


        if (channelSelect) {

            let html =
                '<option value="">No specific course</option>';


            state.courses.forEach(
                course => {

                    html +=
                        "<option value=\"" +
                        escapeHTML(course.id) +
                        "\">" +
                        escapeHTML(course.title) +
                        "</option>";
                }
            );


            channelSelect.innerHTML =
                html;
        }
    }


    /* =====================================================
       COMMUNITIES
    ===================================================== */

    async function loadCommunities() {

        const result =
            await db
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


        if (result.error) {

            console.error(
                "❌ Community loading failed:",
                result.error
            );


            state.communities = [];

            renderCommunityRail();

            return;
        }


        state.communities =
            result.data || [];


        renderCommunityRail();


        console.log(
            "🏘️ Communities loaded:",
            state.communities.length
        );
    }


    /* =====================================================
       COMMUNITY RAIL
    ===================================================== */

    function renderCommunityRail() {

        const rail =
            byId("communityRail");


        if (!rail) {

            return;
        }


        if (!state.communities.length) {

            rail.innerHTML =
                '<div class="channel-empty">No communities</div>';

            return;
        }


        let html = "";


        state.communities.forEach(
            community => {

                const active =
                    state.currentCommunity &&
                    String(
                        state.currentCommunity.id
                    ) ===
                    String(community.id);


                const icon =
                    community.icon_url ||
                    initials(
                        community.name
                    );


                html +=
                    '<button ' +
                    'type="button" ' +
                    'class="community-rail-item ' +
                    (
                        active
                            ? "active"
                            : ""
                    ) +
                    '" ' +
                    'data-community-id="' +
                    escapeHTML(
                        community.id
                    ) +
                    '" ' +
                    'title="' +
                    escapeHTML(
                        community.name
                    ) +
                    '">' +
                    '<div class="community-rail-icon">' +
                    escapeHTML(icon) +
                    "</div>" +
                    "</button>";
            }
        );


        rail.innerHTML =
            html;


        queryAll(
            ".community-rail-item[data-community-id]"
        ).forEach(
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
       COMMUNITY MEMBERSHIP / ROLE
    ===================================================== */

    async function ensureMembership() {

        if (
            !state.user ||
            !state.currentCommunity
        ) {

            return;
        }


        const lookup =
            await db
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


        if (lookup.error) {

            console.warn(
                "⚠️ Membership lookup failed:",
                lookup.error
            );

            return;
        }


        if (lookup.data) {

            return;
        }


        if (
            state.currentCommunity.is_public ===
            true
        ) {

            const insert =
                await db
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


            if (insert.error) {

                console.warn(
                    "⚠️ Could not automatically join community:",
                    insert.error
                );
            }
        }
    }


    async function loadRole() {

        state.currentRole =
            "student";


        if (
            !state.user ||
            !state.currentCommunity
        ) {

            updatePermissionUI();

            return;
        }


        const result =
            await db
                .from(
                    "chat_community_members"
                )
                .select(
                    "role,is_banned,is_muted,nickname"
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
            !result.error &&
            result.data
        ) {

            if (
                result.data.is_banned
            ) {

                state.currentRole =
                    "student";

            } else {

                state.currentRole =
                    normalizeRole(
                        result.data.role
                    );
            }
        }


        updatePermissionUI();
    }


    function updatePermissionUI() {

        const roleBadge =
            byId("activeRoleBadge");


        if (roleBadge) {

            roleBadge.textContent =
                roleLabel(
                    state.currentRole
                );
        }


        const createChannel =
            byId(
                "createChannelButton"
            );


        const createCommunity =
            byId(
                "createCommunityButton"
            );


        const menuChannel =
            byId(
                "communityMenuCreateChannel"
            );


        const menuCommunity =
            byId(
                "communityMenuCreateCommunity"
            );


        if (createChannel) {

            createChannel.style.display =
                can("createChannel")
                    ? ""
                    : "none";
        }


        if (createCommunity) {

            createCommunity.style.display =
                can("createCommunity")
                    ? ""
                    : "none";
        }


        if (menuChannel) {

            menuChannel.style.display =
                can("createChannel")
                    ? ""
                    : "none";
        }


        if (menuCommunity) {

            menuCommunity.style.display =
                can("createCommunity")
                    ? ""
                    : "none";
        }


        const input =
            byId("messageInput");


        const send =
            byId("sendMessageButton");


        if (input) {

            input.disabled =
                !can("send");


            if (state.currentChannel) {

                input.placeholder =
                    can("send")
                        ? "Message #" +
                          state.currentChannel.name
                        : "You cannot send messages here.";
            }
        }


        if (send) {

            send.disabled =
                !can("send");
        }
    }


    /* =====================================================
       SWITCH COMMUNITY
    ===================================================== */

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

            toast(
                "Community not found.",
                "error"
            );

            return;
        }


        state.currentCommunity =
            community;


        state.currentChannel =
            null;


        state.channels = [];

        state.messages = [];

        state.members = [];


        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );


        renderCommunityRail();

        renderActiveCommunity();


        await ensureMembership();

        await loadRole();

        await loadChannels();

        await loadMembers();

        setupCommunityRealtime();


        console.log(
            "🔄 Active community:",
            community.name
        );
    }


    function renderActiveCommunity() {

        if (
            !state.currentCommunity
        ) {

            return;
        }


        const name =
            byId(
                "activeCommunityName"
            );


        const description =
            byId(
                "activeCommunityDescription"
            );


        const icon =
            byId(
                "activeCommunityIcon"
            );


        if (name) {

            name.textContent =
                state.currentCommunity.name ||
                "Mwaniki Community";
        }


        if (description) {

            description.textContent =
                state.currentCommunity.description ||
                "Medical learning community";
        }


        if (icon) {

            icon.textContent =
                state.currentCommunity.icon_url ||
                initials(
                    state.currentCommunity.name
                );
        }


        updateCourseBanner(
            null
        );
    }


    /* =====================================================
       COURSE BANNER
    ===================================================== */

    function updateCourseBanner(
        courseId
    ) {

        const name =
            byId(
                "communityCourseName"
            );


        const label =
            byId(
                "communityCourseLabel"
            );


        if (!name || !label) {

            return;
        }


        if (courseId) {

            const course =
                getCourse(courseId);


            name.textContent =
                course?.title ||
                "Course Community";


            label.textContent =
                "Course Community";


            return;
        }


        name.textContent =
            "General Community";


        label.textContent =
            "Community";
    }


    /* =====================================================
       COURSE ID FROM URL
    ===================================================== */

    function getRequestedCourseId() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return params.get(
            "course_id"
        );
    }


    /* =====================================================
       CHANNELS
    ===================================================== */

    async function loadChannels() {

        if (
            !state.currentCommunity
        ) {

            return;
        }


        const list =
            byId("channelList");


        if (list) {

            list.innerHTML =
                '<div class="channel-loading">Loading channels...</div>';
        }


        const result =
            await db
                .from("chat_channels")
                .select("*")
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


        if (result.error) {

            console.error(
                "❌ Channel loading failed:",
                result.error
            );


            state.channels = [];


            if (list) {

                list.innerHTML =
                    '<div class="channel-empty">Unable to load channels.</div>';
            }


            return;
        }


        let channels =
            result.data || [];


        channels =
            await filterPrivateChannels(
                channels
            );


        state.channels =
            channels;


        renderChannels();


        let selected = null;


        const requestedCourseId =
            getRequestedCourseId();


        /*
         * COURSE ID HAS PRIORITY.
         *
         * This means Clinical Pharmacology 29
         * and Clinical Pharmacology 49 remain
         * completely separate.
         */

        if (requestedCourseId) {

            selected =
                channels.find(
                    channel =>
                        channel.course_id !== null &&
                        String(
                            channel.course_id
                        ) ===
                        String(
                            requestedCourseId
                        )
                );


            if (selected) {

                updateCourseBanner(
                    selected.course_id
                );
            }
        }


        if (!selected) {

            selected =
                channels.find(
                    channel =>
                        String(
                            channel.name || ""
                        ).toLowerCase() ===
                        "general"
                );
        }


        if (!selected) {

            selected =
                channels[0] ||
                null;
        }


        if (selected) {

            await selectChannel(
                selected.id
            );

        } else {

            renderEmptyChannel();
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


        const result =
            await db
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


        const memberChannelIds =
            new Set(
                (result.data || [])
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
                    can("moderate")
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


    /* =====================================================
       CHANNEL CATEGORY
    ===================================================== */

    function channelCategory(
        channel
    ) {

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


    /* =====================================================
       RENDER CHANNELS
    ===================================================== */

    function renderChannels() {

        const list =
            byId("channelList");


        if (!list) {

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
                        );


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

                        courseName
                            .toLowerCase()
                            .includes(search)
                    );
                }
            );


        if (!filtered.length) {

            list.innerHTML =
                '<div class="channel-empty">No channels found.</div>';

            return;
        }


        const groups =
            new Map();


        filtered.forEach(
            channel => {

                const category =
                    channelCategory(
                        channel
                    );


                if (
                    !groups.has(category)
                ) {

                    groups.set(
                        category,
                        []
                    );
                }


                groups
                    .get(category)
                    .push(channel);
            }
        );


        let html = "";


        groups.forEach(
            (
                channels,
                category
            ) => {

                const collapsed =
                    state.collapsedCategories.has(
                        category
                    );


                html +=
                    '<div class="channel-category ' +
                    (
                        collapsed
                            ? "collapsed"
                            : ""
                    ) +
                    '">';


                html +=
                    '<button ' +
                    'type="button" ' +
                    'class="channel-category-header" ' +
                    'data-category="' +
                    escapeHTML(category) +
                    '">';


                html +=
                    '<span class="channel-category-title">';


                html +=
                    '<span class="channel-category-arrow">' +
                    (
                        collapsed
                            ? "▸"
                            : "▾"
                    ) +
                    "</span>";


                html +=
                    "<span>" +
                    escapeHTML(category) +
                    "</span>";


                html +=
                    "</span>";


                html +=
                    "<span>" +
                    String(
                        channels.length
                    ) +
                    "</span>";


                html +=
                    "</button>";


                if (!collapsed) {

                    html +=
                        '<div class="channel-category-items">';


                    channels.forEach(
                        channel => {

                            html +=
                                renderChannel(
                                    channel
                                );
                        }
                    );


                    html +=
                        "</div>";
                }


                html +=
                    "</div>";
            }
        );


        list.innerHTML =
            html;


        queryAll(
            ".channel-category-header"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const category =
                            button.dataset.category;


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
                );
            }
        );


        queryAll(
            ".channel-row"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await selectChannel(
                            button.dataset.channelId
                        );
                    }
                );
            }
        );
    }


    function renderChannel(
        channel
    ) {

        const active =
            state.currentChannel &&
            String(
                state.currentChannel.id
            ) ===
            String(channel.id);


        const icon =
            channel.is_private
                ? "🔒"
                : (
                    channel.icon ||
                    "#"
                );


        const courseName =
            getCourseName(
                channel.course_id
            );


        let html =
            '<button ' +
            'type="button" ' +
            'class="channel-row ' +
            (
                active
                    ? "active"
                    : ""
            ) +
            '" ' +
            'data-channel-id="' +
            escapeHTML(channel.id) +
            '">';


        html +=
            '<span class="channel-row-icon">' +
            escapeHTML(icon) +
            "</span>";


        html +=
            '<span class="channel-row-content">';


        html +=
            '<span class="channel-row-name">' +
            escapeHTML(
                channel.name ||
                "channel"
            ) +
            "</span>";


        html +=
            '<span class="channel-row-meta">';


        html +=
            (
                channel.is_private
                    ? "Private"
                    : "Public"
            );


        if (courseName) {

            html +=
                '<span class="course-mini-badge">' +
                escapeHTML(courseName) +
                "</span>";
        }


        html +=
            "</span>";


        html +=
            "</span>";


        html +=
            "</button>";


        return html;
    }


    function renderEmptyChannel() {

        const list =
            byId("channelList");


        if (!list) {

            return;
        }


        list.innerHTML =
            '<div class="channel-empty">' +
            "No channels are available." +
            "</div>";
    }


    /* =====================================================
       SELECT CHANNEL
    ===================================================== */

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

        state.replyMessage = null;


        renderChannels();

        renderActiveChannel();

        updateCourseBanner(
            channel.course_id
        );

        updatePermissionUI();


        await loadMessages();

        await markChannelRead();

        setupMessageRealtime();
    }


    function renderActiveChannel() {

        const channel =
            state.currentChannel;


        if (!channel) {

            return;
        }


        const name =
            byId(
                "activeChannelName"
            );


        const description =
            byId(
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


        updatePermissionUI();
    }


    /* =====================================================
       MESSAGES
    ===================================================== */

    async function loadMessages() {

        if (!state.currentChannel) {

            return;
        }


        const list =
            byId("messageList");


        if (list) {

            list.innerHTML =
                '<div class="channel-loading">Loading messages...</div>';
        }


        const result =
            await db
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
                .limit(300);


        if (result.error) {

            console.error(
                "❌ Message loading failed:",
                result.error
            );


            state.messages = [];


            if (list) {

                list.innerHTML =
                    '<div class="channel-empty">Unable to load messages.</div>';
            }


            return;
        }


        state.messages =
            result.data || [];


        renderMessages();
    }


    function renderMessages() {

        const list =
            byId("messageList");


        if (!list) {

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

            let title =
                "Welcome to the channel";


            let paragraph =
                "Start the conversation and learn with other Mwaniki Scholars students.";


            if (search) {

                title =
                    "No matching messages";


                paragraph =
                    "Try a different search.";
            }


            list.innerHTML =
                '<div class="welcome-message">' +
                '<div class="welcome-icon">#</div>' +
                "<h2>" +
                escapeHTML(title) +
                "</h2>" +
                "<p>" +
                escapeHTML(paragraph) +
                "</p>" +
                "</div>";


            return;
        }


        let html = "";


        messages.forEach(
            message => {

                html +=
                    renderMessage(
                        message
                    );
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


    function renderMessage(
        message
    ) {

        const isSystem =
            !message.user_id;


        const member =
            isSystem
                ? null
                : findMember(
                    message.user_id
                );


        const name =
            isSystem
                ? "Mwaniki Scholars"
                : displayName(member);


        const photo =
            member?.photo_url ||
            member?._profile?.photo_url ||
            "";


        let avatarHTML = "";


        if (photo) {

            avatarHTML =
                '<img src="' +
                escapeHTML(photo) +
                '" alt="">';

        } else {

            avatarHTML =
                escapeHTML(
                    initials(name)
                );
        }


        const own =
            state.user &&
            String(
                message.user_id
            ) ===
            String(
                state.user.id
            );


        const canDelete =
            own ||
            can("moderate");


        const content =
            message.is_deleted
                ? "This message was deleted."
                : String(
                    message.content || ""
                );


        const time =
            formatDate(
                message.created_at
            );


        let html =
            '<article class="message ' +
            (
                own
                    ? "own-message "
                    : ""
            ) +
            (
                message.is_deleted
                    ? "deleted-message"
                    : ""
            ) +
            '" data-message-id="' +
            escapeHTML(message.id) +
            '">';


        html +=
            '<div class="message-avatar">' +
            avatarHTML +
            "</div>";


        html +=
            '<div class="message-body">';


        html +=
            '<div class="message-meta">';


        html +=
            '<span class="message-author">' +
            escapeHTML(name) +
            "</span>";


        html +=
            '<span class="message-time">' +
            escapeHTML(time) +
            "</span>";


        if (message.is_pinned) {

            html +=
                '<span title="Pinned message">📌</span>';
        }


        html +=
            "</div>";


        if (
            message.parent_message_id
        ) {

            const parent =
                state.messages.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            message.parent_message_id
                        )
                );


            if (parent) {

                html +=
                    '<div class="message-reply-reference">' +
                    escapeHTML(
                        parent.content || ""
                    ) +
                    "</div>";
            }
        }


        html +=
            '<div class="message-content">' +
            escapeHTML(content) +
            "</div>";


        if (
            !message.is_deleted
        ) {

            html +=
                '<div class="message-actions">';


            html +=
                '<button type="button" class="message-action" ' +
                'data-action="reply" ' +
                'data-message-id="' +
                escapeHTML(message.id) +
                '">' +
                "↩ Reply" +
                "</button>";


            if (can("moderate")) {

                html +=
                    '<button type="button" class="message-action" ' +
                    'data-action="pin" ' +
                    'data-message-id="' +
                    escapeHTML(message.id) +
                    '">' +
                    (
                        message.is_pinned
                            ? "Unpin"
                            : "Pin"
                    ) +
                    "</button>";
            }


            if (canDelete) {

                html +=
                    '<button type="button" class="message-action" ' +
                    'data-action="delete" ' +
                    'data-message-id="' +
                    escapeHTML(message.id) +
                    '">' +
                    "Delete" +
                    "</button>";
            }


            html +=
                "</div>";
        }


        html +=
            "</div>";


        html +=
            "</article>";


        return html;
    }


    function bindMessageActions() {

        queryAll(
            ".message-action"
        ).forEach(
            button => {

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

                            startReply(
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
                            "pin"
                        ) {

                            await togglePin(
                                messageId
                            );
                        }
                    }
                );
            }
        );
    }


    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    async function sendMessage() {

        if (!can("send")) {

            toast(
                "You cannot send messages here.",
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
            byId("messageInput");


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

            toast(
                "Message is too long.",
                "error"
            );

            return;
        }


        const payload = {

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content:
                content,

            message_type:
                "text",

            parent_message_id:
                state.replyMessage?.id ||
                null
        };


        const result =
            await db
                .from(
                    "chat_messages"
                )
                .insert(payload)
                .select()
                .single();


        if (result.error) {

            console.error(
                "❌ Send message failed:",
                result.error
            );


            toast(
                result.error.message ||
                "Unable to send message.",
                "error"
            );

            return;
        }


        input.value = "";

        resizeTextarea(input);

        clearReply();


        if (result.data) {

            addMessage(
                result.data
            );

            renderMessages();
        }


        await markChannelRead();
    }


    function addMessage(
        message
    ) {

        if (!message?.id) {

            return;
        }


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
        }
    }


    /* =====================================================
       DELETE MESSAGE
    ===================================================== */

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


        const own =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );


        if (
            !own &&
            !can("moderate")
        ) {

            toast(
                "You cannot delete this message.",
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


        const result =
            await db
                .from(
                    "chat_messages"
                )
                .update({

                    is_deleted:
                        true,

                    deleted_at:
                        new Date().toISOString(),

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    messageId
                );


        if (result.error) {

            console.error(
                "❌ Delete failed:",
                result.error
            );


            toast(
                "Unable to delete message.",
                "error"
            );

            return;
        }


        message.is_deleted =
            true;


        renderMessages();


        toast(
            "Message deleted."
        );
    }


    /* =====================================================
       PIN MESSAGE
    ===================================================== */

    async function togglePin(
        messageId
    ) {

        if (!can("moderate")) {

            return;
        }


        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );


        if (!message) {

            return;
        }


        const newValue =
            !Boolean(
                message.is_pinned
            );


        const result =
            await db
                .from(
                    "chat_messages"
                )
                .update({

                    is_pinned:
                        newValue,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    messageId
                );


        if (result.error) {

            console.error(
                "❌ Pin update failed:",
                result.error
            );


            toast(
                "Unable to update pinned message.",
                "error"
            );

            return;
        }


        message.is_pinned =
            newValue;


        renderMessages();
    }


    /* =====================================================
       REPLIES
    ===================================================== */

    function startReply(
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


        state.replyMessage =
            message;


        const preview =
            byId("replyPreview");


        const text =
            byId("replyPreviewText");


        if (preview) {

            preview.classList.remove(
                "hidden"
            );
        }


        if (text) {

            text.textContent =
                message.content || "";
        }


        byId(
            "messageInput"
        )?.focus();
    }


    function clearReply() {

        state.replyMessage =
            null;


        const preview =
            byId("replyPreview");


        const text =
            byId("replyPreviewText");


        if (preview) {

            preview.classList.add(
                "hidden"
            );
        }


        if (text) {

            text.textContent =
                "";
        }
    }


    /* =====================================================
       MEMBERS
    ===================================================== */

    async function loadMembers() {

        if (
            !state.currentCommunity
        ) {

            return;
        }


        const result =
            await db
                .from(
                    "chat_community_members"
                )
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
                );


        if (result.error) {

            console.error(
                "❌ Member loading failed:",
                result.error
            );


            state.members = [];

            renderMembers();

            return;
        }


        state.members =
            result.data || [];


        await enrichMembers();

        renderMembers();
    }


    async function enrichMembers() {

        const ids =
            state.members
                .map(
                    memberUserId
                )
                .filter(Boolean);


        if (!ids.length) {

            return;
        }


        try {

            const result =
                await db
                    .from(
                        "students"
                    )
                    .select("*")
                    .in(
                        "id",
                        ids
                    );


            if (
                result.error ||
                !result.data
            ) {

                return;
            }


            const profiles =
                new Map();


            result.data.forEach(
                profile => {

                    profiles.set(
                        String(profile.id),
                        profile
                    );
                }
            );


            state.members =
                state.members.map(
                    member => {

                        const id =
                            memberUserId(
                                member
                            );


                        const profile =
                            profiles.get(
                                String(id)
                            );


                        if (!profile) {

                            return member;
                        }


                        return {
                            ...member,
                            _profile:
                                profile,
                            ...profile
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


    function renderMembers() {

        const list =
            byId("memberList");


        const count =
            byId("memberCount");


        if (!list) {

            return;
        }


        const search =
            state.memberSearch
                .trim()
                .toLowerCase();


        let members =
            [...state.members];


        if (search) {

            members =
                members.filter(
                    member => {

                        const name =
                            displayName(
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
        }


        if (count) {

            count.textContent =
                String(
                    state.members.length
                ) +
                (
                    state.members.length === 1
                        ? " member"
                        : " members"
                );
        }


        if (!members.length) {

            list.innerHTML =
                '<div class="member-empty">No members found.</div>';

            return;
        }


        const priority = {

            super_admin: 1,

            admin: 2,

            moderator: 3,

            tutor: 4,

            student: 5
        };


        members.sort(
            (a, b) => {

                const aRole =
                    priority[
                        normalizeRole(
                            a.role
                        )
                    ] || 99;


                const bRole =
                    priority[
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


                return displayName(a)
                    .localeCompare(
                        displayName(b)
                    );
            }
        );


        let html = "";


        members.forEach(
            member => {

                const name =
                    displayName(
                        member
                    );


                const photo =
                    member.photo_url ||
                    member._profile?.photo_url ||
                    "";


                let avatar = "";


                if (photo) {

                    avatar =
                        '<img src="' +
                        escapeHTML(photo) +
                        '" alt="">';

                } else {

                    avatar =
                        escapeHTML(
                            initials(name)
                        );
                }


                html +=
                    '<div class="member-row">';


                html +=
                    '<div class="member-avatar">' +
                    avatar +
                    '<span class="presence-dot"></span>' +
                    "</div>";


                html +=
                    '<div class="member-info">';


                html +=
                    '<span class="member-name">' +
                    escapeHTML(name) +
                    "</span>";


                html +=
                    '<span class="member-role">' +
                    escapeHTML(
                        roleLabel(
                            member.role
                        )
                    ) +
                    "</span>";


                html +=
                    "</div>";


                html +=
                    "</div>";
            }
        );


        list.innerHTML =
            html;
    }


    /* =====================================================
       READ STATUS
    ===================================================== */

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


        const existing =
            await db
                .from(
                    "chat_read_status"
                )
                .select("id")
                .eq(
                    "channel_id",
                    state.currentChannel.id
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();


        const values = {

            last_read_message_id:
                latest?.id ||
                null,

            last_read_at:
                new Date().toISOString()
        };


        if (
            existing.data?.id
        ) {

            await db
                .from(
                    "chat_read_status"
                )
                .update(values)
                .eq(
                    "id",
                    existing.data.id
                );

        } else {

            await db
                .from(
                    "chat_read_status"
                )
                .insert({

                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    ...values
                });
        }
    }


    /* =====================================================
       REALTIME COMMUNITY
    ===================================================== */

    async function setupCommunityRealtime() {

        if (
            state.communityRealtime
        ) {

            await db.removeChannel(
                state.communityRealtime
            );


            state.communityRealtime =
                null;
        }


        if (
            !state.currentCommunity
        ) {

            return;
        }


        state.communityRealtime =
            db
                .channel(
                    "community-" +
                    state.currentCommunity.id
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_channels",
                        filter:
                            "community_id=eq." +
                            state.currentCommunity.id
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
       REALTIME MESSAGES
    ===================================================== */

    async function setupMessageRealtime() {

        if (
            state.messageRealtime
        ) {

            await db.removeChannel(
                state.messageRealtime
            );


            state.messageRealtime =
                null;
        }


        if (
            !state.currentChannel
        ) {

            return;
        }


        const channelId =
            state.currentChannel.id;


        state.messageRealtime =
            db
                .channel(
                    "messages-" +
                    channelId
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            "channel_id=eq." +
                            channelId
                    },
                    payload => {

                        addMessage(
                            payload.new
                        );


                        renderMessages();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            "channel_id=eq." +
                            channelId
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

                            addMessage(
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
    ===================================================== */

    async function updatePresence(
        status = "online"
    ) {

        if (!state.user) {

            return;
        }


        const result =
            await db
                .from(
                    "chat_presence"
                )
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        status:
                            status,

                        last_seen_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "user_id"
                    }
                );


        if (result.error) {

            console.warn(
                "⚠️ Presence update failed:",
                result.error
            );
        }
    }


    function startPresence() {

        updatePresence(
            "online"
        );


        state.presenceInterval =
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
    }


    /* =====================================================
       CREATE COMMUNITY
    ===================================================== */

    async function handleCreateCommunity(
        event
    ) {

        event.preventDefault();


        if (!can("createCommunity")) {

            toast(
                "You do not have permission to create communities.",
                "error"
            );

            return;
        }


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


        const courseId =
            byId(
                "communityCourseSelect"
            )?.value ||
            "";


        const formMessage =
            byId(
                "communityFormMessage"
            );


        if (!name) {

            if (formMessage) {

                formMessage.textContent =
                    "Community name is required.";
            }

            return;
        }


        const baseSlug =
            slugify(name);


        const slug =
            baseSlug +
            "-" +
            Date.now()
                .toString()
                .slice(-6);


        const result =
            await db
                .from(
                    "chat_communities"
                )
                .insert({

                    name:
                        name,

                    slug:
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


        if (result.error) {

            console.error(
                "❌ Community creation failed:",
                result.error
            );


            if (formMessage) {

                formMessage.textContent =
                    result.error.message;
            }


            toast(
                "Unable to create community.",
                "error"
            );

            return;
        }


        const community =
            result.data;


        /*
         * Add creator as super admin.
         */

        await db
            .from(
                "chat_community_members"
            )
            .insert({

                community_id:
                    community.id,

                user_id:
                    state.user.id,

                role:
                    "super_admin"
            });


        /*
         * A community cannot directly store course_id
         * because that column does not exist.
         *
         * Instead we create a course channel.
         */

        if (courseId) {

            const course =
                getCourse(
                    courseId
                );


            if (course) {

                await db
                    .from(
                        "chat_channels"
                    )
                    .insert({

                        community_id:
                            community.id,

                        name:
                            course.title,

                        slug:
                            "course-" +
                            course.id,

                        description:
                            course.description ||
                            "Course discussion community.",

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


        closeCommunityModal();

        await loadCommunities();

        await switchCommunity(
            community.id
        );


        toast(
            "Community created successfully."
        );
    }


    /* =====================================================
       CREATE CHANNEL
    ===================================================== */

    async function handleCreateChannel(
        event
    ) {

        event.preventDefault();


        if (!can("createChannel")) {

            toast(
                "You do not have permission to create channels.",
                "error"
            );

            return;
        }


        if (
            !state.currentCommunity
        ) {

            return;
        }


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
            "";


        const formMessage =
            byId(
                "channelFormMessage"
            );


        if (!name) {

            if (formMessage) {

                formMessage.textContent =
                    "Channel name is required.";
            }

            return;
        }


        const course =
            courseId
                ? getCourse(courseId)
                : null;


        let channelSlug =
            slugify(name);


        channelSlug =
            channelSlug +
            "-" +
            Date.now()
                .toString()
                .slice(-6);


        const result =
            await db
                .from(
                    "chat_channels"
                )
                .insert({

                    community_id:
                        state.currentCommunity.id,

                    name:
                        name,

                    slug:
                        channelSlug,

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


        if (result.error) {

            console.error(
                "❌ Channel creation failed:",
                result.error
            );


            if (formMessage) {

                formMessage.textContent =
                    result.error.message;
            }


            toast(
                "Unable to create channel.",
                "error"
            );

            return;
        }


        const channel =
            result.data;


        /*
         * Private channel creator receives
         * explicit channel membership.
         */

        if (
            channel &&
            visibility === "private"
        ) {

            await db
                .from(
                    "chat_channel_members"
                )
                .insert({

                    channel_id:
                        channel.id,

                    user_id:
                        state.user.id
                });
        }


        closeChannelModal();

        await loadChannels();


        if (channel) {

            await selectChannel(
                channel.id
            );
        }


        toast(
            "Channel created successfully."
        );
    }


    /* =====================================================
       MODALS
    ===================================================== */

    function openCommunityModal() {

        if (!can("createCommunity")) {

            toast(
                "Only administrators can create communities.",
                "error"
            );

            return;
        }


        byId(
            "communityModal"
        )?.classList.remove(
            "hidden"
        );
    }


    function closeCommunityModal() {

        byId(
            "communityModal"
        )?.classList.add(
            "hidden"
        );


        byId(
            "communityForm"
        )?.reset();


        const message =
            byId(
                "communityFormMessage"
            );


        if (message) {

            message.textContent =
                "";
        }
    }


    function openChannelModal() {

        if (!can("createChannel")) {

            toast(
                "You do not have permission to create channels.",
                "error"
            );

            return;
        }


        byId(
            "channelModal"
        )?.classList.remove(
            "hidden"
        );
    }


    function closeChannelModal() {

        byId(
            "channelModal"
        )?.classList.add(
            "hidden"
        );


        byId(
            "channelForm"
        )?.reset();


        const message =
            byId(
                "channelFormMessage"
            );


        if (message) {

            message.textContent =
                "";
        }
    }


    /* =====================================================
       COMMUNITY MENU
    ===================================================== */

    function toggleCommunityMenu() {

        const menu =
            byId(
                "communityMenu"
            );


        if (!menu) {

            return;
        }


        menu.classList.toggle(
            "hidden"
        );
    }


    function closeCommunityMenu() {

        byId(
            "communityMenu"
        )?.classList.add(
            "hidden"
        );
    }


    /* =====================================================
       MESSAGE SEARCH
    ===================================================== */

    function toggleMessageSearch() {

        const panel =
            byId(
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

            byId(
                "messageSearchInput"
            )?.focus();

        } else {

            state.messageSearch =
                "";


            const input =
                byId(
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
       TEXTAREA
    ===================================================== */

    function resizeTextarea(
        textarea
    ) {

        if (!textarea) {

            return;
        }


        textarea.style.height =
            "auto";


        textarea.style.height =
            Math.min(
                textarea.scrollHeight,
                150
            ) +
            "px";
    }


    /* =====================================================
       EVENT LISTENERS
    ===================================================== */

    function setupEvents() {

        const createCommunity =
            byId(
                "createCommunityButton"
            );


        if (createCommunity) {

            createCommunity.addEventListener(
                "click",
                openCommunityModal
            );
        }


        const communityForm =
            byId(
                "communityForm"
            );


        if (communityForm) {

            communityForm.addEventListener(
                "submit",
                handleCreateCommunity
            );
        }


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
            "createChannelButton"
        )?.addEventListener(
            "click",
            openChannelModal
        );


        byId(
            "channelForm"
        )?.addEventListener(
            "submit",
            handleCreateChannel
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
            "communityMenuButton"
        )?.addEventListener(
            "click",
            toggleCommunityMenu
        );


        byId(
            "communityMenuCreateChannel"
        )?.addEventListener(
            "click",
            () => {

                closeCommunityMenu();

                openChannelModal();
            }
        );


        byId(
            "communityMenuCreateCommunity"
        )?.addEventListener(
            "click",
            () => {

                closeCommunityMenu();

                openCommunityModal();
            }
        );


        byId(
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


                toast(
                    "Community refreshed."
                );
            }
        );


        byId(
            "messageForm"
        )?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await sendMessage();
            }
        );


        const messageInput =
            byId(
                "messageInput"
            );


        if (messageInput) {

            messageInput.addEventListener(
                "input",
                () => {

                    resizeTextarea(
                        messageInput
                    );
                }
            );


            messageInput.addEventListener(
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
        }


        byId(
            "cancelReplyButton"
        )?.addEventListener(
            "click",
            clearReply
        );


        byId(
            "memberToggleButton"
        )?.addEventListener(
            "click",
            () => {

                byId(
                    "memberSidebar"
                )?.classList.toggle(
                    "open"
                );
            }
        );


        byId(
            "closeMemberSidebarButton"
        )?.addEventListener(
            "click",
            () => {

                byId(
                    "memberSidebar"
                )?.classList.remove(
                    "open"
                );
            }
        );


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


        byId(
            "chatSearchButton"
        )?.addEventListener(
            "click",
            toggleMessageSearch
        );


        byId(
            "closeMessageSearchButton"
        )?.addEventListener(
            "click",
            toggleMessageSearch
        );


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


        byId(
            "attachmentButton"
        )?.addEventListener(
            "click",
            () => {

                toast(
                    "Attachments will be connected after the core messaging system is verified."
                );
            }
        );


        document.addEventListener(
            "click",
            event => {

                const menu =
                    byId(
                        "communityMenu"
                    );


                const button =
                    byId(
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
                    event.key ===
                    "Escape"
                ) {

                    closeCommunityMenu();

                    closeCommunityModal();

                    closeChannelModal();

                    clearReply();
                }
            }
        );


        byId(
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


        byId(
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
    ===================================================== */

    async function selectInitialCommunity() {

        if (!state.communities.length) {

            renderEmptyChannel();

            return;
        }


        const storedId =
            localStorage.getItem(
                "mwanikiCommunityId"
            );


        let community = null;


        if (storedId) {

            community =
                state.communities.find(
                    item =>
                        String(item.id) ===
                        String(storedId)
                );
        }


        if (!community) {

            community =
                state.communities[0];
        }


        if (community) {

            await switchCommunity(
                community.id
            );
        }
    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {

        console.log(
            "🚀 Initializing Mwaniki Community..."
        );


        state.user =
            await getUser();


        if (!state.user) {

            console.warn(
                "⚠️ No authenticated user."
            );


            window.location.href =
                "./index.html";


            return;
        }


        console.log(
            "🔐 Authenticated:",
            state.user.email
        );


        await loadProfile();

        await loadCourses();

        await loadCommunities();

        await selectInitialCommunity();

        setupEvents();

        startPresence();

        updatePermissionUI();


        console.log(
            "✅ Mwaniki Community is ready."
        );
    }


    /* =====================================================
       AUTH STATE
    ===================================================== */

    db.auth.onAuthStateChange(
        (
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
            }


            if (
                event ===
                "SIGNED_IN" &&
                session?.user
            ) {

                state.user =
                    session.user;
            }
        }
    );


    /* =====================================================
       START APPLICATION
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();
    }

})();
