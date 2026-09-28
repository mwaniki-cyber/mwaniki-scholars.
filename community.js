/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js

   Database-aligned with:

   chat_communities
   chat_community_members
   chat_channels
   chat_channel_members
   chat_messages
   chat_message_reactions
   chat_presence
   chat_read_status
   chat_notifications
   chat_reports
   chat_attachments

   IMPORTANT:
   - ES module
   - Uses ./supabase.js
   - Course communities are keyed by course_id
   - chat_messages uses user_id
   - chat_presence uses last_seen_at
   - chat_communities uses created_by / icon_url
   - chat_channels uses channel_type / is_private
   - No fake voice/video functionality
   ========================================================= */

import { supabase } from "./supabase.js";


(() => {

    "use strict";


    console.log(
        "🚀 Mwaniki Scholars Community engine loading..."
    );


    /* =====================================================
       1. SUPABASE
       ===================================================== */

    const db = supabase;


    if (!db) {

        console.error(
            "❌ Supabase client was not created by supabase.js."
        );

        return;

    }


    /* =====================================================
       2. APPLICATION STATE
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

        currentCourse: null,

        currentRole: "student",

        currentReply: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        realtimeChannels: [],

        presenceTimer: null,

        initialized: false,

        loadingMessages: false,

        sendingMessage: false,

        drawerOverlayActive: false

    };


    /* =====================================================
       3. CONSTANTS
       ===================================================== */

    const STORAGE = {

        communityId:
            "mwanikiCommunityId",

        communityName:
            "communityCourseName",

        courseId:
            "communityCourseId",

        courseName:
            "communityCourseName"

    };


    const ROLE_ORDER = {

        super_admin: 5,

        admin: 4,

        moderator: 3,

        tutor: 2,

        student: 1

    };


    /* =====================================================
       4. DOM HELPERS
       ===================================================== */

    function byId(id) {

        return document.getElementById(id);

    }


    function query(selector, parent = document) {

        return parent.querySelector(selector);

    }


    function queryAll(selector, parent = document) {

        return Array.from(
            parent.querySelectorAll(selector)
        );

    }


    function showElement(element) {

        if (!element) return;

        element.classList.remove("hidden");

    }


    function hideElement(element) {

        if (!element) return;

        element.classList.add("hidden");

    }


    function setText(id, value) {

        const element = byId(id);

        if (!element) return;

        element.textContent =
            value === null ||
            value === undefined
                ? ""
                : String(value);

    }


    /* =====================================================
       5. HTML SAFETY
       ===================================================== */

    function escapeHTML(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";

        }


        return String(value)
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

        const clean =
            String(name || "Student")
                .trim()
                .replace(/\s+/g, " ");

        if (!clean) return "MS";

        const parts =
            clean
                .split(" ")
                .filter(Boolean);

        if (parts.length === 1) {

            return parts[0]
                .slice(0, 2)
                .toUpperCase();

        }


        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();

    }


    function slugify(value) {

        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80);

    }


    /* =====================================================
       6. TOAST
       ===================================================== */

    let toastTimer = null;


    function toast(message, type = "normal") {

        const element =
            byId("communityToast");

        if (!element) {

            console.log(
                `[Community ${type}]`,
                message
            );

            return;

        }


        element.textContent =
            message || "";


        element.classList.add("show");
        element.classList.add("visible");
        element.classList.add("active");


        if (type === "error") {

            element.style.borderColor =
                "rgba(239,102,113,.35)";

        } else if (type === "success") {

            element.style.borderColor =
                "rgba(66,211,146,.30)";

        } else {

            element.style.borderColor = "";

        }


        clearTimeout(toastTimer);


        toastTimer = setTimeout(() => {

            element.classList.remove("show");
            element.classList.remove("visible");
            element.classList.remove("active");

        }, 3200);

    }


    /* =====================================================
       7. DATE / TIME
       ===================================================== */

    function formatMessageTime(value) {

        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {

            return "";

        }


        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);

    }


    function formatMessageDate(value) {

        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {

            return "";

        }


        const now = new Date();


        const sameDay =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();


        if (sameDay) {

            return formatMessageTime(value);

        }


        return new Intl.DateTimeFormat(
            undefined,
            {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);

    }


    /* =====================================================
       8. STORAGE
       ===================================================== */

    function storageGet(key) {

        try {

            return localStorage.getItem(key);

        } catch (error) {

            console.warn(
                "⚠️ localStorage read failed:",
                error
            );

            return null;

        }

    }


    function storageSet(key, value) {

        try {

            localStorage.setItem(
                key,
                String(value)
            );

        } catch (error) {

            console.warn(
                "⚠️ localStorage write failed:",
                error
            );

        }

    }


    function storageRemove(key) {

        try {

            localStorage.removeItem(key);

        } catch (error) {

            console.warn(
                "⚠️ localStorage remove failed:",
                error
            );

        }

    }


    /* =====================================================
       9. URL COURSE CONTEXT
       ===================================================== */

    function getURLCourseId() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const raw =
            params.get("course_id");


        if (!raw) return null;


        const id =
            Number(raw);


        return Number.isFinite(id)
            ? id
            : null;

    }


    function getStoredCourseId() {

        const value =
            storageGet(
                STORAGE.courseId
            );


        if (!value) return null;


        const id =
            Number(value);


        return Number.isFinite(id)
            ? id
            : null;

    }


    /* =====================================================
       10. AUTHENTICATION
       ===================================================== */

    async function loadAuthenticatedUser() {

        const {
            data,
            error
        } = await db.auth.getUser();


        if (error) {

            console.error(
                "❌ Unable to get authenticated user:",
                error
            );

            return null;

        }


        return data?.user || null;

    }


    async function requireAuthentication() {

        state.user =
            await loadAuthenticatedUser();


        if (state.user) {

            return true;

        }


        console.warn(
            "⚠️ No authenticated user. Redirecting..."
        );


        window.location.href =
            "./index.html";


        return false;

    }


    function setupAuthListener() {

        const {
            data
        } =
            db.auth.onAuthStateChange(
                async (event, session) => {

                    console.log(
                        "🔐 Community auth state:",
                        event
                    );


                    if (
                        event === "SIGNED_OUT"
                    ) {

                        cleanupRealtime();

                        if (
                            !window.location.pathname.endsWith(
                                "index.html"
                            )
                        ) {

                            window.location.href =
                                "./index.html";

                        }

                        return;

                    }


                    if (
                        session?.user &&
                        !state.user
                    ) {

                        state.user =
                            session.user;

                    }

                }
            );


        return data?.subscription || null;

    }


    /* =====================================================
       11. STUDENT PROFILE
       ===================================================== */

    async function loadStudentProfile() {

        if (!state.user?.id) {

            return null;

        }


        const {
            data,
            error
        } =
            await db
                .from("students")
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Student profile could not be loaded:",
                error
            );

            return null;

        }


        state.profile =
            data || null;


        return state.profile;

    }


    function getCurrentDisplayName() {

        const profile =
            state.profile || {};


        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            state.user?.user_metadata?.full_name ||
            state.user?.user_metadata?.name ||
            state.user?.email?.split("@")[0] ||
            "Student"
        );

    }


    /* =====================================================
       12. COURSES
       ===================================================== */

    async function loadCourses() {

        const {
            data,
            error
        } =
            await db
                .from("courses")
                .select(
                    "id,title,description,image,created_at"
                )
                .order(
                    "title",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Course loading failed:",
                error
            );

            state.courses = [];

            return [];

        }


        state.courses =
            Array.isArray(data)
                ? data
                : [];


        populateCourseSelects();


        return state.courses;

    }


    function populateCourseSelects() {

        const selects = [

            byId(
                "communityCourseSelect"
            ),

            byId(
                "channelCourseSelect"
            )

        ];


        selects.forEach(select => {

            if (!select) return;


            const currentValue =
                select.value;


            const firstOption =
                select.options[0];


            select.innerHTML = "";


            if (firstOption) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    firstOption.value;

                option.textContent =
                    firstOption.textContent;

                select.appendChild(
                    option
                );

            }


            state.courses.forEach(course => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    String(course.id);


                option.textContent =
                    course.title ||
                    `Course ${course.id}`;


                select.appendChild(
                    option
                );

            });


            if (
                currentValue &&
                Array.from(select.options)
                    .some(
                        option =>
                            option.value ===
                            currentValue
                    )
            ) {

                select.value =
                    currentValue;

            }

        });

    }


    function findCourseById(courseId) {

        if (
            courseId === null ||
            courseId === undefined
        ) {

            return null;

        }


        const id =
            Number(courseId);


        return (
            state.courses.find(
                course =>
                    Number(course.id) === id
            ) ||
            null
        );

    }


    /* =====================================================
       13. COMMUNITY LOADING
       ===================================================== */

    async function loadCommunities() {

        const {
            data,
            error
        } =
            await db
                .from("chat_communities")
                .select(
                    `
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
                    `
                )
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

            console.error(
                "❌ Community loading failed:",
                error
            );

            state.communities = [];

            renderCommunityRail();

            return [];

        }


        state.communities =
            Array.isArray(data)
                ? data
                : [];


        renderCommunityRail();


        return state.communities;

    }


    /* =====================================================
       14. COMMUNITY RAIL
       ===================================================== */

    function renderCommunityRail() {

        const rail =
            byId("communityRail");


        if (!rail) return;


        if (!state.communities.length) {

            rail.innerHTML = `
                <div class="channel-loading">
                    No communities
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
                                community.id
                            ) ===
                            String(
                                state.currentCommunity.id
                            );


                        const icon =
                            community.icon_url ||
                            initials(
                                community.name
                            );


                        return `
                            <button
                                type="button"
                                class="${active ? "active" : ""}"
                                data-community-id="${escapeAttribute(community.id)}"
                                title="${escapeAttribute(community.name)}"
                                aria-label="${escapeAttribute(community.name)}"
                            >
                                ${
                                    escapeHTML(
                                        icon
                                    )
                                }
                            </button>
                        `;

                    }
                )
                .join("");

    }


    async function handleCommunityRailClick(event) {

        const button =
            event.target.closest(
                "[data-community-id]"
            );


        if (!button) return;


        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(
                        button.dataset.communityId
                    )
            );


        if (!community) return;


        await selectCommunity(
            community
        );

    }


    /* =====================================================
       15. COMMUNITY MEMBERSHIP
       ===================================================== */

    async function ensureCommunityMembership(
        communityId
    ) {

        if (
            !communityId ||
            !state.user?.id
        ) {

            return null;

        }


        const {
            data: existing,
            error: existingError
        } =
            await db
                .from(
                    "chat_community_members"
                )
                .select(
                    `
                    id,
                    community_id,
                    user_id,
                    role,
                    nickname,
                    is_muted,
                    is_banned,
                    joined_at,
                    last_seen_at
                    `
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
            existingError &&
            existingError.code !== "PGRST116"
        ) {

            console.warn(
                "⚠️ Membership lookup failed:",
                existingError
            );

        }


        if (existing) {

            if (existing.is_banned) {

                toast(
                    "You are not allowed to access this community.",
                    "error"
                );

                return null;

            }


            return existing;

        }


        const {
            data: created,
            error: createError
        } =
            await db
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
                })
                .select()
                .single();


        if (createError) {

            console.error(
                "❌ Unable to join community:",
                createError
            );

            return null;

        }


        return created;

    }


    /* =====================================================
       16. COMMUNITY ROLE
       ===================================================== */

    async function loadCommunityRole(
        communityId
    ) {

        if (
            !communityId ||
            !state.user?.id
        ) {

            state.currentRole =
                "student";

            return "student";

        }


        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_community_members"
                )
                .select(
                    "role,is_muted,is_banned"
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


        if (error) {

            console.warn(
                "⚠️ Community role lookup failed:",
                error
            );

            state.currentRole =
                "student";

            updateRoleBadge();

            return "student";

        }


        state.currentRole =
            data?.role ||
            "student";


        updateRoleBadge();


        return state.currentRole;

    }


    function updateRoleBadge() {

        const badge =
            byId("activeRoleBadge");


        if (!badge) return;


        const role =
            state.currentRole ||
            "student";


        const label =
            role
                .replace(/_/g, " ")
                .replace(
                    /\b\w/g,
                    letter =>
                        letter.toUpperCase()
                );


        badge.textContent =
            label;

    }


    function hasPermission(
        minimumRole = "student"
    ) {

        const current =
            ROLE_ORDER[
                state.currentRole
            ] ||
            1;


        const required =
            ROLE_ORDER[
                minimumRole
            ] ||
            1;


        return current >= required;

    }


    /* =====================================================
       17. SELECT COMMUNITY
       ===================================================== */

    async function selectCommunity(
        community
    ) {

        if (!community) return;


        state.currentCommunity =
            community;


        state.currentChannel =
            null;

        state.currentCourse =
            null;


        renderCommunityRail();


        setText(
            "activeCommunityName",
            community.name ||
            "Mwaniki Community"
        );


        setText(
            "activeCommunityDescription",
            community.description ||
            "Medical learning community"
        );


        const icon =
            byId(
                "activeCommunityIcon"
            );


        if (icon) {

            icon.textContent =
                community.icon_url ||
                initials(
                    community.name
                );

        }


        storageSet(
            STORAGE.communityId,
            community.id
        );


        storageSet(
            STORAGE.communityName,
            community.name || ""
        );


        const membership =
            await ensureCommunityMembership(
                community.id
            );


        if (!membership) {

            return;

        }


        await loadCommunityRole(
            community.id
        );


        updateCourseContext(
            getURLCourseId() ||
            getStoredCourseId()
        );


        await loadChannels();


        closeChannelDrawer();

    }


    /* =====================================================
       18. COURSE CONTEXT
       ===================================================== */

    function updateCourseContext(
        courseId
    ) {

        const banner =
            byId(
                "communityCourseBanner"
            );


        const course =
            findCourseById(
                courseId
            );


        state.currentCourse =
            course || null;


        if (!course) {

            setText(
                "communityCourseName",
                "General Community"
            );


            setText(
                "communityCourseLabel",
                "Community"
            );


            if (banner) {

                banner.classList.remove(
                    "course-active"
                );

            }


            return;

        }


        setText(
            "communityCourseName",
            course.title ||
            `Course ${course.id}`
        );


        setText(
            "communityCourseLabel",
            `Course ID ${course.id}`
        );


        if (banner) {

            banner.classList.add(
                "course-active"
            );

        }


        storageSet(
            STORAGE.courseId,
            course.id
        );


        storageSet(
            STORAGE.courseName,
            course.title || ""
        );

    }


    /* =====================================================
       19. CHANNEL LOADING
       ===================================================== */

    async function loadChannels() {

        if (!state.currentCommunity?.id) {

            state.channels = [];

            renderChannels();

            return [];

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_channels")
                .select(
                    `
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
                    `
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
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Channel loading failed:",
                error
            );

            state.channels = [];

            renderChannels();

            return [];

        }


        let channels =
            Array.isArray(data)
                ? data
                : [];


        /* -----------------------------------------------
           Filter private channels
           ----------------------------------------------- */

        const privateChannels =
            channels.filter(
                channel =>
                    channel.is_private
            );


        const publicChannels =
            channels.filter(
                channel =>
                    !channel.is_private
            );


        let allowedPrivateIds =
            new Set();


        if (
            privateChannels.length &&
            state.user?.id
        ) {

            const {
                data: memberships,
                error:
                    membershipError
            } =
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
                    )
                    .in(
                        "channel_id",
                        privateChannels.map(
                            channel =>
                                channel.id
                        )
                    );


            if (
                membershipError
            ) {

                console.warn(
                    "⚠️ Private channel membership lookup failed:",
                    membershipError
                );

            } else {

                allowedPrivateIds =
                    new Set(
                        (
                            memberships ||
                            []
                        ).map(
                            item =>
                                item.channel_id
                        )
                    );

            }

        }


        state.channels =
            [
                ...publicChannels,
                ...privateChannels.filter(
                    channel =>
                        allowedPrivateIds.has(
                            channel.id
                        )
                )
            ].sort(
                (a, b) =>
                    (
                        Number(
                            a.position
                        ) || 0
                    ) -
                    (
                        Number(
                            b.position
                        ) || 0
                    )
            );


        renderChannels();


        selectBestInitialChannel();


        return state.channels;

    }


    /* =====================================================
       20. CHANNEL CATEGORY
       ===================================================== */

    function getChannelCategory(
        channel
    ) {

        if (
            channel.course_id !== null &&
            channel.course_id !== undefined
        ) {

            return "Course Discussions";

        }


        switch (
            channel.channel_type
        ) {

            case "announcement":
                return "Information";

            case "study":
                return "Study";

            case "voice":
                return "Voice";

            case "course":
                return "Course Discussions";

            default:
                return "Community";

        }

    }


    /* =====================================================
       21. CHANNEL RENDERING
       ===================================================== */

    function renderChannels() {

        const list =
            byId("channelList");


        if (!list) return;


        if (!state.channels.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No channels are available.
                </div>
            `;

            return;

        }


        const search =
            state.channelSearch
                .trim()
                .toLowerCase();


        const filtered =
            search
                ? state.channels.filter(
                    channel => {

                        const haystack =
                            [
                                channel.name,
                                channel.description,
                                getChannelCategory(
                                    channel
                                )
                            ]
                                .filter(Boolean)
                                .join(" ")
                                .toLowerCase();


                        return haystack.includes(
                            search
                        );

                    }
                )
                : state.channels;


        if (!filtered.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No matching channels.
                </div>
            `;

            return;

        }


        const groups =
            new Map();


        filtered.forEach(channel => {

            const category =
                getChannelCategory(
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

        });


        let html = "";


        groups.forEach(
            (
                channels,
                category
            ) => {

                html += `
                    <div class="channel-category">
                        ${escapeHTML(category)}
                    </div>
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


                        const icon =
                            channel.icon ||
                            (
                                channel.channel_type ===
                                "voice"
                                    ? "🔊"
                                    : "#"
                            );


                        html += `
                            <button
                                type="button"
                                class="channel-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-channel-id="${escapeAttribute(channel.id)}"
                                title="${escapeAttribute(channel.description || channel.name || "")}"
                            >

                                <span class="channel-icon">
                                    ${escapeHTML(icon)}
                                </span>

                                <span class="channel-name">
                                    ${escapeHTML(
                                        channel.name
                                    )}
                                </span>

                            </button>
                        `;

                    }
                );

            }
        );


        list.innerHTML =
            html;

    }


    /* =====================================================
       22. INITIAL CHANNEL
       ===================================================== */

    function selectBestInitialChannel() {

        if (!state.channels.length) {

            renderMessages();

            return;

        }


        if (state.currentChannel) {

            const stillExists =
                state.channels.some(
                    channel =>
                        String(
                            channel.id
                        ) ===
                        String(
                            state.currentChannel.id
                        )
                );


            if (stillExists) {

                renderChannels();

                return;

            }

        }


        const courseId =
            getURLCourseId() ||
            getStoredCourseId();


        let preferred = null;


        if (courseId !== null) {

            preferred =
                state.channels.find(
                    channel =>
                        Number(
                            channel.course_id
                        ) ===
                        Number(
                            courseId
                        )
                ) ||
                null;

        }


        if (!preferred) {

            preferred =
                state.channels.find(
                    channel =>
                        channel.slug ===
                        "general"
                ) ||
                state.channels.find(
                    channel =>
                        channel.name
                            ?.toLowerCase() ===
                        "general"
                ) ||
                state.channels[0];

        }


        if (preferred) {

            selectChannel(
                preferred
            );

        }

    }


    /* =====================================================
       23. SELECT CHANNEL
       ===================================================== */

    async function selectChannel(
        channel
    ) {

        if (!channel) return;


        state.currentChannel =
            channel;


        renderChannels();


        setText(
            "activeChannelName",
            channel.name ||
            "channel"
        );


        setText(
            "activeChannelDescription",
            channel.description ||
            "Community discussion"
        );


        const titleInput =
            byId("messageInput");


        if (titleInput) {

            titleInput.placeholder =
                `Message #${channel.name || "channel"}`;

        }


        updateCourseContext(
            channel.course_id
        );


        closeChannelDrawer();


        await loadMessages(
            channel.id
        );


        await markChannelRead(
            channel.id
        );


        subscribeToMessageChannel(
            channel.id
        );

    }


    /* =====================================================
       24. MESSAGE LOADING
       ===================================================== */

    async function loadMessages(
        channelId
    ) {

        if (!channelId) {

            state.messages = [];

            renderMessages();

            return [];

        }


        state.loadingMessages =
            true;


        renderMessagesLoading();


        const {
            data,
            error
        } =
            await db
                .from("chat_messages")
                .select(
                    `
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
                    updated_at
                    `
                )
                .eq(
                    "channel_id",
                    channelId
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )
                .limit(500);


        state.loadingMessages =
            false;


        if (error) {

            console.error(
                "❌ Message loading failed:",
                error
            );

            state.messages = [];

            renderMessagesError(
                "Unable to load messages."
            );

            return [];

        }


        state.messages =
            Array.isArray(data)
                ? data
                : [];


        await enrichMessages();


        renderMessages();


        scrollMessagesToBottom();


        return state.messages;

    }


    /* =====================================================
       25. MESSAGE PROFILE ENRICHMENT
       ===================================================== */

    async function enrichMessages() {

        const userIds =
            [
                ...new Set(
                    state.messages
                        .map(
                            message =>
                                message.user_id
                        )
                        .filter(Boolean)
                )
            ];


        if (!userIds.length) {

            return;

        }


        const profileMap =
            new Map();


        /* -----------------------------------------------
           Try students first
           ----------------------------------------------- */

        const {
            data: students,
            error: studentsError
        } =
            await db
                .from("students")
                .select("*")
                .in(
                    "id",
                    userIds
                );


        if (!studentsError) {

            (
                students ||
                []
            ).forEach(student => {

                profileMap.set(
                    String(student.id),
                    student
                );

            });

        }


        /* -----------------------------------------------
           Store profile information on each message
           ----------------------------------------------- */

        state.messages =
            state.messages.map(
                message => {

                    const profile =
                        profileMap.get(
                            String(
                                message.user_id
                            )
                        ) ||
                        null;


                    return {
                        ...message,
                        profile
                    };

                }
            );

    }


    /* =====================================================
       26. MESSAGE LOADING UI
       ===================================================== */

    function renderMessagesLoading() {

        const list =
            byId("messageList");


        if (!list) return;


        list.innerHTML = `
            <div class="empty-state">
                Loading messages...
            </div>
        `;

    }


    function renderMessagesError(
        message
    ) {

        const list =
            byId("messageList");


        if (!list) return;


        list.innerHTML = `
            <div class="empty-state">
                ${escapeHTML(message)}
            </div>
        `;

    }


    /* =====================================================
       27. MESSAGE RENDERING
       ===================================================== */

    function renderMessages() {

        const list =
            byId("messageList");


        if (!list) return;


        if (
            state.loadingMessages
        ) {

            return;

        }


        if (
            !state.currentChannel
        ) {

            list.innerHTML = `
                <div class="welcome-message">

                    <div class="welcome-icon">
                        #
                    </div>

                    <h2>
                        Select a channel
                    </h2>

                    <p>
                        Choose a community channel
                        to begin learning and
                        collaborating.
                    </p>

                </div>
            `;

            return;

        }


        let messages =
            state.messages;


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
                            .includes(
                                search
                            )
                );

        }


        if (!messages.length) {

            list.innerHTML = `
                <div class="welcome-message">

                    <div class="welcome-icon">
                        #
                    </div>

                    <h2>
                        ${
                            search
                                ? "No messages found"
                                : "Start the conversation"
                        }
                    </h2>

                    <p>
                        ${
                            search
                                ? "Try another search term."
                                : "Be the first to contribute to this channel."
                        }
                    </p>

                </div>
            `;

            return;

        }


        list.innerHTML =
            messages
                .map(
                    message =>
                        renderMessage(
                            message
                        )
                )
                .join("");


        attachMessageActionEvents();

    }


    /* =====================================================
       28. SINGLE MESSAGE
       ===================================================== */

    function renderMessage(
        message
    ) {

        const profile =
            message.profile ||
            {};


        const displayName =
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            (
                message.user_id ===
                state.user?.id
                    ? getCurrentDisplayName()
                    : "Mwaniki Scholar"
            );


        const avatar =
            profile.photo_url ||
            "";


        const messageId =
            escapeAttribute(
                message.id
            );


        const content =
            message.is_deleted
                ? `
                    <em>
                        This message was deleted.
                    </em>
                `
                : formatMessageContent(
                    message.content || ""
                );


        const pinned =
            message.is_pinned
                ? `
                    <span
                        class="message-pin"
                        title="Pinned message"
                    >
                        📌
                    </span>
                `
                : "";


        const edited =
            message.is_edited &&
            !message.is_deleted
                ? `
                    <span class="message-time">
                        edited
                    </span>
                `
                : "";


        const canDelete =
            !message.is_deleted &&
            (
                String(
                    message.user_id
                ) ===
                String(
                    state.user?.id
                ) ||
                hasPermission(
                    "moderator"
                )
            );


        const canPin =
            !message.is_deleted &&
            hasPermission(
                "moderator"
            );


        return `
            <article
                class="message-row ${
                    message.is_pinned
                        ? "pinned"
                        : ""
                }"
                data-message-id="${messageId}"
            >

                ${
                    avatar
                        ? `
                            <img
                                class="message-avatar"
                                src="${escapeAttribute(avatar)}"
                                alt=""
                            >
                        `
                        : `
                            <div class="message-avatar">
                                ${escapeHTML(
                                    initials(
                                        displayName
                                    )
                                )}
                            </div>
                        `
                }


                <div class="message-content">

                    <div class="message-meta">

                        <span class="message-author">
                            ${escapeHTML(
                                displayName
                            )}
                        </span>

                        ${pinned}

                        <span class="message-time">
                            ${escapeHTML(
                                formatMessageDate(
                                    message.created_at
                                )
                            )}
                        </span>

                        ${edited}

                    </div>


                    <div class="message-body">

                        ${content}

                    </div>

                </div>


                <div
                    class="message-actions"
                    data-message-actions
                >

                    <button
                        type="button"
                        data-message-action="reply"
                        data-message-id="${messageId}"
                        title="Reply"
                    >
                        ↩
                    </button>


                    ${
                        canPin
                            ? `
                                <button
                                    type="button"
                                    data-message-action="pin"
                                    data-message-id="${messageId}"
                                    title="${
                                        message.is_pinned
                                            ? "Unpin"
                                            : "Pin"
                                    }"
                                >
                                    📌
                                </button>
                            `
                            : ""
                    }


                    ${
                        canDelete
                            ? `
                                <button
                                    type="button"
                                    data-message-action="delete"
                                    data-message-id="${messageId}"
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


    /* =====================================================
       29. MESSAGE CONTENT
       ===================================================== */

    function formatMessageContent(
        content
    ) {

        const safe =
            escapeHTML(
                content
            );


        return safe
            .replace(
                /\n/g,
                "<br>"
            )
            .replace(
                /(^|[\s])@([a-zA-Z0-9._-]+)/g,
                "$1<span class=\"mention\">@$2</span>"
            );

    }


    /* =====================================================
       30. MESSAGE ACTION EVENTS
       ===================================================== */

    function attachMessageActionEvents() {

        queryAll(
            "[data-message-action]"
        ).forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();


                    const action =
                        button.dataset.messageAction;


                    const messageId =
                        button.dataset.messageId;


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


                    if (!message) return;


                    if (
                        action ===
                        "reply"
                    ) {

                        startReply(
                            message
                        );

                        return;

                    }


                    if (
                        action ===
                        "delete"
                    ) {

                        await deleteMessage(
                            message
                        );

                        return;

                    }


                    if (
                        action ===
                        "pin"
                    ) {

                        await togglePin(
                            message
                        );

                    }

                }
            );

        });

    }


    /* =====================================================
       31. REPLY
       ===================================================== */

    function startReply(
        message
    ) {

        state.currentReply =
            message;


        const preview =
            byId(
                "replyPreview"
            );


        const previewText =
            byId(
                "replyPreviewText"
            );


        if (preview) {

            preview.classList.remove(
                "hidden"
            );

        }


        if (previewText) {

            const text =
                String(
                    message.content ||
                    ""
                );


            previewText.textContent =
                text.length > 120
                    ? `${text.slice(0, 120)}…`
                    : text;

        }


        const input =
            byId(
                "messageInput"
            );


        if (input) {

            input.focus();

        }

    }


    function cancelReply() {

        state.currentReply =
            null;


        hideElement(
            byId(
                "replyPreview"
            )
        );

    }


    /* =====================================================
       32. SEND MESSAGE
       ===================================================== */

    async function sendMessage() {

        if (
            state.sendingMessage
        ) {

            return;

        }


        if (
            !state.user?.id
        ) {

            toast(
                "You must be signed in to send messages.",
                "error"
            );

            return;

        }


        if (
            !state.currentChannel?.id
        ) {

            toast(
                "Please select a channel first.",
                "error"
            );

            return;

        }


        const input =
            byId(
                "messageInput"
            );


        if (!input) return;


        const content =
            String(
                input.value || ""
            ).trim();


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


        state.sendingMessage =
            true;


        const sendButton =
            byId(
                "sendMessageButton"
            );


        if (sendButton) {

            sendButton.disabled =
                true;

            sendButton.style.opacity =
                "0.6";

        }


        const payload = {

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            parent_message_id:
                state.currentReply?.id ||
                null,

            content,

            message_type:
                "text"

        };


        const {
            data,
            error
        } =
            await db
                .from("chat_messages")
                .insert(
                    payload
                )
                .select()
                .single();


        state.sendingMessage =
            false;


        if (sendButton) {

            sendButton.disabled =
                false;

            sendButton.style.opacity =
                "";

        }


        if (error) {

            console.error(
                "❌ Message send failed:",
                error
            );


            toast(
                error.message ||
                "Unable to send message.",
                "error"
            );

            return;

        }


        input.value =
            "";


        resetTextareaHeight();


        cancelReply();


        if (data) {

            const exists =
                state.messages.some(
                    message =>
                        String(
                            message.id
                        ) ===
                        String(
                            data.id
                        )
                );


            if (!exists) {

                state.messages.push(
                    data
                );

            }


            await enrichMessages();


            renderMessages();


            scrollMessagesToBottom();

        }

    }


    /* =====================================================
       33. DELETE MESSAGE
       ===================================================== */

    async function deleteMessage(
        message
    ) {

        if (!message?.id) return;


        const allowed =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            ) ||
            hasPermission(
                "moderator"
            );


        if (!allowed) {

            toast(
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
            await db
                .from("chat_messages")
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
                    message.id
                );


        if (error) {

            console.error(
                "❌ Message deletion failed:",
                error
            );


            toast(
                "Unable to delete the message.",
                "error"
            );

            return;

        }


        const local =
            state.messages.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        message.id
                    )
            );


        if (local) {

            local.is_deleted =
                true;

            local.deleted_at =
                new Date().toISOString();

        }


        renderMessages();


        toast(
            "Message deleted.",
            "success"
        );

    }


    /* =====================================================
       34. PIN MESSAGE
       ===================================================== */

    async function togglePin(
        message
    ) {

        if (
            !hasPermission(
                "moderator"
            )
        ) {

            toast(
                "Only moderators and administrators can pin messages.",
                "error"
            );

            return;

        }


        const newValue =
            !Boolean(
                message.is_pinned
            );


        const {
            error
        } =
            await db
                .from("chat_messages")
                .update({

                    is_pinned:
                        newValue,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    message.id
                );


        if (error) {

            console.error(
                "❌ Pin update failed:",
                error
            );


            toast(
                "Unable to update pinned status.",
                "error"
            );

            return;

        }


        const local =
            state.messages.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        message.id
                    )
            );


        if (local) {

            local.is_pinned =
                newValue;

        }


        renderMessages();


        toast(
            newValue
                ? "Message pinned."
                : "Message unpinned.",
            "success"
        );

    }


    /* =====================================================
       35. SCROLL
       ===================================================== */

    function scrollMessagesToBottom() {

        const list =
            byId(
                "messageList"
            );


        if (!list) return;


        requestAnimationFrame(
            () => {

                list.scrollTop =
                    list.scrollHeight;

            }
        );

    }


    /* =====================================================
       36. READ STATUS
       ===================================================== */

    async function markChannelRead(
        channelId
    ) {

        if (
            !channelId ||
            !state.user?.id
        ) {

            return;

        }


        const lastMessage =
            state.messages[
                state.messages.length - 1
            ];


        const payload = {

            channel_id:
                channelId,

            user_id:
                state.user.id,

            last_read_message_id:
                lastMessage?.id ||
                null,

            last_read_at:
                new Date().toISOString()

        };


        const {
            data: existing,
            error: lookupError
        } =
            await db
                .from(
                    "chat_read_status"
                )
                .select(
                    "id"
                )
                .eq(
                    "channel_id",
                    channelId
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();


        if (
            lookupError &&
            lookupError.code !==
            "PGRST116"
        ) {

            console.warn(
                "⚠️ Read status lookup failed:",
                lookupError
            );

            return;

        }


        if (existing?.id) {

            const {
                error
            } =
                await db
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


            if (error) {

                console.warn(
                    "⚠️ Read status update failed:",
                    error
                );

            }


            return;

        }


        const {
            error
        } =
            await db
                .from(
                    "chat_read_status"
                )
                .insert(
                    payload
                );


        if (error) {

            console.warn(
                "⚠️ Read status insert failed:",
                error
            );

        }

    }


    /* =====================================================
       37. MEMBER LOADING
       ===================================================== */

    async function loadMembers() {

        if (
            !state.currentCommunity?.id
        ) {

            state.members = [];

            renderMembers();

            return [];

        }


        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_community_members"
                )
                .select(
                    `
                    id,
                    community_id,
                    user_id,
                    role,
                    nickname,
                    is_muted,
                    is_banned,
                    joined_at,
                    last_seen_at
                    `
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
                    "joined_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Member loading failed:",
                error
            );

            state.members = [];

            renderMembers();

            return [];

        }


        state.members =
            Array.isArray(data)
                ? data
                : [];


        await enrichMembers();


        renderMembers();


        return state.members;

    }


    /* =====================================================
       38. MEMBER PROFILE ENRICHMENT
       ===================================================== */

    async function enrichMembers() {

        const userIds =
            [
                ...new Set(
                    state.members
                        .map(
                            member =>
                                member.user_id
                        )
                        .filter(Boolean)
                )
            ];


        if (!userIds.length) {

            return;

        }


        const {
            data,
            error
        } =
            await db
                .from("students")
                .select("*")
                .in(
                    "id",
                    userIds
                );


        if (error) {

            console.warn(
                "⚠️ Member profile lookup failed:",
                error
            );

            return;

        }


        const map =
            new Map();


        (
            data ||
            []
        ).forEach(
            student => {

                map.set(
                    String(
                        student.id
                    ),
                    student
                );

            }
        );


        state.members =
            state.members.map(
                member => ({

                    ...member,

                    profile:
                        map.get(
                            String(
                                member.user_id
                            )
                        ) ||
                        null

                })
            );

    }


    /* =====================================================
       39. MEMBER RENDERING
       ===================================================== */

    function renderMembers() {

        const list =
            byId(
                "memberList"
            );


        if (!list) return;


        const count =
            byId(
                "memberCount"
            );


        if (count) {

            const total =
                state.members.length;


            count.textContent =
                `${total} ${
                    total === 1
                        ? "member"
                        : "members"
                }`;

        }


        const search =
            state.memberSearch
                .trim()
                .toLowerCase();


        let members =
            state.members;


        if (search) {

            members =
                members.filter(
                    member => {

                        const profile =
                            member.profile ||
                            {};


                        const name =
                            member.nickname ||
                            profile.full_name ||
                            profile.name ||
                            profile.student_name ||
                            "Student";


                        return String(
                            name
                        )
                            .toLowerCase()
                            .includes(
                                search
                            );

                    }
                );

        }


        if (!members.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No members found.
                </div>
            `;

            return;

        }


        list.innerHTML =
            members
                .sort(
                    sortMembers
                )
                .map(
                    member =>
                        renderMember(
                            member
                        )
                )
                .join("");

    }


    function sortMembers(
        a,
        b
    ) {

        const roleA =
            ROLE_ORDER[
                a.role
            ] || 1;


        const roleB =
            ROLE_ORDER[
                b.role
            ] || 1;


        if (
            roleA !== roleB
        ) {

            return roleB - roleA;

        }


        const nameA =
            getMemberName(
                a
            ).toLowerCase();


        const nameB =
            getMemberName(
                b
            ).toLowerCase();


        return nameA.localeCompare(
            nameB
        );

    }


    function getMemberName(
        member
    ) {

        const profile =
            member.profile ||
            {};


        return (
            member.nickname ||
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            (
                String(
                    member.user_id
                ) ===
                String(
                    state.user?.id
                )
                    ? getCurrentDisplayName()
                    : "Student"
            )
        );

    }


    function renderMember(
        member
    ) {

        const profile =
            member.profile ||
            {};


        const name =
            getMemberName(
                member
            );


        const photo =
            profile.photo_url ||
            "";


        const role =
            String(
                member.role ||
                "student"
            )
                .replace(
                    /_/g,
                    " "
                );


        const status =
            getPresenceStatus(
                member
            );


        return `
            <div
                class="member-item"
                data-member-id="${escapeAttribute(member.user_id)}"
            >

                ${
                    photo
                        ? `
                            <img
                                class="member-avatar"
                                src="${escapeAttribute(photo)}"
                                alt=""
                            >
                        `
                        : `
                            <div class="member-avatar">
                                ${escapeHTML(
                                    initials(
                                        name
                                    )
                                )}
                            </div>
                        `
                }


                <div class="member-info">

                    <div class="member-name">
                        ${escapeHTML(name)}
                    </div>

                    <div class="member-role">
                        ${escapeHTML(role)}
                    </div>

                </div>


                <span
                    class="presence-dot ${
                        status
                    }"
                    title="${escapeAttribute(status)}"
                ></span>

            </div>
        `;

    }


    function getPresenceStatus(
        member
    ) {

        if (
            String(
                member.user_id
            ) ===
            String(
                state.user?.id
            )
        ) {

            return "online";

        }


        if (
            !member.last_seen_at
        ) {

            return "offline";

        }


        const lastSeen =
            new Date(
                member.last_seen_at
            );


        if (
            Number.isNaN(
                lastSeen.getTime()
            )
        ) {

            return "offline";

        }


        const age =
            Date.now() -
            lastSeen.getTime();


        if (
            age <=
            2 * 60 * 1000
        ) {

            return "online";

        }


        if (
            age <=
            10 * 60 * 1000
        ) {

            return "away";

        }


        return "offline";

    }


    /* =====================================================
       40. PRESENCE
       ===================================================== */

    async function updatePresence() {

        if (!state.user?.id) {

            return;

        }


        const now =
            new Date().toISOString();


        const {
            error
        } =
            await db
                .from(
                    "chat_presence"
                )
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        status:
                            "online",

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
                "⚠️ Presence update failed:",
                error
            );

        }


        if (
            state.currentCommunity?.id
        ) {

            await db
                .from(
                    "chat_community_members"
                )
                .update({
                    last_seen_at:
                        now
                })
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        }

    }


    function startPresence() {

        clearInterval(
            state.presenceTimer
        );


        updatePresence();


        state.presenceTimer =
            setInterval(
                updatePresence,
                60 * 1000
            );

    }


    async function setOfflinePresence() {

        if (!state.user?.id) {

            return;

        }


        const now =
            new Date().toISOString();


        await db
            .from(
                "chat_presence"
            )
            .update({

                status:
                    "offline",

                last_seen_at:
                    now,

                updated_at:
                    now

            })
            .eq(
                "user_id",
                state.user.id
            );

    }


    /* =====================================================
       41. REALTIME
       ===================================================== */

    function cleanupRealtime() {

        state.realtimeChannels
            .forEach(
                channel => {

                    try {

                        db.removeChannel(
                            channel
                        );

                    } catch (error) {

                        console.warn(
                            "Realtime cleanup error:",
                            error
                        );

                    }

                }
            );


        state.realtimeChannels =
            [];

    }


    function subscribeToMessageChannel(
        channelId
    ) {

        if (!channelId) return;


        /*
         * Remove the previous message
         * realtime subscription.
         */

        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {

                    const name =
                        channel?.topic ||
                        "";


                    if (
                        name.includes(
                            "community-messages"
                        )
                    ) {

                        try {

                            db.removeChannel(
                                channel
                            );

                        } catch (_) {}

                        return false;

                    }


                    return true;

                }
            );


        const realtime =
            db
                .channel(
                    `community-messages-${channelId}-${Date.now()}`
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

                        console.log(
                            "📨 New community message:",
                            payload.new
                        );


                        const exists =
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload.new.id
                                    )
                            );


                        if (exists) {

                            return;

                        }


                        state.messages.push(
                            payload.new
                        );


                        await enrichMessages();


                        renderMessages();


                        scrollMessagesToBottom();


                        if (
                            state.currentChannel?.id ===
                            channelId
                        ) {

                            await markChannelRead(
                                channelId
                            );

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
                    async payload => {

                        const index =
                            state.messages.findIndex(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload.new.id
                                    )
                            );


                        if (index >= 0) {

                            state.messages[
                                index
                            ] = {
                                ...state.messages[
                                    index
                                ],
                                ...payload.new
                            };

                        } else {

                            state.messages.push(
                                payload.new
                            );

                        }


                        await enrichMessages();


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

                        state.messages =
                            state.messages.filter(
                                message =>
                                    String(
                                        message.id
                                    ) !==
                                    String(
                                        payload.old?.id
                                    )
                            );


                        renderMessages();

                    }
                )
                .subscribe(
                    status => {

                        console.log(
                            "📡 Message realtime status:",
                            status
                        );

                    }
                );


        state.realtimeChannels.push(
            realtime
        );

    }


    function subscribeToCommunityChanges() {

        if (
            !state.currentCommunity?.id
        ) {

            return;

        }


        const communityId =
            state.currentCommunity.id;


        const realtime =
            db
                .channel(
                    `community-data-${communityId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_channels",
                        filter:
                            `community_id=eq.${communityId}`
                    },
                    async () => {

                        await loadChannels();

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

                        await loadMembers();

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


        state.realtimeChannels.push(
            realtime
        );

    }


    /* =====================================================
       42. DRAWER MANAGEMENT
       ===================================================== */

    function getOverlay() {

        return byId(
            "communityDrawerOverlay"
        );

    }


    function openChannelDrawer() {

        const sidebar =
            byId(
                "channelSidebar"
            );


        if (!sidebar) return;


        sidebar.classList.add(
            "open"
        );


        activateDrawerOverlay();

    }


    function closeChannelDrawer() {

        const sidebar =
            byId(
                "channelSidebar"
            );


        if (!sidebar) return;


        sidebar.classList.remove(
            "open"
        );


        if (
            !isMemberDrawerOpen()
        ) {

            deactivateDrawerOverlay();

        }

    }


    function openMemberDrawer() {

        const sidebar =
            byId(
                "memberSidebar"
            );


        if (!sidebar) return;


        sidebar.classList.add(
            "open"
        );


        activateDrawerOverlay();


        loadMembers();

    }


    function closeMemberDrawer() {

        const sidebar =
            byId(
                "memberSidebar"
            );


        if (!sidebar) return;


        sidebar.classList.remove(
            "open"
        );


        if (
            !isChannelDrawerOpen()
        ) {

            deactivateDrawerOverlay();

        }

    }


    function isChannelDrawerOpen() {

        return Boolean(
            byId(
                "channelSidebar"
            )?.classList.contains(
                "open"
            )
        );

    }


    function isMemberDrawerOpen() {

        return Boolean(
            byId(
                "memberSidebar"
            )?.classList.contains(
                "open"
            ) ||
            byId(
                "memberSidebar"
            )?.classList.contains(
                "active"
            ) ||
            byId(
                "memberSidebar"
            )?.classList.contains(
                "is-open"
            )
        );

    }


    function activateDrawerOverlay() {

        const overlay =
            getOverlay();


        if (!overlay) return;


        overlay.classList.remove(
            "hidden"
        );


        state.drawerOverlayActive =
            true;

    }


    function deactivateDrawerOverlay() {

        const overlay =
            getOverlay();


        if (!overlay) return;


        overlay.classList.add(
            "hidden"
        );


        state.drawerOverlayActive =
            false;

    }


    function closeAllDrawers() {

        const channelSidebar =
            byId(
                "channelSidebar"
            );


        const memberSidebar =
            byId(
                "memberSidebar"
            );


        if (channelSidebar) {

            channelSidebar.classList.remove(
                "open"
            );

        }


        if (memberSidebar) {

            memberSidebar.classList.remove(
                "open",
                "active",
                "is-open"
            );

        }


        deactivateDrawerOverlay();

    }


    /* =====================================================
       43. SEARCH
       ===================================================== */

    function setupSearch() {

        const channelSearch =
            byId(
                "channelSearchInput"
            );


        if (channelSearch) {

            channelSearch.addEventListener(
                "input",
                () => {

                    state.channelSearch =
                        channelSearch.value;


                    renderChannels();

                }
            );

        }


        const memberSearch =
            byId(
                "memberSearchInput"
            );


        if (memberSearch) {

            memberSearch.addEventListener(
                "input",
                () => {

                    state.memberSearch =
                        memberSearch.value;


                    renderMembers();

                }
            );

        }


        const messageSearch =
            byId(
                "messageSearchInput"
            );


        if (messageSearch) {

            messageSearch.addEventListener(
                "input",
                () => {

                    state.messageSearch =
                        messageSearch.value;


                    renderMessages();

                }
            );

        }

    }


    /* =====================================================
       44. CHAT SEARCH PANEL
       ===================================================== */

    function openMessageSearch() {

        const panel =
            byId(
                "messageSearchPanel"
            );


        if (!panel) return;


        panel.classList.remove(
            "hidden"
        );


        const input =
            byId(
                "messageSearchInput"
            );


        if (input) {

            input.focus();

        }

    }


    function closeMessageSearch() {

        const panel =
            byId(
                "messageSearchPanel"
            );


        if (panel) {

            panel.classList.add(
                "hidden"
            );

        }


        const input =
            byId(
                "messageSearchInput"
            );


        if (input) {

            input.value = "";

        }


        state.messageSearch =
            "";


        renderMessages();

    }


    /* =====================================================
       45. TEXTAREA
       ===================================================== */

    function resetTextareaHeight() {

        const input =
            byId(
                "messageInput"
            );


        if (!input) return;


        input.style.height =
            "auto";


        input.style.height =
            `${Math.min(
                input.scrollHeight,
                160
            )}px`;

    }


    function setupTextarea() {

        const input =
            byId(
                "messageInput"
            );


        if (!input) return;


        input.addEventListener(
            "input",
            resetTextareaHeight
        );


        input.addEventListener(
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

    }


    /* =====================================================
       46. MODALS
       ===================================================== */

    function openModal(
        id
    ) {

        const modal =
            byId(id);


        if (!modal) return;


        modal.classList.remove(
            "hidden"
        );

    }


    function closeModal(
        id
    ) {

        const modal =
            byId(id);


        if (!modal) return;


        modal.classList.add(
            "hidden"
        );

    }


    function openCommunityModal() {

        if (
            !hasPermission(
                "moderator"
            )
        ) {

            /*
             * Students can remain members
             * without being allowed to create
             * communities.
             */

            toast(
                "You do not have permission to create communities.",
                "error"
            );

            return;

        }


        const form =
            byId(
                "communityForm"
            );


        if (form) {

            form.reset();

        }


        setFormMessage(
            "communityFormMessage",
            ""
        );


        openModal(
            "communityModal"
        );

    }


    function openChannelModal() {

        if (
            !hasPermission(
                "moderator"
            )
        ) {

            toast(
                "You do not have permission to create channels.",
                "error"
            );

            return;

        }


        if (
            !state.currentCommunity
        ) {

            toast(
                "Select a community first.",
                "error"
            );

            return;

        }


        const form =
            byId(
                "channelForm"
            );


        if (form) {

            form.reset();

        }


        setFormMessage(
            "channelFormMessage",
            ""
        );


        openModal(
            "channelModal"
        );

    }


    function setFormMessage(
        id,
        message,
        type = ""
    ) {

        const element =
            byId(id);


        if (!element) return;


        element.textContent =
            message || "";


        element.classList.remove(
            "error",
            "success"
        );


        if (type) {

            element.classList.add(
                type
            );

        }

    }


    /* =====================================================
       47. CREATE COMMUNITY
       ===================================================== */

    async function createCommunity(
        event
    ) {

        event.preventDefault();


        if (
            !hasPermission(
                "moderator"
            )
        ) {

            setFormMessage(
                "communityFormMessage",
                "You do not have permission to create communities.",
                "error"
            );

            return;

        }


        if (
            !state.user?.id
        ) {

            return;

        }


        const name =
            byId(
                "communityNameInput"
            )?.value
                .trim();


        const description =
            byId(
                "communityDescriptionInput"
            )?.value
                .trim() ||
            null;


        const courseIdRaw =
            byId(
                "communityCourseSelect"
            )?.value;


        const courseId =
            courseIdRaw
                ? Number(courseIdRaw)
                : null;


        const icon =
            byId(
                "communityIconInput"
            )?.value
                .trim() ||
            "📚";


        if (!name) {

            setFormMessage(
                "communityFormMessage",
                "Enter a community name.",
                "error"
            );

            return;

        }


        const slug =
            await createUniqueCommunitySlug(
                name
            );


        const payload = {

            name,

            slug,

            description,

            icon_url:
                icon,

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
            await db
                .from(
                    "chat_communities"
                )
                .insert(
                    payload
                )
                .select()
                .single();


        if (error) {

            console.error(
                "❌ Community creation failed:",
                error
            );


            setFormMessage(
                "communityFormMessage",
                error.message ||
                "Unable to create community.",
                "error"
            );

            return;

        }


        /*
         * Create an optional course channel.
         */

        if (
            courseId !== null
        ) {

            const course =
                findCourseById(
                    courseId
                );


            if (course) {

                await createCourseChannelForCommunity(
                    data.id,
                    course
                );

            }

        }


        await loadCommunities();


        const createdCommunity =
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(
                        data.id
                    )
            );


        if (
            createdCommunity
        ) {

            await selectCommunity(
                createdCommunity
            );

        }


        closeModal(
            "communityModal"
        );


        toast(
            "Community created successfully.",
            "success"
        );

    }


    async function createUniqueCommunitySlug(
        name
    ) {

        const base =
            slugify(name) ||
            "community";


        let slug =
            base;


        const {
            data
        } =
            await db
                .from(
                    "chat_communities"
                )
                .select(
                    "slug"
                )
                .ilike(
                    "slug",
                    `${base}%`
                );


        const existing =
            new Set(
                (
                    data ||
                    []
                ).map(
                    item =>
                        item.slug
                )
            );


        let counter = 2;


        while (
            existing.has(slug)
        ) {

            slug =
                `${base}-${counter}`;

            counter++;

        }


        return slug;

    }


    /* =====================================================
       48. CREATE COURSE CHANNEL
       ===================================================== */

    async function createCourseChannelForCommunity(
        communityId,
        course
    ) {

        if (
            !communityId ||
            !course
        ) {

            return null;

        }


        const name =
            course.title ||
            `Course ${course.id}`;


        const slug =
            `course-${course.id}`;


        const {
            data: existing
        } =
            await db
                .from(
                    "chat_channels"
                )
                .select(
                    "id"
                )
                .eq(
                    "community_id",
                    communityId
                )
                .eq(
                    "course_id",
                    course.id
                )
                .maybeSingle();


        if (existing) {

            return existing;

        }


        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_channels"
                )
                .insert({

                    community_id:
                        communityId,

                    name,

                    slug,

                    description:
                        `Discussion space for ${name}.`,

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

                    unit_id:
                        null,

                    created_by:
                        state.user?.id ||
                        null

                })
                .select()
                .single();


        if (error) {

            console.error(
                "❌ Course channel creation failed:",
                error
            );

            return null;

        }


        return data;

    }


    /* =====================================================
       49. CREATE CHANNEL
       ===================================================== */

    async function createChannel(
        event
    ) {

        event.preventDefault();


        if (
            !hasPermission(
                "moderator"
            )
        ) {

            setFormMessage(
                "channelFormMessage",
                "You do not have permission to create channels.",
                "error"
            );

            return;

        }


        if (
            !state.currentCommunity
        ) {

            setFormMessage(
                "channelFormMessage",
                "Select a community first.",
                "error"
            );

            return;

        }


        const name =
            byId(
                "channelNameInput"
            )?.value
                .trim();


        const description =
            byId(
                "channelDescriptionInput"
            )?.value
                .trim() ||
            null;


        const category =
            byId(
                "channelCategoryInput"
            )?.value
                .trim();


        const visibility =
            byId(
                "channelVisibilitySelect"
            )?.value ||
            "public";


        const courseRaw =
            byId(
                "channelCourseSelect"
            )?.value;


        const courseId =
            courseRaw
                ? Number(courseRaw)
                : null;


        if (!name) {

            setFormMessage(
                "channelFormMessage",
                "Enter a channel name.",
                "error"
            );

            return;

        }


        /*
         * The database does NOT have a category
         * column on chat_channels.
         *
         * We therefore preserve category as
         * part of the description rather than
         * sending an invalid column.
         */

        let finalDescription =
            description;


        if (
            category &&
            description
        ) {

            finalDescription =
                `[${category}] ${description}`;

        } else if (
            category
        ) {

            finalDescription =
                `[${category}]`;

        }


        const slug =
            await createUniqueChannelSlug(
                state.currentCommunity.id,
                name
            );


        const payload = {

            community_id:
                state.currentCommunity.id,

            name,

            slug,

            description:
                finalDescription,

            channel_type:
                courseId !== null
                    ? "course"
                    : "text",

            icon:
                courseId !== null
                    ? "🎓"
                    : "#",

            position:
                getNextChannelPosition(),

            is_private:
                visibility ===
                "private",

            is_archived:
                false,

            is_active:
                true,

            course_id:
                courseId,

            unit_id:
                null,

            created_by:
                state.user?.id ||
                null

        };


        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_channels"
                )
                .insert(
                    payload
                )
                .select()
                .single();


        if (error) {

            console.error(
                "❌ Channel creation failed:",
                error
            );


            setFormMessage(
                "channelFormMessage",
                error.message ||
                "Unable to create channel.",
                "error"
            );

            return;

        }


        /*
         * If private, add creator as a member.
         */

        if (
            data?.is_private &&
            state.user?.id
        ) {

            const {
                error:
                    memberError
            } =
                await db
                    .from(
                        "chat_channel_members"
                    )
                    .insert({

                        channel_id:
                            data.id,

                        user_id:
                            state.user.id

                    });


            if (memberError) {

                console.warn(
                    "⚠️ Creator could not be added to private channel:",
                    memberError
                );

            }

        }


        await loadChannels();


        const created =
            state.channels.find(
                channel =>
                    String(
                        channel.id
                    ) ===
                    String(
                        data.id
                    )
            );


        if (created) {

            await selectChannel(
                created
            );

        }


        closeModal(
            "channelModal"
        );


        toast(
            "Channel created successfully.",
            "success"
        );

    }


    async function createUniqueChannelSlug(
        communityId,
        name
    ) {

        const base =
            slugify(name) ||
            "channel";


        const {
            data
        } =
            await db
                .from(
                    "chat_channels"
                )
                .select(
                    "slug"
                )
                .eq(
                    "community_id",
                    communityId
                )
                .ilike(
                    "slug",
                    `${base}%`
                );


        const existing =
            new Set(
                (
                    data ||
                    []
                ).map(
                    item =>
                        item.slug
                )
            );


        let slug =
            base;


        let counter =
            2;


        while (
            existing.has(slug)
        ) {

            slug =
                `${base}-${counter}`;

            counter++;

        }


        return slug;

    }


    function getNextChannelPosition() {

        if (
            !state.channels.length
        ) {

            return 0;

        }


        return (
            Math.max(
                ...state.channels.map(
                    channel =>
                        Number(
                            channel.position
                        ) || 0
                )
            ) + 1
        );

    }


    /* =====================================================
       50. COMMUNITY MENU
       ===================================================== */

    function openCommunityMenu() {

        const menu =
            byId(
                "communityMenu"
            );


        const button =
            byId(
                "communityMenuButton"
            );


        if (
            !menu ||
            !button
        ) {

            return;

        }


        const rect =
            button.getBoundingClientRect();


        menu.style.top =
            `${rect.bottom + 7}px`;


        menu.style.right =
            `${Math.max(
                10,
                window.innerWidth -
                rect.right
            )}px`;


        menu.classList.remove(
            "hidden"
        );

    }


    function closeCommunityMenu() {

        hideElement(
            byId(
                "communityMenu"
            )
        );

    }


    /* =====================================================
       51. ATTACHMENT PLACEHOLDER
       ===================================================== */

    function handleAttachmentButton() {

        /*
         * Attachments are intentionally not
         * faked here.
         *
         * chat_attachments exists in the database,
         * but a proper Supabase Storage bucket,
         * upload flow, permissions and attachment
         * rendering must be connected before
         * calling this feature operational.
         */

        toast(
            "File sharing is being prepared for the community system."
        );

    }


    /* =====================================================
       52. VOICE / VIDEO PLACEHOLDERS
       ===================================================== */

    function handleVoiceButton() {

        toast(
            "Voice rooms are part of the next WebRTC stage."
        );

    }


    function handleVideoButton() {

        toast(
            "Video rooms are part of the next WebRTC stage."
        );

    }


    /* =====================================================
       53. EVENT BINDING
       ===================================================== */

    function setupEvents() {

        /* -----------------------------------------------
           Community rail
           ----------------------------------------------- */

        const rail =
            byId(
                "communityRail"
            );


        if (rail) {

            rail.addEventListener(
                "click",
                handleCommunityRailClick
            );

        }


        /* -----------------------------------------------
           Channel list
           ----------------------------------------------- */

        const channelList =
            byId(
                "channelList"
            );


        if (channelList) {

            channelList.addEventListener(
                "click",
                event => {

                    const item =
                        event.target.closest(
                            "[data-channel-id]"
                        );


                    if (!item) return;


                    const channel =
                        state.channels.find(
                            candidate =>
                                String(
                                    candidate.id
                                ) ===
                                String(
                                    item.dataset.channelId
                                )
                        );


                    if (channel) {

                        selectChannel(
                            channel
                        );

                    }

                }
            );

        }


        /* -----------------------------------------------
           Message form
           ----------------------------------------------- */

        const messageForm =
            byId(
                "messageForm"
            );


        if (messageForm) {

            messageForm.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    sendMessage();

                }
            );

        }


        /* -----------------------------------------------
           Channel drawer
           ----------------------------------------------- */

        const channelToggle =
            byId(
                "channelToggleButton"
            );


        if (channelToggle) {

            channelToggle.addEventListener(
                "click",
                () => {

                    if (
                        isChannelDrawerOpen()
                    ) {

                        closeChannelDrawer();

                    } else {

                        openChannelDrawer();

                    }

                }
            );

        }


        /* -----------------------------------------------
           Member drawer
           ----------------------------------------------- */

        const memberToggle =
            byId(
                "memberToggleButton"
            );


        if (memberToggle) {

            memberToggle.addEventListener(
                "click",
                () => {

                    if (
                        isMemberDrawerOpen()
                    ) {

                        closeMemberDrawer();

                    } else {

                        openMemberDrawer();

                    }

                }
            );

        }


        const memberClose =
            byId(
                "closeMemberSidebarButton"
            );


        if (memberClose) {

            memberClose.addEventListener(
                "click",
                closeMemberDrawer
            );

        }


        /* -----------------------------------------------
           Overlay
           ----------------------------------------------- */

        const overlay =
            getOverlay();


        if (overlay) {

            overlay.addEventListener(
                "click",
                closeAllDrawers
            );

        }


        /* -----------------------------------------------
           Search
           ----------------------------------------------- */

        const chatSearch =
            byId(
                "chatSearchButton"
            );


        if (chatSearch) {

            chatSearch.addEventListener(
                "click",
                () => {

                    openMessageSearch();

                }
            );

        }


        const closeSearch =
            byId(
                "closeMessageSearchButton"
            );


        if (closeSearch) {

            closeSearch.addEventListener(
                "click",
                closeMessageSearch
            );

        }


        /* -----------------------------------------------
           Reply
           ----------------------------------------------- */

        const cancelReplyButton =
            byId(
                "cancelReplyButton"
            );


        if (cancelReplyButton) {

            cancelReplyButton.addEventListener(
                "click",
                cancelReply
            );

        }


        /* -----------------------------------------------
           Attachment
           ----------------------------------------------- */

        const attachment =
            byId(
                "attachmentButton"
            );


        if (attachment) {

            attachment.addEventListener(
                "click",
                handleAttachmentButton
            );

        }


        /* -----------------------------------------------
           Voice
           ----------------------------------------------- */

        const voice =
            byId(
                "voiceCallButton"
            );


        if (voice) {

            voice.addEventListener(
                "click",
                handleVoiceButton
            );

        }


        /* -----------------------------------------------
           Video
           ----------------------------------------------- */

        const video =
            byId(
                "videoCallButton"
            );


        if (video) {

            video.addEventListener(
                "click",
                handleVideoButton
            );

        }


        /* -----------------------------------------------
           Create community
           ----------------------------------------------- */

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


        /* -----------------------------------------------
           Community modal
           ----------------------------------------------- */

        const communityForm =
            byId(
                "communityForm"
            );


        if (communityForm) {

            communityForm.addEventListener(
                "submit",
                createCommunity
            );

        }


        const closeCommunity =
            byId(
                "closeCommunityModalButton"
            );


        if (closeCommunity) {

            closeCommunity.addEventListener(
                "click",
                () =>
                    closeModal(
                        "communityModal"
                    )
            );

        }


        const cancelCommunity =
            byId(
                "cancelCommunityButton"
            );


        if (cancelCommunity) {

            cancelCommunity.addEventListener(
                "click",
                () =>
                    closeModal(
                        "communityModal"
                    )
            );

        }


        /* -----------------------------------------------
           Create channel
           ----------------------------------------------- */

        const createChannel =
            byId(
                "createChannelButton"
            );


        if (createChannel) {

            createChannel.addEventListener(
                "click",
                openChannelModal
            );

        }


        const channelForm =
            byId(
                "channelForm"
            );


        if (channelForm) {

            channelForm.addEventListener(
                "submit",
                createChannel
            );

        }


        const closeChannel =
            byId(
                "closeChannelModalButton"
            );


        if (closeChannel) {

            closeChannel.addEventListener(
                "click",
                () =>
                    closeModal(
                        "channelModal"
                    )
            );

        }


        const cancelChannel =
            byId(
                "cancelChannelButton"
            );


        if (cancelChannel) {

            cancelChannel.addEventListener(
                "click",
                () =>
                    closeModal(
                        "channelModal"
                    )
            );

        }


        /* -----------------------------------------------
           Community menu
           ----------------------------------------------- */

        const menuButton =
            byId(
                "communityMenuButton"
            );


        if (menuButton) {

            menuButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const menu =
                        byId(
                            "communityMenu"
                        );


                    if (
                        menu &&
                        !menu.classList.contains(
                            "hidden"
                        )
                    ) {

                        closeCommunityMenu();

                    } else {

                        openCommunityMenu();

                    }

                }
            );

        }


        const menuCreateChannel =
            byId(
                "communityMenuCreateChannel"
            );


        if (menuCreateChannel) {

            menuCreateChannel.addEventListener(
                "click",
                () => {

                    closeCommunityMenu();

                    openChannelModal();

                }
            );

        }


        const menuCreateCommunity =
            byId(
                "communityMenuCreateCommunity"
            );


        if (menuCreateCommunity) {

            menuCreateCommunity.addEventListener(
                "click",
                () => {

                    closeCommunityMenu();

                    openCommunityModal();

                }
            );

        }


        const menuRefresh =
            byId(
                "communityMenuRefresh"
            );


        if (menuRefresh) {

            menuRefresh.addEventListener(
                "click",
                async () => {

                    closeCommunityMenu();

                    await refreshCommunity();

                }
            );

        }


        /* -----------------------------------------------
           Textarea
           ----------------------------------------------- */

        setupTextarea();


        /* -----------------------------------------------
           Search
           ----------------------------------------------- */

        setupSearch();


        /* -----------------------------------------------
           Global click
           ----------------------------------------------- */

        document.addEventListener(
            "click",
            event => {

                const menu =
                    byId(
                        "communityMenu"
                    );


                const menuButton =
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
                    !menuButton?.contains(
                        event.target
                    )
                ) {

                    closeCommunityMenu();

                }

            }
        );


        /* -----------------------------------------------
           Escape
           ----------------------------------------------- */

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


                closeMessageSearch();


                closeAllDrawers();


                closeModal(
                    "communityModal"
                );


                closeModal(
                    "channelModal"
                );

            }
        );


        /* -----------------------------------------------
           Resize
           ----------------------------------------------- */

        window.addEventListener(
            "resize",
            () => {

                if (
                    window.innerWidth >
                    800
                ) {

                    closeChannelDrawer();

                }

            }
        );


        /* -----------------------------------------------
           Page visibility
           ----------------------------------------------- */

        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    updatePresence();

                }

            }
        );


        /* -----------------------------------------------
           Before leaving
           ----------------------------------------------- */

        window.addEventListener(
            "beforeunload",
            () => {

                setOfflinePresence();

            }
        );

    }


    /* =====================================================
       54. REFRESH
       ===================================================== */

    async function refreshCommunity() {

        if (!state.currentCommunity) {

            await loadCommunities();

            return;

        }


        toast(
            "Refreshing community..."
        );


        await loadCourses();


        await loadCommunities();


        const community =
            state.communities.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        state.currentCommunity.id
                    )
            );


        if (community) {

            state.currentCommunity =
                community;

        }


        await loadChannels();


        await loadMembers();


        if (
            state.currentChannel?.id
        ) {

            await loadMessages(
                state.currentChannel.id
            );

        }


        toast(
            "Community refreshed.",
            "success"
        );

    }


    /* =====================================================
       55. INITIAL COMMUNITY
       ===================================================== */

    function chooseInitialCommunity() {

        if (!state.communities.length) {

            return null;

        }


        const storedId =
            storageGet(
                STORAGE.communityId
            );


        if (storedId) {

            const stored =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            storedId
                        )
                );


            if (stored) {

                return stored;

            }

        }


        return state.communities[0];

    }


    /* =====================================================
       56. INITIALIZATION
       ===================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {

            return;

        }


        console.log(
            "🚀 Initializing Mwaniki Community..."
        );


        const authenticated =
            await requireAuthentication();


        if (!authenticated) {

            return;

        }


        setupEvents();


        setupAuthListener();


        await loadStudentProfile();


        await loadCourses();


        await loadCommunities();


        if (
            !state.communities.length
        ) {

            console.warn(
                "⚠️ No communities are currently available."
            );


            const list =
                byId(
                    "channelList"
                );


            if (list) {

                list.innerHTML = `
                    <div class="empty-state">
                        No communities have been created yet.
                    </div>
                `;

            }


            state.initialized =
                true;


            return;

        }


        const initialCommunity =
            chooseInitialCommunity();


        if (
            initialCommunity
        ) {

            await selectCommunity(
                initialCommunity
            );

        }


        subscribeToCommunityChanges();


        startPresence();


        state.initialized =
            true;


        console.log(
            "✅ Mwaniki Scholars Community initialized successfully."
        );

    }


    /* =====================================================
       57. GLOBAL API
       ===================================================== */

    window.mwanikiCommunity = {

        state,

        refresh:
            refreshCommunity,

        openChannels:
            openChannelDrawer,

        closeChannels:
            closeChannelDrawer,

        openMembers:
            openMemberDrawer,

        closeMembers:
            closeMemberDrawer,

        sendMessage,

        selectChannel,

        selectCommunity,

        cancelReply

    };


    /* =====================================================
       58. START
       ===================================================== */

    initialize()
        .catch(
            error => {

                console.error(
                    "💥 Community initialization failed:",
                    error
                );


                toast(
                    "The community could not be initialized.",
                    "error"
                );

            }
        );

})();
