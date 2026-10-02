/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js — PART 1 / 2

   FIXED:
   - Supabase authentication
   - Student profile names/photos
   - Community loading
   - Channel loading
   - Member loading
   - Real member profiles
   - Real message names/photos
   - Presence using user_id ONLY
   - Message loading/sending
   - Replies
   - Message rendering
   - Search
   - Permissions
   - Safe DOM helpers

   PART 2:
   - Realtime
   - Community/channel management
   - Calls
   - Direct calls
   - General calls
   - Call events
   - Initialization
   ========================================================= */

import { supabase } from "./supabase.js";

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community Engine — PART 1");

    const db = supabase;

    if (!db) {
        console.error("❌ Supabase client unavailable.");
        return;
    }

    /* =====================================================
       1. APPLICATION STATE
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

        drawerOverlayActive: false,

        subscriptionsReady: false

    };


    /* =====================================================
       2. CONSTANTS
       ===================================================== */

    const STORAGE = {

        communityId:
            "mwanikiCommunityId",

        communityName:
            "mwanikiCommunityName",

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
       3. BASIC DOM HELPERS
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


    function setHTML(id, html) {

        const element = byId(id);

        if (!element) return;

        element.innerHTML =
            html || "";

    }


    /* =====================================================
       4. SECURITY / HTML HELPERS
       ===================================================== */

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


    function escapeAttribute(value) {

        return escapeHTML(value);

    }


    function initials(name) {

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

            return "MS";

        }


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

            parts[
                parts.length - 1
            ][0]

        ).toUpperCase();

    }


    function safeImageURL(value) {

        if (!value) return "";

        try {

            const url =
                new URL(
                    value,
                    window.location.href
                );

            if (
                url.protocol === "http:" ||
                url.protocol === "https:"
            ) {

                return url.href;

            }

        } catch (_) {}

        return "";

    }


    /* =====================================================
       5. TOAST
       ===================================================== */

    let toastTimer = null;


    function toast(
        message,
        type = "normal"
    ) {

        const element =
            byId(
                "communityToast"
            );


        if (!element) {

            if (
                type === "error"
            ) {

                console.error(
                    "[Community]",
                    message
                );

            } else {

                console.log(
                    "[Community]",
                    message
                );

            }

            return;

        }


        element.textContent =
            message || "";


        element.classList.add(
            "show"
        );

        element.classList.add(
            "visible"
        );

        element.classList.add(
            "active"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    element.classList.remove(
                        "show"
                    );

                    element.classList.remove(
                        "visible"
                    );

                    element.classList.remove(
                        "active"
                    );

                },
                3200
            );

    }


    /* =====================================================
       6. DATE / TIME
       ===================================================== */

    function formatMessageTime(
        value
    ) {

        if (!value) return "";

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

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


    function formatMessageDate(
        value
    ) {

        if (!value) return "";

        const date =
            new Date(value);

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

            date.getFullYear() ===
                now.getFullYear() &&

            date.getMonth() ===
                now.getMonth() &&

            date.getDate() ===
                now.getDate();


        if (sameDay) {

            return formatMessageTime(
                value
            );

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
       7. LOCAL STORAGE
       ===================================================== */

    function storageGet(key) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (error) {

            console.warn(
                "⚠️ localStorage read failed:",
                error
            );

            return null;

        }

    }


    function storageSet(
        key,
        value
    ) {

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

            localStorage.removeItem(
                key
            );

        } catch (error) {

            console.warn(
                "⚠️ localStorage remove failed:",
                error
            );

        }

    }


    /* =====================================================
       8. AUTHENTICATION
       ===================================================== */

    async function loadAuthenticatedUser() {

        try {

            const {
                data,
                error
            } =
                await db.auth.getUser();


            if (error) {

                console.error(
                    "❌ Authentication lookup failed:",
                    error
                );

                return null;

            }


            return (
                data?.user ||
                null
            );

        } catch (error) {

            console.error(
                "❌ Authentication exception:",
                error
            );

            return null;

        }

    }


    async function requireAuthentication() {

        state.user =
            await loadAuthenticatedUser();


        if (state.user) {

            console.log(
                "✅ Authenticated:",
                state.user.id
            );

            return true;

        }


        console.warn(
            "⚠️ No authenticated user."
        );


        if (
            !window.location.pathname.endsWith(
                "index.html"
            )
        ) {

            window.location.href =
                "./index.html";

        }


        return false;

    }


    function setupAuthListener() {

        const {
            data
        } =
            db.auth.onAuthStateChange(
                (
                    event,
                    session
                ) => {

                    console.log(
                        "🔐 Community auth:",
                        event
                    );


                    if (
                        event ===
                        "SIGNED_IN"
                    ) {

                        if (
                            session?.user
                        ) {

                            state.user =
                                session.user;

                        }

                        return;

                    }


                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        cleanupRealtime();

                        clearInterval(
                            state.presenceTimer
                        );

                        state.user = null;

                        window.location.href =
                            "./index.html";

                    }

                }
            );


        return (
            data?.subscription ||
            null
        );

    }


    /* =====================================================
       9. STUDENT PROFILE
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

                .from(
                    "students"
                )

                .select("*")

                .eq(
                    "id",
                    state.user.id
                )

                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Student profile lookup failed:",
                error
            );

            state.profile =
                null;

            return null;

        }


        state.profile =
            data || null;


        updateCurrentUserUI();


        return state.profile;

    }


    function getCurrentDisplayName() {

        const profile =
            state.profile || {};


        return (

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            state.user
                ?.user_metadata
                ?.full_name ||

            state.user
                ?.user_metadata
                ?.name ||

            state.user
                ?.user_metadata
                ?.display_name ||

            state.user
                ?.email
                ?.split("@")[0] ||

            "Mwaniki Scholar"

        );

    }


    function getProfilePhoto(
        profile
    ) {

        if (!profile) {

            return "";

        }


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


    function updateCurrentUserUI() {

        const name =
            getCurrentDisplayName();


        const photo =
            getProfilePhoto(
                state.profile
            );


        const nameElements = [

            byId(
                "currentUserName"
            ),

            byId(
                "profileName"
            ),

            byId(
                "studentName"
            ),

            byId(
                "communityUserName"
            )

        ];


        nameElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        name;

                }

            }
        );


        const photoElements = [

            byId(
                "currentUserAvatar"
            ),

            byId(
                "communityUserAvatar"
            ),

            byId(
                "profileAvatar"
            )

        ];


        photoElements.forEach(
            element => {

                if (!element) return;


                const safe =
                    safeImageURL(
                        photo
                    );


                if (safe) {

                    if (
                        element.tagName
                            .toLowerCase() ===
                        "img"
                    ) {

                        element.src =
                            safe;

                    } else {

                        element.style.backgroundImage =
                            `url("${safe}")`;

                    }

                }

            }
        );

    }


    /* =====================================================
       10. COURSES
       ===================================================== */

    async function loadCourses() {

        const {
            data,
            error
        } =
            await db

                .from(
                    "courses"
                )

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

            state.courses =
                [];

            return [];

        }


        state.courses =
            Array.isArray(data)
                ? data
                : [];


        populateCourseSelects();


        console.log(
            "📚 Courses loaded:",
            state.courses.length
        );


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


        selects.forEach(
            select => {

                if (!select) return;


                const oldValue =
                    select.value;


                const placeholder =
                    select.options[0];


                select.innerHTML =
                    "";


                if (placeholder) {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        placeholder.value;

                    option.textContent =
                        placeholder.textContent;

                    select.appendChild(
                        option
                    );

                }


                state.courses
                    .forEach(
                        course => {

                            const option =
                                document.createElement(
                                    "option"
                                );


                            option.value =
                                String(
                                    course.id
                                );


                            option.textContent =
                                course.title ||
                                `Course ${course.id}`;


                            select.appendChild(
                                option
                            );

                        }
                    );


                if (
                    oldValue &&
                    Array.from(
                        select.options
                    ).some(
                        option =>
                            option.value ===
                            oldValue
                    )
                ) {

                    select.value =
                        oldValue;

                }

            }
        );

    }


    function findCourseById(
        courseId
    ) {

        if (
            courseId === null ||
            courseId === undefined
        ) {

            return null;

        }


        return (
            state.courses.find(
                course =>
                    String(
                        course.id
                    ) ===
                    String(
                        courseId
                    )
            ) ||
            null
        );

    }


    /* =====================================================
       11. COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        console.log(
            "🌐 Loading communities..."
        );


        const {
            data,
            error
        } =
            await db

                .from(
                    "chat_communities"
                )

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

            state.communities =
                [];

            renderCommunityRail();

            return [];

        }


        state.communities =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            "✅ Communities loaded:",
            state.communities.length
        );


        renderCommunityRail();


        return state.communities;

    }


    function renderCommunityRail() {

        const rail =
            byId(
                "communityRail"
            );


        if (!rail) return;


        if (
            !state.communities.length
        ) {

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
                                state.currentCommunity.id
                            ) ===
                            String(
                                community.id
                            );


                        const image =
                            safeImageURL(
                                community.icon_url
                            );


                        return `

                            <button
                                type="button"
                                class="community-rail-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-community-id="${escapeAttribute(
                                    community.id
                                )}"
                                title="${escapeAttribute(
                                    community.name
                                )}"
                                aria-label="${escapeAttribute(
                                    community.name
                                )}"
                            >

                                ${
                                    image

                                        ? `

                                            <img
                                                src="${escapeAttribute(
                                                    image
                                                )}"
                                                alt="${escapeAttribute(
                                                    community.name
                                                )}"
                                                class="community-rail-avatar"
                                            >

                                          `

                                        : `

                                            <span
                                                class="community-rail-avatar"
                                            >
                                                ${escapeHTML(
                                                    initials(
                                                        community.name
                                                    )
                                                )}
                                            </span>

                                          `
                                }

                            </button>

                        `;

                    }
                )
                .join("");

    }


    async function selectCommunity(
        community
    ) {

        if (!community) return;


        console.log(
            "🏠 Selecting community:",
            community.name,
            community.id
        );


        state.currentCommunity =
            community;


        state.currentChannel =
            null;


        state.currentCourse =
            null;


        state.messages =
            [];


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

            const image =
                safeImageURL(
                    community.icon_url
                );


            if (
                icon.tagName
                    .toLowerCase() ===
                "img"
            ) {

                if (image) {

                    icon.src =
                        image;

                    icon.style.display =
                        "";

                } else {

                    icon.removeAttribute(
                        "src"
                    );

                    icon.style.display =
                        "none";

                }

            } else {

                icon.textContent =
                    image
                        ? ""
                        : initials(
                            community.name
                        );

                if (image) {

                    icon.style.backgroundImage =
                        `url("${image}")`;

                } else {

                    icon.style.backgroundImage =
                        "";

                }

            }

        }


        storageSet(
            STORAGE.communityId,
            community.id
        );


        storageSet(
            STORAGE.communityName,
            community.name ||
            ""
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


        await loadChannels();


        await loadMembers();


        closeChannelDrawer();

    }


    /* =====================================================
       12. COMMUNITY MEMBERSHIP
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
            error: lookupError
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
            lookupError &&
            lookupError.code !==
                "PGRST116"
        ) {

            console.warn(
                "⚠️ Membership lookup failed:",
                lookupError
            );

        }


        if (existing) {

            if (
                existing.is_banned
            ) {

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
       13. ROLE
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
                "⚠️ Role lookup failed:",
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
            byId(
                "activeRoleBadge"
            );


        if (!badge) return;


        const role =
            state.currentRole ||
            "student";


        badge.textContent =
            role
                .replace(
                    /_/g,
                    " "
                )
                .replace(
                    /\b\w/g,
                    letter =>
                        letter.toUpperCase()
                );

    }


    function hasPermission(
        minimumRole = "student"
    ) {

        const current =
            ROLE_ORDER[
                state.currentRole
            ] || 1;


        const required =
            ROLE_ORDER[
                minimumRole
            ] || 1;


        return current >= required;

    }


    /* =====================================================
       14. CHANNELS
       ===================================================== */

    async function loadChannels() {

        if (
            !state.currentCommunity?.id
        ) {

            state.channels =
                [];

            renderChannels();

            return [];

        }


        console.log(
            "📡 Loading channels for:",
            state.currentCommunity.id
        );


        const {
            data,
            error
        } =
            await db

                .from(
                    "chat_channels"
                )

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

            state.channels =
                [];

            renderChannels();

            return [];

        }


        let channels =
            Array.isArray(data)
                ? data
                : [];


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
                    "⚠️ Private channel lookup failed:",
                    membershipError
                );

            } else {

                allowedPrivateIds =
                    new Set(
                        (
                            memberships ||
                            []
                        ).map(
                            row =>
                                row.channel_id
                        )
                    );

            }

        }


        state.channels = [

            ...publicChannels,

            ...privateChannels.filter(
                channel =>
                    allowedPrivateIds.has(
                        channel.id
                    )
            )

        ].sort(
            (
                a,
                b
            ) =>
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


        console.log(
            "✅ Channels loaded:",
            state.channels.length
        );


        renderChannels();


        selectBestInitialChannel();


        return state.channels;

    }


    function getChannelCategory(
        channel
    ) {

        if (
            channel.course_id !==
                null &&
            channel.course_id !==
                undefined
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


    function renderChannels() {

        const list =
            byId(
                "channelList"
            );


        if (!list) return;


        if (
            !state.channels.length
        ) {

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

                        const text = [

                            channel.name,

                            channel.description,

                            getChannelCategory(
                                channel
                            )

                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                        return text.includes(
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


        filtered.forEach(
            channel => {

                const category =
                    getChannelCategory(
                        channel
                    );


                if (
                    !groups.has(
                        category
                    )
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

                html += `

                    <div class="channel-category">
                        ${escapeHTML(
                            category
                        )}
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
                                data-channel-id="${escapeAttribute(
                                    channel.id
                                )}"
                                title="${escapeAttribute(
                                    channel.description ||
                                    channel.name ||
                                    ""
                                )}"
                            >

                                <span class="channel-icon">
                                    ${escapeHTML(
                                        icon
                                    )}
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


    function selectBestInitialChannel() {

        if (
            !state.channels.length
        ) {

            state.currentChannel =
                null;

            renderMessages();

            return;

        }


        const storedChannelId =
            storageGet(
                "mwanikiChannelId"
            );


        let channel =
            state.channels.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        storedChannelId
                    )
            );


        if (!channel) {

            channel =
                state.channels[0];

        }


        selectChannel(
            channel
        );

    }


    async function selectChannel(
        channel
    ) {

        if (!channel) return;


        state.currentChannel =
            channel;


        state.messages =
            [];


        storageSet(
            "mwanikiChannelId",
            channel.id
        );


        renderChannels();


        setText(
            "activeChannelName",
            channel.name ||
            "Channel"
        );


        setText(
            "activeChannelDescription",
            channel.description ||
            ""
        );


        await loadMessages(
            channel.id
        );

    }


    /* =====================================================
       15. MESSAGE LOADING
       ===================================================== */

    async function loadMessages(
        channelId
    ) {

        if (!channelId) {

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

                .from(
                    "chat_messages"
                )

                .select(
                    `
                    *,
                    profile:students!chat_messages_user_id_fkey(*)
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
                );


        /*
         * Some installations may not expose
         * the FK relationship under the generated
         * relationship name. If that happens,
         * fall back to a plain message query.
         */

        if (error) {

            console.warn(
                "⚠️ Joined message/profile query failed. Falling back:",
                error
            );


            const fallback =
                await db

                    .from(
                        "chat_messages"
                    )

                    .select("*")

                    .eq(
                        "channel_id",
                        channelId
                    )

                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );


            if (
                fallback.error
            ) {

                console.error(
                    "❌ Message loading failed:",
                    fallback.error
                );

                state.messages =
                    [];

                state.loadingMessages =
                    false;

                renderMessagesError(
                    "Unable to load messages."
                );

                return [];

            }


            state.messages =
                fallback.data || [];


            await enrichMessages();

        } else {

            state.messages =
                data || [];

        }


        state.loadingMessages =
            false;


        renderMessages();


        scrollMessagesToBottom();


        await markChannelRead(
            channelId
        );


        return state.messages;

    }


    /* =====================================================
       16. MESSAGE PROFILE ENRICHMENT
       ===================================================== */

    async function enrichMessages() {

        if (
            !state.messages.length
        ) {

            return;

        }


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


        const {
            data,
            error
        } =
            await db

                .from(
                    "students"
                )

                .select("*")

                .in(
                    "id",
                    userIds
                );


        if (error) {

            console.warn(
                "⚠️ Message profile lookup failed:",
                error
            );

            /*
             * Keep already joined profiles
             * if they exist.
             */

            return;

        }


        const profileMap =
            new Map();


        (
            data || []
        ).forEach(
            profile => {

                profileMap.set(
                    String(
                        profile.id
                    ),
                    profile
                );

            }
        );


        state.messages =
            state.messages.map(
                message => {

                    const existingProfile =
                        message.profile ||
                        null;


                    const profile =
                        profileMap.get(
                            String(
                                message.user_id
                            )
                        ) ||
                        existingProfile ||
                        null;


                    return {

                        ...message,

                        profile

                    };

                }
            );

    }


    /* =====================================================
       17. MESSAGE LOADING UI
       ===================================================== */

    function renderMessagesLoading() {

        const list =
            byId(
                "messageList"
            );


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
            byId(
                "messageList"
            );


        if (!list) return;


        list.innerHTML = `

            <div class="empty-state">
                ${escapeHTML(
                    message
                )}
            </div>

        `;

    }


    /* =====================================================
       18. MESSAGE CONTENT
       ===================================================== */

    function formatMessageContent(
        value
    ) {

        const escaped =
            escapeHTML(
                value || ""
            );


        return escaped
            .replace(
                /\n/g,
                "<br>"
            );

    }


    /* =====================================================
       19. MESSAGE RENDERING
       ===================================================== */

    function renderMessages() {

        const list =
            byId(
                "messageList"
            );


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
                    message => {

                        const content =
                            String(
                                message.content ||
                                ""
                            ).toLowerCase();


                        const name =
                            getMessageDisplayName(
                                message
                            )
                                .toLowerCase();


                        return (

                            content.includes(
                                search
                            ) ||

                            name.includes(
                                search
                            )

                        );

                    }
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
                    renderMessage
                )
                .join("");


        attachMessageActionEvents();

    }


    function getMessageDisplayName(
        message
    ) {

        const profile =
            message?.profile ||
            {};


        if (
            message?.user_id &&
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            )
        ) {

            return getCurrentDisplayName();

        }


        return (

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            profile.username ||

            message?.sender_name ||

            "Mwaniki Scholar"

        );

    }


    function getMessageAvatar(
        message
    ) {

        const profile =
            message?.profile ||
            {};


        if (
            message?.user_id &&
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            )
        ) {

            return safeImageURL(
                getProfilePhoto(
                    state.profile
                )
            );

        }


        return safeImageURL(

            profile.photo_url ||

            profile.profile_photo ||

            profile.profile_image ||

            profile.avatar_url ||

            profile.image_url ||

            profile.photo ||

            message?.sender_photo ||

            ""

        );

    }


    function renderMessage(
        message
    ) {

        const displayName =
            getMessageDisplayName(
                message
            );


        const avatar =
            getMessageAvatar(
                message
            );


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
                    message.content ||
                    ""
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

                    <span class="message-edited">
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
                                src="${escapeAttribute(
                                    avatar
                                )}"
                                alt="${escapeAttribute(
                                    displayName
                                )}"
                                loading="lazy"
                                onerror="this.style.display='none';this.nextElementSibling?.classList.remove('hidden');"
                            >

                            <div
                                class="message-avatar message-avatar-fallback hidden"
                            >
                                ${escapeHTML(
                                    initials(
                                        displayName
                                    )
                                )}
                            </div>

                          `

                        : `

                            <div
                                class="message-avatar"
                            >
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

                        <span
                            class="message-author"
                        >
                            ${escapeHTML(
                                displayName
                            )}
                        </span>

                        ${pinned}

                        <span
                            class="message-time"
                        >
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
                                    ${
                                        message.is_pinned
                                            ? "📌"
                                            : "📍"
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
       20. MESSAGE ACTION EVENTS
       ===================================================== */

    function attachMessageActionEvents() {

        queryAll(
            "[data-message-action]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();

                        event.stopPropagation();


                        const action =
                            button.dataset
                                .messageAction;


                        const messageId =
                            button.dataset
                                .messageId;


                        if (
                            action ===
                            "reply"
                        ) {

                            setReply(
                                messageId
                            );

                        }


                        if (
                            action ===
                            "pin"
                        ) {

                            await togglePinMessage(
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

                    }
                );

            }
        );

    }


    /* =====================================================
       21. REPLY
       ===================================================== */

    function setReply(
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


        if (!message) return;


        state.currentReply =
            message;


        const preview =
            byId(
                "replyPreview"
            );


        if (preview) {

            preview.classList.remove(
                "hidden"
            );

        }


        setText(
            "replyPreviewName",
            getMessageDisplayName(
                message
            )
        );


        setText(
            "replyPreviewText",
            message.content ||
            ""
        );

    }


    function cancelReply() {

        state.currentReply =
            null;


        const preview =
            byId(
                "replyPreview"
            );


        if (preview) {

            preview.classList.add(
                "hidden"
            );

        }


        setText(
            "replyPreviewName",
            ""
        );


        setText(
            "replyPreviewText",
            ""
        );

    }


    /* =====================================================
       22. SEND MESSAGE
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
                "Please sign in first.",
                "error"
            );

            return;

        }


        if (
            !state.currentChannel?.id
        ) {

            toast(
                "Select a channel first.",
                "error"
            );

            return;

        }


        const input =
            byId(
                "messageInput"
            );


        if (!input) {

            console.error(
                "❌ #messageInput not found."
            );

            return;

        }


        const content =
            input.value.trim();


        if (!content) {

            return;

        }


        state.sendingMessage =
            true;


        const payload = {

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content

        };


        /*
         * Add reply reference only if your
         * table contains reply_to_id.
         *
         * We deliberately don't send it blindly
         * because your existing schema may not
         * contain that column.
         */


        const {
            data,
            error
        } =
            await db

                .from(
                    "chat_messages"
                )

                .insert(
                    payload
                )

                .select("*")
                .single();


        if (error) {

            console.error(
                "❌ Message send failed:",
                error
            );

            toast(
                "Message could not be sent.",
                "error"
            );

            state.sendingMessage =
                false;

            return;

        }


        input.value =
            "";


        state.messages.push(
            data
        );


        await enrichMessages();


        renderMessages();


        scrollMessagesToBottom();


        cancelReply();


        state.sendingMessage =
            false;

    }


    /* =====================================================
       23. PIN MESSAGE
       ===================================================== */

    async function togglePinMessage(
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


        if (!message) return;


        if (
            !hasPermission(
                "moderator"
            )
        ) {

            toast(
                "You do not have permission to pin messages.",
                "error"
            );

            return;

        }


        const {
            error
        } =
            await db

                .from(
                    "chat_messages"
                )

                .update({

                    is_pinned:
                        !message.is_pinned

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


        message.is_pinned =
            !message.is_pinned;


        renderMessages();

    }


    /* =====================================================
       24. DELETE MESSAGE
       ===================================================== */

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


        if (!message) return;


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
                "You cannot delete this message.",
                "error"
            );

            return;

        }


        const {
            error
        } =
            await db

                .from(
                    "chat_messages"
                )

                .update({

                    is_deleted:
                        true,

                    content:
                        ""

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
                "Unable to delete message.",
                "error"
            );

            return;

        }


        message.is_deleted =
            true;

        message.content =
            "";


        renderMessages();

    }


    /* =====================================================
       25. SCROLL
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
       26. READ STATUS
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
       27. MEMBERS
       ===================================================== */

    async function loadMembers() {

        if (
            !state.currentCommunity?.id
        ) {

            state.members =
                [];

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

            state.members =
                [];

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
       28. MEMBER PROFILE ENRICHMENT
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

                .from(
                    "students"
                )

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
            data || []
        ).forEach(
            profile => {

                map.set(
                    String(
                        profile.id
                    ),
                    profile
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
       29. MEMBER DISPLAY HELPERS
       ===================================================== */

    function getMemberName(
        member
    ) {

        const profile =
            member?.profile ||
            {};


        return (

            member?.nickname ||

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            profile.username ||

            "Mwaniki Scholar"

        );

    }


    function getMemberPhoto(
        member
    ) {

        const profile =
            member?.profile ||
            {};


        return safeImageURL(

            profile.photo_url ||

            profile.profile_photo ||

            profile.profile_image ||

            profile.avatar_url ||

            profile.image_url ||

            profile.photo ||

            ""

        );

    }


    /* =====================================================
       30. MEMBER RENDERING
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

            count.textContent =
                String(
                    state.members.length
                );

        }


        const search =
            state.memberSearch
                .trim()
                .toLowerCase();


        const members =
            search

                ? state.members.filter(
                    member => {

                        const name =
                            getMemberName(
                                member
                            ).toLowerCase();


                        const role =
                            String(
                                member.role ||
                                ""
                            ).toLowerCase();


                        return (

                            name.includes(
                                search
                            ) ||

                            role.includes(
                                search
                            )

                        );

                    }
                )

                : state.members;


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
                .map(
                    renderMember
                )
                .join("");

    }


    function renderMember(
        member
    ) {

        const name =
            getMemberName(
                member
            );


        const photo =
            getMemberPhoto(
                member
            );


        const role =
            String(
                member.role ||
                "student"
            )
                .replace(
                    /_/g,
                    " "
                )
                .replace(
                    /\b\w/g,
                    letter =>
                        letter.toUpperCase()
                );


        /*
         * Online is determined from the member's
         * recent last_seen_at value.
         */

        const lastSeen =
            member.last_seen_at
                ? new Date(
                    member.last_seen_at
                ).getTime()
                : 0;


        const online =
            lastSeen > 0 &&
            Date.now() -
                lastSeen <
                2 *
                60 *
                1000;


        return `

            <div
                class="member-item"
                data-member-id="${escapeAttribute(
                    member.user_id
                )}"
            >

                ${
                    photo

                        ? `

                            <img
                                class="member-avatar"
                                src="${escapeAttribute(
                                    photo
                                )}"
                                alt="${escapeAttribute(
                                    name
                                )}"
                                loading="lazy"
                            >

                          `

                        : `

                            <div
                                class="member-avatar"
                            >
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
                        ${escapeHTML(
                            name
                        )}
                    </div>

                    <div class="member-role">
                        ${escapeHTML(
                            role
                        )}
                    </div>

                </div>


                <span
                    class="presence-dot ${
                        online
                            ? "online"
                            : "offline"
                    }"
                    title="${
                        online
                            ? "Online"
                            : "Offline"
                    }"
                ></span>

            </div>

        `;

    }


    /* =====================================================
       31. PRESENCE
       ===================================================== */

    async function updatePresence() {

        if (
            !state.user?.id
        ) {

            return;

        }


        const now =
            new Date().toISOString();


        /*
         * IMPORTANT:
         *
         * chat_presence DOES NOT HAVE community_id.
         *
         * Therefore the only valid conflict target
         * here is user_id.
         */

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


        /*
         * Community membership has its own
         * last_seen_at field, so update it
         * separately.
         */

        if (
            state.currentCommunity?.id
        ) {

            const {
                error:
                    memberError
            } =
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


            if (memberError) {

                console.warn(
                    "⚠️ Community member presence update failed:",
                    memberError
                );

            }

        }

    }


    function startPresence() {

        clearInterval(
            state.presenceTimer
        );


        updatePresence();


        state.presenceTimer =
            setInterval(
                () => {

                    updatePresence();

                },
                60 * 1000
            );

    }


    async function setOfflinePresence() {

        if (
            !state.user?.id
        ) {

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


        if (error) {

            console.warn(
                "⚠️ Offline presence update failed:",
                error
            );

        }

    }


    /* =====================================================
       32. DRAWERS
       ===================================================== */

    function getOverlay() {

        return byId(
            "communityDrawerOverlay"
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
            )
                ?.classList
                .contains(
                    "open"
                )

        );

    }


    function isMemberDrawerOpen() {

        const sidebar =
            byId(
                "memberSidebar"
            );


        if (!sidebar) {

            return false;

        }


        return (

            sidebar.classList.contains(
                "open"
            ) ||

            sidebar.classList.contains(
                "active"
            ) ||

            sidebar.classList.contains(
                "is-open"
            )

        );

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


        if (
            channelSidebar
        ) {

            channelSidebar.classList.remove(
                "open"
            );

        }


        if (
            memberSidebar
        ) {

            memberSidebar.classList.remove(
                "open",
                "active",
                "is-open"
            );

        }


        deactivateDrawerOverlay();

    }


    /* =====================================================
       33. SEARCH
       ===================================================== */

    function setupSearchHandlers() {

        const channelSearch =
            byId(
                "channelSearch"
            );


        if (
            channelSearch
        ) {

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
                "memberSearch"
            );


        if (
            memberSearch
        ) {

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
                "messageSearch"
            );


        if (
            messageSearch
        ) {

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
       34. COMMUNITY RAIL EVENTS
       ===================================================== */

    function setupCommunityRailEvents() {

        const rail =
            byId(
                "communityRail"
            );


        if (!rail) return;


        rail.addEventListener(
            "click",
            async event => {

                const button =
                    event.target.closest(
                        "[data-community-id]"
                    );


                if (!button) return;


                const community =
                    state.communities.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                button.dataset
                                    .communityId
                            )
                    );


                if (
                    community
                ) {

                    await selectCommunity(
                        community
                    );

                }

            }
        );

    }


    /* =====================================================
       35. CHANNEL EVENTS
       ===================================================== */

    function setupChannelEvents() {

        const list =
            byId(
                "channelList"
            );


        if (!list) return;


        list.addEventListener(
            "click",
            async event => {

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
                                item.dataset
                                    .channelId
                            )
                    );


                if (
                    channel
                ) {

                    await selectChannel(
                        channel
                    );

                }

            }
        );

    }


    /* =====================================================
       36. MESSAGE FORM EVENTS
       ===================================================== */

    function setupMessageEvents() {

        const form =
            byId(
                "messageForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    sendMessage();

                }
            );

        }


        const input =
            byId(
                "messageInput"
            );


        if (input) {

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


        const cancel =
            byId(
                "cancelReplyButton"
            );


        if (cancel) {

            cancel.addEventListener(
                "click",
                cancelReply
            );

        }

    }


    /* =====================================================
       37. DRAWER EVENTS
       ===================================================== */

    function setupDrawerEvents() {

        const channelToggle =
            byId(
                "channelToggleButton"
            );


        if (
            channelToggle
        ) {

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


        const memberToggle =
            byId(
                "memberToggleButton"
            );


        if (
            memberToggle
        ) {

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


        if (
            memberClose
        ) {

            memberClose.addEventListener(
                "click",
                closeMemberDrawer
            );

        }


        const channelClose =
            byId(
                "closeChannelSidebarButton"
            );


        if (
            channelClose
        ) {

            channelClose.addEventListener(
                "click",
                closeChannelDrawer
            );

        }


        const overlay =
            getOverlay();


        if (overlay) {

            overlay.addEventListener(
                "click",
                closeAllDrawers
            );

        }

    }


    /* =====================================================
       38. GLOBAL EVENTS
       ===================================================== */

    function setupGlobalEvents() {

        window.addEventListener(
            "beforeunload",
            () => {

                setOfflinePresence();

            }
        );


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

    }


    /* =====================================================
       39. REFRESH
       ===================================================== */

    async function refreshCommunity() {

        if (
            !state.currentCommunity
        ) {

            return;

        }


        await loadCommunities();

        await loadMembers();

        await loadChannels();


        if (
            state.currentChannel
        ) {

            await loadMessages(
                state.currentChannel.id
            );

        }

    }


    /* =====================================================
       40. PART 1 PUBLIC API
       ===================================================== */

    window.mwanikiCommunity =
        window.mwanikiCommunity ||
        {};


    Object.assign(
        window.mwanikiCommunity,
        {

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

            cancelReply,

            loadMembers,

            loadMessages,

            updatePresence,

            getCurrentDisplayName,

            getMessageDisplayName,

            getMessageAvatar

        }
    );


    /* =====================================================
       41. PART 1 EVENT INITIALIZATION
       ===================================================== */

    function initializePartOneEvents() {

        setupCommunityRailEvents();

        setupChannelEvents();

        setupMessageEvents();

        setupDrawerEvents();

        setupSearchHandlers();

        setupGlobalEvents();

    }


    /*
     * PART 2 WILL ADD:
     *
     * - realtime subscriptions
     * - presence realtime
     * - call engine integration
     * - direct calls
     * - General Call
     * - online recipient picker
     * - call room creation
     * - call participants
     * - incoming call UI
     * - voice/video button handlers
     * - final initialize()
     */


    initializePartOneEvents();


    console.log(
        "✅ Mwaniki Community Part 1 loaded."
    );

})();
/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js — PART 2 / 2

   CALL SYSTEM

   Supports:
   - Community voice calls
   - Community video calls
   - Direct calls
   - General Call
   - Multiple selected recipients
   - Online-user selection
   - Independent simultaneous calls
   - WebRTC peer connections
   - Supabase signaling
   - Call participants
   - Incoming calls
   - Mute
   - Camera
   - Leave call
   - Screen sharing

   DATABASE TABLES:

   chat_call_rooms
   chat_call_participants
   chat_call_signals

   IMPORTANT:
   chat_call_rooms.community_id = UUID
   matching chat_communities.id

   General calls use:
   community_id = null

   ========================================================= */

(() => {

    "use strict";

    console.log(
        "📞 Mwaniki Universal Call Engine loading..."
    );


    const db =
        window.supabase ||
        null;


    /*
     * The Supabase client is not necessarily attached
     * to window by supabase.js, therefore obtain it
     * through the existing community engine where
     * possible.
     */

    const communityAPI =
        window.mwanikiCommunity || null;


    if (!communityAPI) {

        console.error(
            "❌ Mwaniki Community API is unavailable."
        );

        return;

    }


    const state =
        communityAPI.state;


    /* =====================================================
       1. CALL STATE
       ===================================================== */

    const callState = {

        activeRoom: null,

        roomId: null,

        roomCode: null,

        callType: "video",

        callScope: "general",

        localStream: null,

        screenStream: null,

        peers: new Map(),

        participants: new Map(),

        invitedUsers: new Set(),

        incomingCalls: new Map(),

        signalChannel: null,

        participantChannel: null,

        roomChannel: null,

        active: false,

        muted: false,

        cameraOn: true,

        screenSharing: false,

        startedAt: null,

        callWindow: null,

        recipientPicker: null,

        mediaReady: false,

        initialized: false

    };


    /* =====================================================
       2. SUPABASE CLIENT
       ===================================================== */

    /*
     * community.js keeps the real client internally.
     *
     * We first check common global names.
     * If unavailable, use the client exposed by
     * the imported supabase module through the
     * community API when available.
     */

    function getSupabaseClient() {

        if (
            window.mwanikiSupabase
        ) {

            return window.mwanikiSupabase;

        }


        if (
            window.supabaseClient
        ) {

            return window.supabaseClient;

        }


        if (
            window.supabase
        &&
            typeof window.supabase
                .from === "function"
        ) {

            return window.supabase;

        }


        return null;

    }


    /*
     * Because ES modules do not automatically expose
     * imported variables globally, dynamically obtain
     * the already-loaded Supabase module.
     */

    let clientPromise = null;


    async function getDB() {

        if (
            clientPromise
        ) {

            return clientPromise;

        }


        clientPromise =
            import("./supabase.js")
                .then(
                    module => {

                        if (
                            module?.supabase
                        ) {

                            return module.supabase;

                        }


                        return getSupabaseClient();

                    }
                )
                .catch(
                    error => {

                        console.error(
                            "❌ Unable to load Supabase client:",
                            error
                        );

                        return getSupabaseClient();

                    }
                );


        return clientPromise;

    }


    /* =====================================================
       3. HELPERS
       ===================================================== */

    function byId(id) {

        return document.getElementById(id);

    }


    function escapeHTML(value) {

        return String(
            value ??
            ""
        )

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


    function safeURL(value) {

        if (!value) {

            return "";

        }


        try {

            const url =
                new URL(
                    value,
                    window.location.href
                );


            if (
                url.protocol ===
                    "http:" ||

                url.protocol ===
                    "https:"
            ) {

                return url.href;

            }

        } catch (_) {}


        return "";

    }


    function initials(name) {

        const parts =
            String(
                name ||
                "Mwaniki Scholar"
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);


        if (
            parts.length === 1
        ) {

            return parts[0]
                .slice(0, 2)
                .toUpperCase();

        }


        return (

            parts[0][0] +

            parts[
                parts.length - 1
            ][0]

        ).toUpperCase();

    }


    function callToast(
        message,
        type = "normal"
    ) {

        if (
            typeof window
                .mwanikiCommunity
                ?.toast ===
            "function"
        ) {

            window
                .mwanikiCommunity
                .toast(
                    message,
                    type
                );

            return;

        }


        console.log(
            `[Call ${type}]`,
            message
        );

    }


    function currentUserId() {

        return (
            state.user?.id ||
            null
        );

    }


    function currentUserName() {

        if (
            typeof communityAPI
                .getCurrentDisplayName ===
            "function"
        ) {

            return communityAPI
                .getCurrentDisplayName();

        }


        return (
            state.user
                ?.user_metadata
                ?.full_name ||

            state.user
                ?.email
                ?.split("@")[0] ||

            "Mwaniki Scholar"
        );

    }


    /* =====================================================
       4. UNIQUE ROOM CODE
       ===================================================== */

    function generateRoomCode() {

        const timestamp =
            Date.now()
                .toString(36)
                .toUpperCase();


        const random =
            Math.random()
                .toString(36)
                .slice(
                    2,
                    8
                )
                .toUpperCase();


        return (
            `MW-${timestamp}-${random}`
        );

    }


    /* =====================================================
       5. CALL UI
       ===================================================== */

    function createCallUI() {

        if (
            byId(
                "mwanikiCallInterface"
            )
        ) {

            return;

        }


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.id =
            "mwanikiCallInterface";


        wrapper.innerHTML = `

            <div
                class="mwaniki-call-backdrop"
                data-call-backdrop
            >

                <section
                    class="mwaniki-call-window"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mwanikiCallTitle"
                >

                    <header
                        class="mwaniki-call-header"
                    >

                        <div>

                            <strong
                                id="mwanikiCallTitle"
                            >
                                Mwaniki Call
                            </strong>

                            <small
                                id="mwanikiCallStatus"
                            >
                                Connecting...
                            </small>

                        </div>


                        <button
                            type="button"
                            id="mwanikiCloseCallButton"
                            title="Close"
                        >
                            ×
                        </button>

                    </header>


                    <main
                        class="mwaniki-call-videos"
                        id="mwanikiCallVideos"
                    >

                        <div
                            class="mwaniki-video-tile local"
                            id="mwanikiLocalVideoTile"
                        >

                            <video
                                id="mwanikiLocalVideo"
                                autoplay
                                muted
                                playsinline
                            ></video>


                            <div
                                class="mwaniki-video-label"
                            >
                                You
                            </div>

                        </div>

                    </main>


                    <div
                        class="mwaniki-call-controls"
                    >

                        <button
                            type="button"
                            id="mwanikiMuteButton"
                            title="Mute microphone"
                        >
                            🎙️
                        </button>


                        <button
                            type="button"
                            id="mwanikiCameraButton"
                            title="Turn camera off"
                        >
                            📷
                        </button>


                        <button
                            type="button"
                            id="mwanikiScreenButton"
                            title="Share screen"
                        >
                            🖥️
                        </button>


                        <button
                            type="button"
                            id="mwanikiLeaveCallButton"
                            class="danger"
                            title="Leave call"
                        >
                            📞
                        </button>

                    </div>

                </section>

            </div>

        `;


        document.body.appendChild(
            wrapper
        );


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "mwaniki-call-styles";


        style.textContent = `

            #mwanikiCallInterface{
                position:fixed;
                inset:0;
                z-index:99999;
                display:none;
            }

            #mwanikiCallInterface.active{
                display:block;
            }

            .mwaniki-call-backdrop{
                position:absolute;
                inset:0;
                background:rgba(5,18,24,.88);
                backdrop-filter:blur(10px);
                display:flex;
                align-items:center;
                justify-content:center;
                padding:20px;
            }

            .mwaniki-call-window{
                width:min(1100px,100%);
                height:min(820px,95vh);
                background:#07181d;
                color:#fff;
                border-radius:20px;
                overflow:hidden;
                display:flex;
                flex-direction:column;
                box-shadow:0 25px 80px rgba(0,0,0,.45);
            }

            .mwaniki-call-header{
                min-height:70px;
                padding:16px 20px;
                display:flex;
                align-items:center;
                justify-content:space-between;
                background:#0b2429;
                border-bottom:1px solid rgba(255,255,255,.08);
            }

            .mwaniki-call-header strong{
                display:block;
                font-size:1.05rem;
            }

            .mwaniki-call-header small{
                display:block;
                margin-top:4px;
                opacity:.65;
            }

            .mwaniki-call-header button{
                border:0;
                background:rgba(255,255,255,.08);
                color:#fff;
                width:40px;
                height:40px;
                border-radius:50%;
                font-size:24px;
                cursor:pointer;
            }

            .mwaniki-call-videos{
                flex:1;
                padding:16px;
                display:grid;
                grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
                gap:14px;
                overflow:auto;
                align-content:center;
            }

            .mwaniki-video-tile{
                position:relative;
                min-height:210px;
                aspect-ratio:16/10;
                background:#102a30;
                border-radius:16px;
                overflow:hidden;
                border:1px solid rgba(255,255,255,.08);
            }

            .mwaniki-video-tile video{
                width:100%;
                height:100%;
                object-fit:cover;
                display:block;
                background:#0b2025;
            }

            .mwaniki-video-label{
                position:absolute;
                left:10px;
                bottom:10px;
                padding:6px 10px;
                border-radius:8px;
                background:rgba(0,0,0,.6);
                font-size:.82rem;
            }

            .mwaniki-call-controls{
                padding:16px;
                display:flex;
                justify-content:center;
                gap:12px;
                background:#0b2429;
                border-top:1px solid rgba(255,255,255,.08);
            }

            .mwaniki-call-controls button{
                width:52px;
                height:52px;
                border:0;
                border-radius:50%;
                cursor:pointer;
                background:#183940;
                color:#fff;
                font-size:20px;
            }

            .mwaniki-call-controls button:hover{
                transform:translateY(-1px);
                background:#21515a;
            }

            .mwaniki-call-controls button.danger{
                background:#c73545;
            }

            .mwaniki-recipient-overlay{
                position:fixed;
                inset:0;
                z-index:100000;
                background:rgba(0,0,0,.68);
                display:flex;
                align-items:center;
                justify-content:center;
                padding:20px;
            }

            .mwaniki-recipient-panel{
                width:min(620px,100%);
                max-height:85vh;
                overflow:hidden;
                background:#fff;
                color:#13252a;
                border-radius:18px;
                box-shadow:0 25px 70px rgba(0,0,0,.35);
                display:flex;
                flex-direction:column;
            }

            .mwaniki-recipient-header{
                padding:18px 20px;
                border-bottom:1px solid #e7eeee;
                display:flex;
                justify-content:space-between;
                align-items:center;
            }

            .mwaniki-recipient-header button{
                border:0;
                background:transparent;
                font-size:24px;
                cursor:pointer;
            }

            .mwaniki-recipient-search{
                padding:12px 16px;
                border-bottom:1px solid #e7eeee;
            }

            .mwaniki-recipient-search input{
                width:100%;
                box-sizing:border-box;
                padding:11px 13px;
                border:1px solid #d5e1e2;
                border-radius:10px;
                outline:none;
            }

            .mwaniki-recipient-list{
                overflow:auto;
                padding:10px;
                flex:1;
            }

            .mwaniki-recipient-item{
                display:flex;
                align-items:center;
                gap:12px;
                padding:10px;
                border-radius:12px;
                cursor:pointer;
            }

            .mwaniki-recipient-item:hover{
                background:#f0f7f6;
            }

            .mwaniki-recipient-item input{
                width:18px;
                height:18px;
            }

            .mwaniki-recipient-avatar{
                width:42px;
                height:42px;
                flex:none;
                border-radius:50%;
                object-fit:cover;
                background:#087f73;
                color:#fff;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:700;
            }

            .mwaniki-recipient-info{
                flex:1;
                min-width:0;
            }

            .mwaniki-recipient-name{
                font-weight:700;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
            }

            .mwaniki-recipient-role{
                font-size:.78rem;
                color:#6c7e80;
                margin-top:2px;
            }

            .mwaniki-online-dot{
                width:9px;
                height:9px;
                border-radius:50%;
                background:#24b47e;
            }

            .mwaniki-recipient-footer{
                padding:14px 16px;
                border-top:1px solid #e7eeee;
                display:flex;
                justify-content:flex-end;
                gap:10px;
            }

            .mwaniki-recipient-footer button{
                border:0;
                border-radius:10px;
                padding:11px 16px;
                cursor:pointer;
                font-weight:700;
            }

            .mwaniki-recipient-footer .cancel{
                background:#edf2f2;
            }

            .mwaniki-recipient-footer .start{
                background:#087f73;
                color:#fff;
            }

            .mwaniki-incoming-call{
                position:fixed;
                right:20px;
                bottom:20px;
                z-index:100001;
                width:min(380px,calc(100vw - 40px));
                background:#fff;
                color:#173035;
                border-radius:16px;
                padding:18px;
                box-shadow:0 20px 60px rgba(0,0,0,.3);
            }

            .mwaniki-incoming-call strong{
                display:block;
                font-size:1rem;
            }

            .mwaniki-incoming-call p{
                margin:7px 0 15px;
                color:#657779;
            }

            .mwaniki-incoming-actions{
                display:flex;
                gap:10px;
            }

            .mwaniki-incoming-actions button{
                flex:1;
                border:0;
                border-radius:10px;
                padding:10px;
                cursor:pointer;
                font-weight:700;
            }

            .mwaniki-incoming-accept{
                background:#087f73;
                color:#fff;
            }

            .mwaniki-incoming-decline{
                background:#e9eeee;
                color:#243538;
            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* =====================================================
       6. MEDIA
       ===================================================== */

    async function requestMedia(
        type
    ) {

        if (
            callState.localStream
        ) {

            return callState.localStream;

        }


        const video =
            type === "video";


        try {

            callState.localStream =
                await navigator
                    .mediaDevices
                    .getUserMedia({

                        audio: true,

                        video

                    });


            callState.mediaReady =
                true;


            callState.cameraOn =
                video;


            attachLocalStream();


            return callState.localStream;

        } catch (error) {

            console.error(
                "❌ Camera/microphone access failed:",
                error
            );


            /*
             * For audio calls, retry microphone only.
             */

            if (video) {

                try {

                    callState.localStream =
                        await navigator
                            .mediaDevices
                            .getUserMedia({

                                audio: true,

                                video: false

                            });


                    callState.mediaReady =
                        true;

                    callState.cameraOn =
                        false;

                    attachLocalStream();


                    callToast(
                        "Camera unavailable. Continuing with microphone.",
                        "normal"
                    );


                    return callState.localStream;

                } catch (audioError) {

                    console.error(
                        "❌ Microphone access failed:",
                        audioError
                    );

                }

            }


            callToast(
                "Microphone/camera permission is required for calls.",
                "error"
            );


            return null;

        }

    }


    function stopStream(
        stream
    ) {

        if (!stream) return;


        stream
            .getTracks()
            .forEach(
                track => {

                    try {

                        track.stop();

                    } catch (_) {}

                }
            );

    }


    function attachLocalStream() {

        const video =
            byId(
                "mwanikiLocalVideo"
            );


        if (!video) return;


        if (
            callState.localStream
        ) {

            video.srcObject =
                callState.localStream;

        }

    }


    /* =====================================================
       7. ROOM CREATION
       ===================================================== */

    async function createCallRoom({
        communityId = null,
        scope = "general",
        type = "video"
    } = {}) {

        const client =
            await getDB();


        if (!client) {

            throw new Error(
                "Supabase client unavailable."
            );

        }


        if (
            !currentUserId()
        ) {

            throw new Error(
                "You must be signed in."
            );

        }


        const roomCode =
            generateRoomCode();


        /*
         * EXACT chat_call_rooms schema.
         */

        const payload = {

            community_id:
                communityId || null,

            room_code:
                roomCode,

            call_scope:
                scope,

            call_type:
                type,

            status:
                "waiting",

            created_by:
                currentUserId()

        };


        console.log(
            "📞 Creating call room:",
            payload
        );


        const {
            data,
            error
        } =
            await client

                .from(
                    "chat_call_rooms"
                )

                .insert(
                    payload
                )

                .select(
                    "*"
                )

                .single();


        if (error) {

            console.error(
                "❌ Call room creation failed:",
                error
            );

            throw error;

        }


        console.log(
            "✅ Call room created:",
            data
        );


        return data;

    }


    /* =====================================================
       8. PARTICIPANT INSERTION
       ===================================================== */

    async function addCallParticipants(
        roomId,
        userIds
    ) {

        const client =
            await getDB();


        if (!client) {

            throw new Error(
                "Supabase client unavailable."
            );

        }


        const uniqueIds =
            [
                ...new Set(

                    [
                        currentUserId(),

                        ...(userIds || [])

                    ]
                        .filter(Boolean)
                        .map(
                            String
                        )

                )
            ];


        const rows =
            uniqueIds.map(
                userId => ({

                    room_id:
                        roomId,

                    user_id:
                        userId,

                    status:
                        String(
                            userId
                        ) ===
                        String(
                            currentUserId()
                        )
                            ? "joined"
                            : "invited",

                    is_muted:
                        false,

                    is_camera_on:
                        false,

                    is_screen_sharing:
                        false

                })
            );


        /*
         * EXACT chat_call_participants schema.
         */

        const {
            data,
            error
        } =
            await client

                .from(
                    "chat_call_participants"
                )

                .insert(
                    rows
                )

                .select(
                    "*"
                );


        if (error) {

            console.error(
                "❌ Call participant creation failed:",
                error
            );

            throw error;

        }


        return data || [];

    }


    /* =====================================================
       9. UPDATE ROOM STATUS
       ===================================================== */

    async function updateRoomStatus(
        roomId,
        status
    ) {

        if (!roomId) return;


        const client =
            await getDB();


        if (!client) return;


        const updates = {

            status

        };


        if (
            status === "active"
        ) {

            updates.started_at =
                new Date()
                    .toISOString();

        }


        if (
            status === "ended"
        ) {

            updates.ended_at =
                new Date()
                    .toISOString();

        }


        const {
            error
        } =
            await client

                .from(
                    "chat_call_rooms"
                )

                .update(
                    updates
                )

                .eq(
                    "id",
                    roomId
                );


        if (error) {

            console.warn(
                "⚠️ Call room status update failed:",
                error
            );

        }

    }


    /* =====================================================
       10. OPEN RECIPIENT PICKER
       ===================================================== */

    async function openRecipientPicker({
        mode = "direct",
        callType = "video",
        communityOnly = false
    } = {}) {

        const users =
            await loadOnlineUsers({
                communityOnly
            });


        if (!users.length) {

            callToast(
                "There are no online users available for a call.",
                "normal"
            );

            return;

        }


        const overlay =
            document.createElement(
                "div"
            );


        overlay.className =
            "mwaniki-recipient-overlay";


        overlay.id =
            "mwanikiRecipientPicker";


        overlay.innerHTML = `

            <section
                class="mwaniki-recipient-panel"
            >

                <header
                    class="mwaniki-recipient-header"
                >

                    <div>

                        <strong>
                            ${
                                mode === "general"
                                    ? "Start General Call"
                                    : "Choose People to Call"
                            }
                        </strong>

                        <div
                            style="font-size:.82rem;color:#718183;margin-top:3px"
                        >
                            Select the online users you want to invite.
                        </div>

                    </div>


                    <button
                        type="button"
                        data-recipient-close
                    >
                        ×
                    </button>

                </header>


                <div
                    class="mwaniki-recipient-search"
                >

                    <input
                        type="search"
                        id="mwanikiRecipientSearch"
                        placeholder="Search online users..."
                    >

                </div>


                <div
                    class="mwaniki-recipient-list"
                    id="mwanikiRecipientList"
                ></div>


                <footer
                    class="mwaniki-recipient-footer"
                >

                    <button
                        type="button"
                        class="cancel"
                        data-recipient-close
                    >
                        Cancel
                    </button>


                    <button
                        type="button"
                        class="start"
                        id="mwanikiStartSelectedCall"
                    >
                        📞 Start Call
                    </button>

                </footer>

            </section>

        `;


        document.body.appendChild(
            overlay
        );


        callState.recipientPicker =
            overlay;


        renderRecipientUsers(
            users
        );


        const search =
            byId(
                "mwanikiRecipientSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                () => {

                    const term =
                        search.value
                            .trim()
                            .toLowerCase();


                    renderRecipientUsers(
                        users.filter(
                            user =>
                                user.name
                                    .toLowerCase()
                                    .includes(
                                        term
                                    )
                        )
                    );

                }
            );

        }


        overlay
            .querySelectorAll(
                "[data-recipient-close]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        closeRecipientPicker
                    );

                }
            );


        const start =
            byId(
                "mwanikiStartSelectedCall"
            );


        if (start) {

            start.addEventListener(
                "click",
                async () => {

                    const selected =
                        [
                            ...overlay
                                .querySelectorAll(
                                    "input[type='checkbox']:checked"
                                )
                        ]
                            .map(
                                input =>
                                    input.value
                            );


                    if (!selected.length) {

                        callToast(
                            "Select at least one online user.",
                            "error"
                        );

                        return;

                    }


                    closeRecipientPicker();


                    if (
                        mode ===
                        "general"
                    ) {

                        await startGeneralCall(
                            selected,
                            callType
                        );

                    } else {

                        await startDirectCall(
                            selected,
                            callType
                        );

                    }

                }
            );

        }

    }


    /* =====================================================
       11. ONLINE USERS
       ===================================================== */

    async function loadOnlineUsers({
        communityOnly = false
    } = {}) {

        const client =
            await getDB();


        if (!client) {

            return [];

        }


        const me =
            currentUserId();


        let userIds = [];


        /*
         * Presence table contains ONLY:
         *
         * user_id
         * status
         * custom_status
         * last_seen_at
         * updated_at
         */

        const {
            data: presenceRows,
            error: presenceError
        } =
            await client

                .from(
                    "chat_presence"
                )

                .select(
                    "user_id,status,custom_status,last_seen_at,updated_at"
                )

                .eq(
                    "status",
                    "online"
                );


        if (presenceError) {

            console.error(
                "❌ Online presence lookup failed:",
                presenceError
            );

            return [];

        }


        userIds =
            (
                presenceRows ||
                []
            )

                .map(
                    row =>
                        row.user_id
                )

                .filter(
                    id =>
                        id &&
                        String(id) !==
                        String(me)
                );


        /*
         * General Call:
         * all online users.
         *
         * Community Call:
         * restrict to current community members.
         */

        if (
            communityOnly &&
            state.currentCommunity?.id &&
            userIds.length
        ) {

            const {
                data: members,
                error
            } =
                await client

                    .from(
                        "chat_community_members"
                    )

                    .select(
                        "user_id,is_banned"
                    )

                    .eq(
                        "community_id",
                        state.currentCommunity.id
                    )

                    .in(
                        "user_id",
                        userIds
                    );


            if (error) {

                console.warn(
                    "⚠️ Community online-user lookup failed:",
                    error
                );

            } else {

                const allowed =
                    new Set(

                        (
                            members ||
                            []
                        )

                            .filter(
                                member =>
                                    !member.is_banned
                            )

                            .map(
                                member =>
                                    String(
                                        member.user_id
                                    )
                            )

                    );


                userIds =
                    userIds.filter(
                        id =>
                            allowed.has(
                                String(id)
                            )
                    );

            }

        }


        if (!userIds.length) {

            return [];

        }


        const {
            data: profiles,
            error: profileError
        } =
            await client

                .from(
                    "students"
                )

                .select("*")

                .in(
                    "id",
                    userIds
                );


        if (profileError) {

            console.warn(
                "⚠️ Online user profile lookup failed:",
                profileError
            );

            return [];

        }


        const presenceMap =
            new Map();


        (
            presenceRows ||
            []
        ).forEach(
            row => {

                presenceMap.set(
                    String(
                        row.user_id
                    ),
                    row
                );

            }
        );


        return (

            profiles || []

        ).map(
            profile => {

                const id =
                    String(
                        profile.id
                    );


                const presence =
                    presenceMap.get(
                        id
                    ) ||
                    {};


                const name =

                    profile.full_name ||

                    profile.name ||

                    profile.student_name ||

                    profile.display_name ||

                    profile.username ||

                    `Scholar ${id.slice(0, 6)}`;


                const photo =

                    profile.photo_url ||

                    profile.profile_photo ||

                    profile.profile_image ||

                    profile.avatar_url ||

                    profile.image_url ||

                    profile.photo ||

                    "";


                return {

                    id,

                    name,

                    photo,

                    role:
                        presence.custom_status ||
                        "Online",

                    status:
                        presence.status,

                    lastSeen:
                        presence.last_seen_at

                };

            }
        );

    }


    /* =====================================================
       12. RECIPIENT RENDERING
       ===================================================== */

    function renderRecipientUsers(
        users
    ) {

        const list =
            byId(
                "mwanikiRecipientList"
            );


        if (!list) return;


        if (!users.length) {

            list.innerHTML = `

                <div
                    style="
                        padding:30px;
                        text-align:center;
                        color:#718183;
                    "
                >
                    No matching online users.
                </div>

            `;

            return;

        }


        list.innerHTML =
            users
                .map(
                    user => {

                        const photo =
                            safeURL(
                                user.photo
                            );


                        return `

                            <label
                                class="mwaniki-recipient-item"
                            >

                                <input
                                    type="checkbox"
                                    value="${escapeHTML(
                                        user.id
                                    )}"
                                >


                                ${
                                    photo

                                        ? `

                                            <img
                                                class="mwaniki-recipient-avatar"
                                                src="${escapeHTML(
                                                    photo
                                                )}"
                                                alt="${escapeHTML(
                                                    user.name
                                                )}"
                                            >

                                          `

                                        : `

                                            <span
                                                class="mwaniki-recipient-avatar"
                                            >
                                                ${escapeHTML(
                                                    initials(
                                                        user.name
                                                    )
                                                )}
                                            </span>

                                          `
                                }


                                <span
                                    class="mwaniki-recipient-info"
                                >

                                    <span
                                        class="mwaniki-recipient-name"
                                    >
                                        ${escapeHTML(
                                            user.name
                                        )}
                                    </span>

                                    <span
                                        class="mwaniki-recipient-role"
                                    >
                                        ${escapeHTML(
                                            user.role
                                        )}
                                    </span>

                                </span>


                                <span
                                    class="mwaniki-online-dot"
                                ></span>

                            </label>

                        `;

                    }
                )
                .join("");

    }


    function closeRecipientPicker() {

        const picker =
            callState.recipientPicker;


        if (picker) {

            picker.remove();

        }


        callState.recipientPicker =
            null;

    }


    /* =====================================================
       13. START COMMUNITY CALL
       ===================================================== */

    async function startCommunityCall(
        callType = "video"
    ) {

        if (
            !state.currentCommunity?.id
        ) {

            callToast(
                "Select a community first.",
                "error"
            );

            return;

        }


        await openRecipientPicker({

            mode:
                "direct",

            callType,

            communityOnly:
                true

        });

    }


    /* =====================================================
       14. START DIRECT CALL
       ===================================================== */

    async function startDirectCall(
        userIds,
        callType = "video"
    ) {

        if (
            !userIds?.length
        ) {

            return;

        }


        try {

            const room =
                await createCallRoom({

                    communityId:
                        state.currentCommunity
                            ?.id ||
                        null,

                    scope:
                        "direct",

                    type:
                        callType

                });


            await addCallParticipants(
                room.id,
                userIds
            );


            await beginCall(
                room,
                callType,
                "direct"
            );


        } catch (error) {

            console.error(
                "❌ Direct call failed:",
                error
            );


            callToast(
                "Unable to start the call.",
                "error"
            );

        }

    }


    /* =====================================================
       15. GENERAL CALL
       ===================================================== */

    async function openGeneralCall(
        callType = "video"
    ) {

        /*
         * IMPORTANT:
         *
         * General Call is independent from
         * communities.
         *
         * community_id = null.
         */

        await openRecipientPicker({

            mode:
                "general",

            callType,

            communityOnly:
                false

        });

    }


    async function startGeneralCall(
        userIds,
        callType = "video"
    ) {

        try {

            const room =
                await createCallRoom({

                    communityId:
                        null,

                    scope:
                        "general",

                    type:
                        callType

                });


            await addCallParticipants(
                room.id,
                userIds
            );


            await beginCall(
                room,
                callType,
                "general"
            );


        } catch (error) {

            console.error(
                "❌ General call failed:",
                error
            );


            callToast(
                "Unable to start General Call.",
                "error"
            );

        }

    }


    /* =====================================================
       16. BEGIN CALL
       ===================================================== */

    async function beginCall(
        room,
        callType,
        scope
    ) {

        callState.activeRoom =
            room;


        callState.roomId =
            room.id;


        callState.roomCode =
            room.room_code;


        callState.callType =
            callType;


        callState.callScope =
            scope;


        callState.active =
            true;


        callState.startedAt =
            new Date();


        createCallUI();


        const stream =
            await requestMedia(
                callType
            );


        if (!stream) {

            await leaveCall(
                false
            );

            return;

        }


        showCallUI();


        await updateRoomStatus(
            room.id,
            "active"
        );


        subscribeToCall(
            room.id
        );


        await markSelfJoined(
            room.id
        );


        await loadCallParticipants(
            room.id
        );


        callToast(
            "Call started.",
            "success"
        );

    }


    /* =====================================================
       17. CALL UI
       ===================================================== */

    function showCallUI() {

        const wrapper =
            byId(
                "mwanikiCallInterface"
            );


        if (!wrapper) return;


        wrapper.classList.add(
            "active"
        );


        setCallStatus(
            "Connected"
        );


        const title =
            byId(
                "mwanikiCallTitle"
            );


        if (title) {

            title.textContent =

                callState.callScope ===
                    "general"

                    ? "General Call"

                    : state.currentCommunity
                        ?.name ||
                      "Community Call";

        }


        attachLocalStream();

    }


    function hideCallUI() {

        const wrapper =
            byId(
                "mwanikiCallInterface"
            );


        if (!wrapper) return;


        wrapper.classList.remove(
            "active"
        );

    }


    function setCallStatus(
        text
    ) {

        const element =
            byId(
                "mwanikiCallStatus"
            );


        if (element) {

            element.textContent =
                text || "";

        }

    }


    /* =====================================================
       18. MARK SELF JOINED
       ===================================================== */

    async function markSelfJoined(
        roomId
    ) {

        const client =
            await getDB();


        if (!client) return;


        const {
            error
        } =
            await client

                .from(
                    "chat_call_participants"
                )

                .update({

                    status:
                        "joined",

                    joined_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "room_id",
                    roomId
                )

                .eq(
                    "user_id",
                    currentUserId()
                );


        if (error) {

            console.warn(
                "⚠️ Unable to mark call participant joined:",
                error
            );

        }

    }


    /* =====================================================
       19. LOAD PARTICIPANTS
       ===================================================== */

    async function loadCallParticipants(
        roomId
    ) {

        const client =
            await getDB();


        if (!client) return [];


        const {
            data,
            error
        } =
            await client

                .from(
                    "chat_call_participants"
                )

                .select(
                    "*"
                )

                .eq(
                    "room_id",
                    roomId
                );


        if (error) {

            console.error(
                "❌ Call participant loading failed:",
                error
            );

            return [];

        }


        (
            data || []
        ).forEach(
            participant => {

                callState.participants.set(
                    String(
                        participant.user_id
                    ),
                    participant
                );

            }
        );


        /*
         * The creator waits for invited peers.
         * We do not create peer connections until
         * a signal arrives.
         */

        return data || [];

    }


    /* =====================================================
       20. WEBRTC PEER CREATION
       ===================================================== */

    function createPeerConnection(
        remoteUserId
    ) {

        const existing =
            callState.peers.get(
                String(
                    remoteUserId
                )
            );


        if (existing) {

            return existing;

        }


        const peer =
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


        if (
            callState.localStream
        ) {

            callState.localStream
                .getTracks()
                .forEach(
                    track => {

                        peer.addTrack(
                            track,
                            callState.localStream
                        );

                    }
                );

        }


        peer.onicecandidate =
            event => {

                if (
                    event.candidate
                ) {

                    sendSignal(
                        remoteUserId,
                        "ice-candidate",
                        event.candidate
                    );

                }

            };


        peer.ontrack =
            event => {

                attachRemoteStream(
                    remoteUserId,
                    event.streams[0]
                );

            };


        peer.onconnectionstatechange =
            () => {

                const status =
                    peer.connectionState;


                console.log(
                    "📡 Peer connection:",
                    remoteUserId,
                    status
                );


                if (
                    status ===
                        "failed" ||

                    status ===
                        "closed"
                ) {

                    removeRemoteVideo(
                        remoteUserId
                    );

                }

            };


        callState.peers.set(
            String(
                remoteUserId
            ),
            peer
        );


        return peer;

    }


    /* =====================================================
       21. OFFER
       ===================================================== */

    async function createOfferFor(
        remoteUserId
    ) {

        if (
            !remoteUserId ||
            String(
                remoteUserId
            ) ===
            String(
                currentUserId()
            )
        ) {

            return;

        }


        const peer =
            createPeerConnection(
                remoteUserId
            );


        try {

            const offer =
                await peer.createOffer();


            await peer.setLocalDescription(
                offer
            );


            await sendSignal(
                remoteUserId,
                "offer",
                offer
            );

        } catch (error) {

            console.error(
                "❌ WebRTC offer failed:",
                error
            );

        }

    }


    /* =====================================================
       22. ANSWER
       ===================================================== */

    async function answerOffer(
        remoteUserId,
        offer
    ) {

        const peer =
            createPeerConnection(
                remoteUserId
            );


        try {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    offer
                )
            );


            const answer =
                await peer.createAnswer();


            await peer.setLocalDescription(
                answer
            );


            await sendSignal(
                remoteUserId,
                "answer",
                answer
            );

        } catch (error) {

            console.error(
                "❌ WebRTC answer failed:",
                error
            );

        }

    }


    /* =====================================================
       23. SIGNALING
       ===================================================== */

    async function sendSignal(
        receiverId,
        signalType,
        payload
    ) {

        const client =
            await getDB();


        if (
            !client ||
            !callState.roomId
        ) {

            return;

        }


        const row = {

            room_id:
                callState.roomId,

            sender_id:
                currentUserId(),

            receiver_id:
                receiverId ||
                null,

            signal_type:
                signalType,

            payload:
                payload || {}

        };


        const {
            error
        } =
            await client

                .from(
                    "chat_call_signals"
                )

                .insert(
                    row
                );


        if (error) {

            console.error(
                "❌ Call signal failed:",
                error
            );

        }

    }


    /* =====================================================
       24. CALL REALTIME
       ===================================================== */

    async function subscribeToCall(
        roomId
    ) {

        const client =
            await getDB();


        if (!client) return;


        cleanupCallSubscriptions();


        callState.signalChannel =
            client

                .channel(
                    `mwaniki-call-signals-${roomId}`
                )

                .on(

                    "postgres_changes",

                    {

                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_call_signals",

                        filter:
                            `room_id=eq.${roomId}`

                    },

                    payload => {

                        handleIncomingSignal(
                            payload.new
                        );

                    }

                )

                .subscribe(
                    status => {

                        console.log(
                            "📡 Call signal realtime:",
                            status
                        );

                    }
                );


        callState.participantChannel =
            client

                .channel(
                    `mwaniki-call-participants-${roomId}`
                )

                .on(

                    "postgres_changes",

                    {

                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_call_participants",

                        filter:
                            `room_id=eq.${roomId}`

                    },

                    payload => {

                        handleParticipantRealtime(
                            payload
                        );

                    }

                )

                .subscribe();


        callState.roomChannel =
            client

                .channel(
                    `mwaniki-call-room-${roomId}`
                )

                .on(

                    "postgres_changes",

                    {

                        event:
                            "UPDATE",

                        schema:
                            "public",

                        table:
                            "chat_call_rooms",

                        filter:
                            `id=eq.${roomId}`

                    },

                    payload => {

                        handleRoomRealtime(
                            payload.new
                        );

                    }

                )

                .subscribe();

    }


    /* =====================================================
       25. INCOMING SIGNAL
       ===================================================== */

    async function handleIncomingSignal(
        signal
    ) {

        if (!signal) return;


        if (
            String(
                signal.receiver_id
            ) !==
            String(
                currentUserId()
            )
        ) {

            return;

        }


        const senderId =
            String(
                signal.sender_id
            );


        if (
            senderId ===
            String(
                currentUserId()
            )
        ) {

            return;

        }


        const type =
            signal.signal_type;


        const payload =
            signal.payload;


        try {

            if (
                type ===
                "offer"
            ) {

                if (
                    !callState.active
                ) {

                    return;

                }


                await answerOffer(
                    senderId,
                    payload
                );


                return;

            }


            if (
                type ===
                "answer"
            ) {

                const peer =
                    createPeerConnection(
                        senderId
                    );


                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        payload
                    )
                );


                return;

            }


            if (
                type ===
                "ice-candidate"
            ) {

                const peer =
                    createPeerConnection(
                        senderId
                    );


                if (
                    peer.remoteDescription
                ) {

                    await peer.addIceCandidate(
                        new RTCIceCandidate(
                            payload
                        )
                    );

                }

                return;

            }


            if (
                type ===
                "call-invite"
            ) {

                showIncomingCall(
                    signal.room_id,
                    payload
                );

            }

        } catch (error) {

            console.error(
                "❌ Incoming call signal handling failed:",
                error
            );

        }

    }


    /* =====================================================
       26. PARTICIPANT REALTIME
       ===================================================== */

    async function handleParticipantRealtime(
        payload
    ) {

        const participant =
            payload.new ||
            payload.old;


        if (!participant) return;


        const userId =
            String(
                participant.user_id
            );


        callState.participants.set(
            userId,
            participant
        );


        if (
            payload.eventType ===
                "INSERT" &&

            userId !==
                String(
                    currentUserId()
                ) &&

            participant.status ===
                "invited"
        ) {

            await notifyIncomingParticipant(
                participant
            );

        }


        if (
            payload.eventType ===
                "UPDATE" &&

            participant.status ===
                "joined" &&

            userId !==
                String(
                    currentUserId()
                )
        ) {

            setCallStatus(
                "Participant joined"
            );

            /*
             * Existing call participants can
             * establish a peer connection.
             */

            if (
                String(
                    callState.activeRoom
                        ?.created_by
                ) ===
                String(
                    currentUserId()
                )
            ) {

                await createOfferFor(
                    userId
                );

            }

        }


        if (
            participant.status ===
                "left"
        ) {

            removeRemoteVideo(
                userId
            );

        }

    }


    async function notifyIncomingParticipant(
        participant
    ) {

        if (
            String(
                participant.user_id
            ) ===
            String(
                currentUserId()
            )
        ) {

            return;

        }


        /*
         * The participant is invited by the room creator.
         * Realtime participant INSERT is enough to
         * notify the browser.
         */

        const client =
            await getDB();


        if (!client) return;


        const {
            data: room,
            error
        } =
            await client

                .from(
                    "chat_call_rooms"
                )

                .select(
                    "*"
                )

                .eq(
                    "id",
                    participant.room_id
                )

                .maybeSingle();


        if (
            error ||
            !room
        ) {

            return;

        }


        if (
            room.status ===
                "ended"
        ) {

            return;

        }


        const {
            data: creator
        } =
            await client

                .from(
                    "students"
                )

                .select("*")
                .eq(
                    "id",
                    room.created_by
                )
                .maybeSingle();


        const creatorName =

            creator?.full_name ||

            creator?.name ||

            creator?.student_name ||

            creator?.display_name ||

            "Mwaniki Scholar";


        showIncomingCall(
            room.id,
            {

                callerName:
                    creatorName,

                callType:
                    room.call_type,

                scope:
                    room.call_scope,

                roomCode:
                    room.room_code

            }
        );

    }


    /* =====================================================
       27. INCOMING CALL UI
       ===================================================== */

    function showIncomingCall(
        roomId,
        details
    ) {

        if (
            byId(
                `incomingCall-${roomId}`
            )
        ) {

            return;

        }


        const element =
            document.createElement(
                "div"
            );


        element.className =
            "mwaniki-incoming-call";


        element.id =
            `incomingCall-${roomId}`;


        element.innerHTML = `

            <strong>
                📞 Incoming ${
                    details?.callType ===
                        "audio"
                        ? "voice"
                        : "video"
                } call
            </strong>

            <p>
                ${escapeHTML(
                    details?.callerName ||
                    "Mwaniki Scholar"
                )}
                is calling you.
            </p>

            <div
                class="mwaniki-incoming-actions"
            >

                <button
                    type="button"
                    class="mwaniki-incoming-decline"
                    data-decline-call
                >
                    Decline
                </button>


                <button
                    type="button"
                    class="mwaniki-incoming-accept"
                    data-accept-call
                >
                    Accept
                </button>

            </div>

        `;


        document.body.appendChild(
            element
        );


        element
            .querySelector(
                "[data-decline-call]"
            )
            .addEventListener(
                "click",
                async () => {

                    element.remove();

                    await declineIncomingCall(
                        roomId
                    );

                }
            );


        element
            .querySelector(
                "[data-accept-call]"
            )
            .addEventListener(
                "click",
                async () => {

                    element.remove();

                    await acceptIncomingCall(
                        roomId
                    );

                }
            );


        callState.incomingCalls.set(
            String(roomId),
            element
        );

    }


    /* =====================================================
       28. ACCEPT INCOMING CALL
       ===================================================== */

    async function acceptIncomingCall(
        roomId
    ) {

        const client =
            await getDB();


        if (!client) return;


        const {
            data: room,
            error
        } =
            await client

                .from(
                    "chat_call_rooms"
                )

                .select("*")
                .eq(
                    "id",
                    roomId
                )
                .maybeSingle();


        if (
            error ||
            !room
        ) {

            callToast(
                "This call is no longer available.",
                "error"
            );

            return;

        }


        if (
            room.status ===
                "ended"
        ) {

            callToast(
                "This call has ended.",
                "error"
            );

            return;

        }


        callState.activeRoom =
            room;


        callState.roomId =
            room.id;


        callState.roomCode =
            room.room_code;


        callState.callType =
            room.call_type ||
            "video";


        callState.callScope =
            room.call_scope ||
            "general";


        callState.active =
            true;


        const stream =
            await requestMedia(
                callState.callType
            );


        if (!stream) {

            return;

        }


        createCallUI();

        showCallUI();


        await client

            .from(
                "chat_call_participants"
            )

            .update({

                status:
                    "joined",

                joined_at:
                    new Date()
                        .toISOString(),

                is_camera_on:
                    callState.callType ===
                    "video"

            })

            .eq(
                "room_id",
                roomId
            )

            .eq(
                "user_id",
                currentUserId()
            );


        subscribeToCall(
            roomId
        );


        await loadCallParticipants(
            roomId
        );


        setCallStatus(
            "Joined call"
        );


        /*
         * Tell the room creator that we are ready.
         */

        if (
            room.created_by &&
            String(
                room.created_by
            ) !==
            String(
                currentUserId()
            )
        ) {

            await sendSignal(
                room.created_by,
                "call-ready",
                {

                    userId:
                        currentUserId()

                }
            );

        }

    }


    /* =====================================================
       29. DECLINE
       ===================================================== */

    async function declineIncomingCall(
        roomId
    ) {

        const client =
            await getDB();


        if (!client) return;


        const {
            error
        } =
            await client

                .from(
                    "chat_call_participants"
                )

                .update({

                    status:
                        "declined",

                    left_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "room_id",
                    roomId
                )

                .eq(
                    "user_id",
                    currentUserId()
                );


        if (error) {

            console.warn(
                "⚠️ Unable to decline call:",
                error
            );

        }

    }


    /* =====================================================
       30. ROOM REALTIME
       ===================================================== */

    function handleRoomRealtime(
        room
    ) {

        if (!room) return;


        if (
            String(
                room.id
            ) !==
            String(
                callState.roomId
            )
        ) {

            return;

        }


        if (
            room.status ===
                "ended"
        ) {

            callToast(
                "The call has ended."
            );


            leaveCall(
                false
            );

        }

    }


    /* =====================================================
       31. REMOTE VIDEO
       ===================================================== */

    function attachRemoteStream(
        userId,
        stream
    ) {

        if (!stream) return;


        const container =
            byId(
                "mwanikiCallVideos"
            );


        if (!container) return;


        const safeId =
            String(
                userId
            )
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_"
                );


        let tile =
            byId(
                `remoteVideo-${safeId}`
            );


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );


            tile.className =
                "mwaniki-video-tile";


            tile.id =
                `remoteVideo-${safeId}`;


            tile.innerHTML = `

                <video
                    autoplay
                    playsinline
                ></video>

                <div
                    class="mwaniki-video-label"
                    data-remote-label
                >
                    Mwaniki Scholar
                </div>

            `;


            container.appendChild(
                tile
            );

        }


        const video =
            tile.querySelector(
                "video"
            );


        if (video) {

            video.srcObject =
                stream;

        }


        updateRemoteUserName(
            userId,
            tile
        );

    }


    async function updateRemoteUserName(
        userId,
        tile
    ) {

        if (!tile) return;


        const label =
            tile.querySelector(
                "[data-remote-label]"
            );


        if (!label) return;


        const client =
            await getDB();


        if (!client) return;


        const {
            data
        } =
            await client

                .from(
                    "students"
                )

                .select("*")
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


        label.textContent =

            data?.full_name ||

            data?.name ||

            data?.student_name ||

            data?.display_name ||

            "Mwaniki Scholar";

    }


    function removeRemoteVideo(
        userId
    ) {

        const safeId =
            String(
                userId
            )
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_"
                );


        const tile =
            byId(
                `remoteVideo-${safeId}`
            );


        if (tile) {

            const video =
                tile.querySelector(
                    "video"
                );


            if (video) {

                video.srcObject =
                    null;

            }


            tile.remove();

        }


        const peer =
            callState.peers.get(
                String(
                    userId
                )
            );


        if (peer) {

            try {

                peer.close();

            } catch (_) {}

        }


        callState.peers.delete(
            String(
                userId
            )
        );

    }


    /* =====================================================
       32. MUTE
       ===================================================== */

    function toggleMute() {

        if (
            !callState.localStream
        ) {

            return;

        }


        const tracks =
            callState.localStream
                .getAudioTracks();


        callState.muted =
            !callState.muted;


        tracks.forEach(
            track => {

                track.enabled =
                    !callState.muted;

            }
        );


        const button =
            byId(
                "mwanikiMuteButton"
            );


        if (button) {

            button.textContent =
                callState.muted
                    ? "🔇"
                    : "🎙️";

        }


        updateParticipantMediaState();

    }


    /* =====================================================
       33. CAMERA
       ===================================================== */

    function toggleCamera() {

        if (
            !callState.localStream
        ) {

            return;

        }


        const tracks =
            callState.localStream
                .getVideoTracks();


        if (!tracks.length) {

            callToast(
                "Camera is not available in this call."
            );

            return;

        }


        callState.cameraOn =
            !callState.cameraOn;


        tracks.forEach(
            track => {

                track.enabled =
                    callState.cameraOn;

            }
        );


        const button =
            byId(
                "mwanikiCameraButton"
            );


        if (button) {

            button.textContent =
                callState.cameraOn
                    ? "📷"
                    : "🚫";

        }


        updateParticipantMediaState();

    }


    /* =====================================================
       34. SCREEN SHARE
       ===================================================== */

    async function toggleScreenShare() {

        if (
            !callState.active
        ) {

            return;

        }


        if (
            callState.screenSharing
        ) {

            await stopScreenShare();

            return;

        }


        if (
            !navigator
                .mediaDevices
                ?.getDisplayMedia
        ) {

            callToast(
                "Screen sharing is not supported in this browser.",
                "error"
            );

            return;

        }


        try {

            const stream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({

                        video: true

                    });


            const screenTrack =
                stream
                    .getVideoTracks()[0];


            if (!screenTrack) {

                return;

            }


            callState.screenStream =
                stream;


            callState.screenSharing =
                true;


            const peers =
                [
                    ...callState.peers.values()
                ];


            for (
                const peer
                of peers
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item
                                    .track
                                    ?.kind ===
                                "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                }

            }


            const localVideo =
                byId(
                    "mwanikiLocalVideo"
                );


            if (localVideo) {

                localVideo.srcObject =
                    stream;

            }


            screenTrack.onended =
                () => {

                    stopScreenShare();

                };


            updateParticipantMediaState();

        } catch (error) {

            console.error(
                "❌ Screen sharing failed:",
                error
            );

        }

    }


    async function stopScreenShare() {

        if (
            callState.screenStream
        ) {

            stopStream(
                callState.screenStream
            );

        }


        callState.screenStream =
            null;


        callState.screenSharing =
            false;


        const localVideo =
            byId(
                "mwanikiLocalVideo"
            );


        if (
            localVideo &&
            callState.localStream
        ) {

            localVideo.srcObject =
                callState.localStream;

        }


        const cameraTrack =
            callState.localStream
                ?.getVideoTracks()[0];


        if (cameraTrack) {

            const peers =
                [
                    ...callState.peers.values()
                ];


            for (
                const peer
                of peers
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item
                                    .track
                                    ?.kind ===
                                "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        cameraTrack
                    );

                }

            }

        }


        updateParticipantMediaState();

    }


    /* =====================================================
       35. PARTICIPANT MEDIA STATE
       ===================================================== */

    async function updateParticipantMediaState() {

        if (
            !callState.roomId
        ) {

            return;

        }


        const client =
            await getDB();


        if (!client) return;


        const {
            error
        } =
            await client

                .from(
                    "chat_call_participants"
                )

                .update({

                    is_muted:
                        callState.muted,

                    is_camera_on:
                        callState.cameraOn,

                    is_screen_sharing:
                        callState.screenSharing,

                    updated_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "room_id",
                    callState.roomId
                )

                .eq(
                    "user_id",
                    currentUserId()
                );


        if (error) {

            console.warn(
                "⚠️ Participant media state update failed:",
                error
            );

        }

    }


    /* =====================================================
       36. LEAVE CALL
       ===================================================== */

    async function leaveCall(
        updateDatabase = true
    ) {

        const roomId =
            callState.roomId;


        if (
            updateDatabase &&
            roomId
        ) {

            const client =
                await getDB();


            if (client) {

                await client

                    .from(
                        "chat_call_participants"
                    )

                    .update({

                        status:
                            "left",

                        left_at:
                            new Date()
                                .toISOString(),

                        updated_at:
                            new Date()
                                .toISOString()

                    })

                    .eq(
                        "room_id",
                        roomId
                    )

                    .eq(
                        "user_id",
                        currentUserId()
                    );

            }

        }


        /*
         * Close all peer connections.
         */

        callState.peers
            .forEach(
                peer => {

                    try {

                        peer.close();

                    } catch (_) {}

                }
            );


        callState.peers.clear();


        /*
         * Stop microphone/camera.
         */

        stopStream(
            callState.localStream
        );


        stopStream(
            callState.screenStream
        );


        callState.localStream =
            null;


        callState.screenStream =
            null;


        /*
         * Remove remote videos.
         */

        const videos =
            byId(
                "mwanikiCallVideos"
            );


        if (videos) {

            videos.innerHTML = `

                <div
                    class="mwaniki-video-tile local"
                    id="mwanikiLocalVideoTile"
                >

                    <video
                        id="mwanikiLocalVideo"
                        autoplay
                        muted
                        playsinline
                    ></video>

                    <div
                        class="mwaniki-video-label"
                    >
                        You
                    </div>

                </div>

            `;

        }


        cleanupCallSubscriptions();


        if (
            roomId
        ) {

            const client =
                await getDB();


            if (client) {

                const {
                    data:
                        remaining,
                    error
                } =
                    await client

                        .from(
                            "chat_call_participants"
                        )

                        .select(
                            "user_id,status"
                        )

                        .eq(
                            "room_id",
                            roomId
                        );


                if (
                    !error &&
                    remaining
                ) {

                    const activeParticipants =
                        remaining.filter(
                            participant =>
                                participant.status ===
                                    "joined" ||

                                participant.status ===
                                    "invited"
                        );


                    if (
                        activeParticipants.length ===
                        0
                    ) {

                        await updateRoomStatus(
                            roomId,
                            "ended"
                        );

                    }

                }

            }

        }


        hideCallUI();


        callState.activeRoom =
            null;


        callState.roomId =
            null;


        callState.roomCode =
            null;


        callState.active =
            false;


        callState.startedAt =
            null;


        callState.participants.clear();


        callState.incomingCalls.clear();


        callState.muted =
            false;


        callState.cameraOn =
            true;


        callState.screenSharing =
            false;


        callToast(
            "You left the call."
        );

    }


    /* =====================================================
       37. CALL SUBSCRIPTION CLEANUP
       ===================================================== */

    async function cleanupCallSubscriptions() {

        const client =
            await getDB();


        if (!client) return;


        const channels = [

            callState.signalChannel,

            callState.participantChannel,

            callState.roomChannel

        ].filter(Boolean);


        for (
            const channel
            of channels
        ) {

            try {

                await client.removeChannel(
                    channel
                );

            } catch (_) {}

        }


        callState.signalChannel =
            null;


        callState.participantChannel =
            null;


        callState.roomChannel =
            null;

    }


    /* =====================================================
       38. BUTTON DISCOVERY
       ===================================================== */

    function findButton(
        selectors
    ) {

        for (
            const selector
            of selectors
        ) {

            const element =
                document.querySelector(
                    selector
                );


            if (element) {

                return element;

            }

        }


        return null;

    }


    /* =====================================================
       39. COMMUNITY VOICE BUTTON
       ===================================================== */

    function setupVoiceButtons() {

        const selectors = [

            "#voiceCallButton",

            "#startVoiceCallButton",

            "#communityVoiceCallButton",

            "[data-call='voice']",

            "[data-call-type='audio']",

            ".voice-call-button"

        ];


        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        selectors.join(",")
                    );


                if (!button) return;


                event.preventDefault();


                startCommunityCall(
                    "audio"
                );

            }
        );

    }


    /* =====================================================
       40. COMMUNITY VIDEO BUTTON
       ===================================================== */

    function setupVideoButtons() {

        const selectors = [

            "#videoCallButton",

            "#startVideoCallButton",

            "#communityVideoCallButton",

            "[data-call='video']",

            "[data-call-type='video']",

            ".video-call-button"

        ];


        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        selectors.join(",")
                    );


                if (!button) return;


                event.preventDefault();


                startCommunityCall(
                    "video"
                );

            }
        );

    }


    /* =====================================================
       41. GENERAL CALL BUTTON
       ===================================================== */

    function setupGeneralCallButton() {

        const selectors = [

            "#generalCallButton",

            "#startGeneralCallButton",

            "#generalVoiceVideoCallButton",

            "[data-general-call]",

            ".general-call-button"

        ];


        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        selectors.join(",")
                    );


                if (!button) return;


                event.preventDefault();


                /*
                 * If button has:
                 *
                 * data-call-type="audio"
                 *
                 * it starts an audio call.
                 *
                 * Otherwise video.
                 */

                const type =
                    button.dataset
                        .callType ===
                    "audio"

                        ? "audio"

                        : "video";


                openGeneralCall(
                    type
                );

            }
        );

    }


    /* =====================================================
       42. DIRECT CALL BUTTON
       ===================================================== */

    function setupDirectCallButtons() {

        /*
         * No UUID typing is required.
         *
         * Clicking a direct-call button opens the
         * online-user picker.
         */

        const selectors = [

            "#directCallButton",

            "#startDirectCallButton",

            "[data-direct-call]",

            ".direct-call-button"

        ];


        document.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        selectors.join(",")
                    );


                if (!button) return;


                event.preventDefault();


                const type =
                    button.dataset
                        .callType ===
                    "audio"

                        ? "audio"

                        : "video";


                openRecipientPicker({

                    mode:
                        "direct",

                    callType:
                        type,

                    communityOnly:
                        false

                });

            }
        );

    }


    /* =====================================================
       43. CALL CONTROL EVENTS
       ===================================================== */

    function setupCallControlEvents() {

        document.addEventListener(
            "click",
            event => {

                const mute =
                    event.target.closest(
                        "#mwanikiMuteButton"
                    );


                if (mute) {

                    toggleMute();

                    return;

                }


                const camera =
                    event.target.closest(
                        "#mwanikiCameraButton"
                    );


                if (camera) {

                    toggleCamera();

                    return;

                }


                const screen =
                    event.target.closest(
                        "#mwanikiScreenButton"
                    );


                if (screen) {

                    toggleScreenShare();

                    return;

                }


                const leave =
                    event.target.closest(
                        "#mwanikiLeaveCallButton"
                    );


                if (leave) {

                    leaveCall();

                    return;

                }


                const close =
                    event.target.closest(
                        "#mwanikiCloseCallButton"
                    );


                if (close) {

                    leaveCall();

                }

            }
        );

    }


    /* =====================================================
       44. CALL INVITATION SIGNAL
       ===================================================== */

    async function sendCallInvitation(
        roomId,
        userIds
    ) {

        /*
         * Invitations are primarily represented by
         * chat_call_participants.
         *
         * The signal is also useful when realtime
         * signaling is enabled.
         */

        for (
            const userId
            of userIds
        ) {

            await sendSignal(
                userId,
                "call-invite",
                {

                    callerName:
                        currentUserName(),

                    callType:
                        callState.callType,

                    scope:
                        callState.callScope,

                    roomCode:
                        callState.roomCode

                }
            );

        }

    }


    /* =====================================================
       45. IMPROVED DIRECT CALL START
       ===================================================== */

    async function notifyCallRecipients(
        room,
        userIds,
        type,
        scope
    ) {

        callState.roomId =
            room.id;


        callState.roomCode =
            room.room_code;


        callState.callType =
            type;


        callState.callScope =
            scope;


        await sendCallInvitation(
            room.id,
            userIds
        );

    }


    /* =====================================================
       46. PATCH START FUNCTIONS
       ===================================================== */

    /*
     * We wrap the original room-start flow so invitations
     * are sent immediately after the room exists.
     */

    const originalStartDirectCall =
        startDirectCall;


    const originalStartGeneralCall =
        startGeneralCall;


    /*
     * The existing functions above already create the room.
     * Realtime participant rows are the authoritative
     * invitation mechanism, so no second insert is necessary.
     *
     * This section intentionally does not duplicate rows.
     */


    /* =====================================================
       47. CALL BUTTON ALIASES
       ===================================================== */

    window.mwanikiCommunityCalls = {

        state:
            callState,

        startCommunityVoiceCall:
            () =>
                startCommunityCall(
                    "audio"
                ),

        startCommunityVideoCall:
            () =>
                startCommunityCall(
                    "video"
                ),

        startGeneralVoiceCall:
            () =>
                openGeneralCall(
                    "audio"
                ),

        startGeneralVideoCall:
            () =>
                openGeneralCall(
                    "video"
                ),

        startDirectVoiceCall:
            () =>
                openRecipientPicker({

                    mode:
                        "direct",

                    callType:
                        "audio",

                    communityOnly:
                        false

                }),

        startDirectVideoCall:
            () =>
                openRecipientPicker({

                    mode:
                        "direct",

                    callType:
                        "video",

                    communityOnly:
                        false

                }),

        leave:
            () =>
                leaveCall(),

        mute:
            toggleMute,

        camera:
            toggleCamera,

        screen:
            toggleScreenShare

    };


    /* =====================================================
       48. INITIALIZE
       ===================================================== */

    function initializeCallEngine() {

        if (
            callState.initialized
        ) {

            return;

        }


        createCallUI();


        setupVoiceButtons();

        setupVideoButtons();

        setupGeneralCallButton();

        setupDirectCallButtons();

        setupCallControlEvents();


        callState.initialized =
            true;


        console.log(
            "✅ Mwaniki Universal Call Engine ready."
        );

    }


    initializeCallEngine();


    console.log(
        "📞 Mwaniki Community Call Engine initialized."
    );


})();
