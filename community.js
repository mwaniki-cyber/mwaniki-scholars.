/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   community.js — PART 1 OF 2

   Includes:
   - Supabase authentication
   - Student profile
   - Courses
   - Communities
   - Community rail
   - Channels
   - Channel categories
   - Course-linked channels
   - Channel selection
   - Messages
   - Message rendering
   - Replies
   - Search
   - Members
   - Realtime foundation

   PART 2 continues directly underneath this file.
   ========================================================= */

import { supabase } from "./supabase.js";

(() => {

    "use strict";


    console.log(
        "🚀 Mwaniki Scholars Community Engine starting..."
    );


    /* =====================================================
       1. SUPABASE
       ===================================================== */

    const db = supabase;

    if (!db) {

        console.error(
            "❌ Supabase client is unavailable."
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

        reactions: [],

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

        loadingChannels: false,

        loadingCommunities: false

    };


    /* =====================================================
       3. STORAGE KEYS
       ===================================================== */

    const STORAGE = {

        communityId:
            "mwanikiCommunityId",

        communityName:
            "mwanikiCommunityName",

        courseId:
            "communityCourseId",

        courseName:
            "communityCourseName",

        channelId:
            "mwanikiChannelId"

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


    function setText(id, value) {

        const element =
            byId(id);

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

        return String(
            value ?? ""
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


    function escapeAttribute(value) {

        return escapeHTML(value);

    }


    function initials(name) {

        const clean =
            String(
                name ||
                "Student"
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
            parts[parts.length - 1][0]
        ).toUpperCase();

    }


    function slugify(value) {

        return String(
            value || ""
        )
            .toLowerCase()
            .trim()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .slice(
                0,
                80
            );

    }


    /* =====================================================
       6. TOAST
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

            console.log(
                `[Community ${type}]`,
                message
            );

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


        if (
            type === "error"
        ) {

            element.style.borderColor =
                "rgba(239,102,113,.35)";

        } else if (
            type === "success"
        ) {

            element.style.borderColor =
                "rgba(66,211,146,.30)";

        } else {

            element.style.borderColor =
                "";

        }


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
       7. STORAGE
       ===================================================== */

    function storageGet(key) {

        try {

            return localStorage.getItem(
                key
            );

        } catch (error) {

            console.warn(
                "Storage read failed:",
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
                "Storage write failed:",
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
                "Storage remove failed:",
                error
            );

        }

    }


    /* =====================================================
       8. DATE / TIME
       ===================================================== */

    function formatMessageTime(value) {

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


    function formatMessageDate(value) {

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


        if (
            date.getFullYear() ===
                now.getFullYear() &&
            date.getMonth() ===
                now.getMonth() &&
            date.getDate() ===
                now.getDate()
        ) {

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
       9. URL / COURSE CONTEXT
       ===================================================== */

    function getURLParams() {

        return new URLSearchParams(
            window.location.search
        );

    }


    function getURLCourseId() {

        const raw =
            getURLParams()
                .get("course_id");


        if (!raw) return null;


        const id =
            Number(raw);


        return Number.isFinite(id)
            ? id
            : null;

    }


    function getURLCourseName() {

        return getURLParams()
            .get("course_name");

    }


    function getStoredCourseId() {

        const raw =
            storageGet(
                STORAGE.courseId
            );


        if (!raw) return null;


        const id =
            Number(raw);


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
        } =
            await db.auth.getUser();


        if (error) {

            console.error(
                "❌ Auth user error:",
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

            console.log(
                "✅ Authenticated:",
                state.user.id
            );

            return true;

        }


        console.warn(
            "⚠️ No authenticated user."
        );


        window.location.href =
            "./index.html";


        return false;

    }


    function setupAuthListener() {

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
                    "SIGNED_OUT"
                ) {

                    cleanupRealtime();

                    window.location.href =
                        "./index.html";

                    return;

                }


                if (
                    session?.user
                ) {

                    state.user =
                        session.user;

                }

            }
        );

    }


    /* =====================================================
       11. STUDENT PROFILE
       ===================================================== */

    async function loadStudentProfile() {

        if (!state.user?.id) {

            return null;

        }


        /*
         * We deliberately keep this tolerant.
         * If the students table is unavailable,
         * the community still loads.
         */

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
                "⚠️ Student profile unavailable:",
                error.message
            );

            state.profile =
                null;

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

            console.warn(
                "⚠️ Course loading failed:",
                error.message
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


                const first =
                    select.options[0];


                select.innerHTML =
                    "";


                if (first) {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        first.value;

                    option.textContent =
                        first.textContent;

                    select.appendChild(
                        option
                    );

                }


                state.courses.forEach(
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
                    String(course.id) ===
                    String(courseId)
            ) ||
            null
        );

    }


    /* =====================================================
       13. COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        console.log(
            "🌐 Loading communities..."
        );


        state.loadingCommunities =
            true;


        /*
         * IMPORTANT:
         *
         * Only columns that were confirmed
         * in our community schema are used here.
         *
         * This avoids the previous problem where
         * banner_url / updated_at / other columns
         * could stop the whole query.
         */

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
                    is_public,
                    is_active
                    `
                )
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "name",
                    {
                        ascending: true
                    }
                );


        state.loadingCommunities =
            false;


        if (error) {

            console.error(
                "❌ COMMUNITY LOAD ERROR:",
                error
            );


            state.communities =
                [];


            renderCommunityRail();


            toast(
                "Communities could not be loaded.",
                "error"
            );


            return [];

        }


        state.communities =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            "✅ Communities loaded:",
            state.communities.length,
            state.communities
        );


        renderCommunityRail();


        return state.communities;

    }


    /* =====================================================
       14. COMMUNITY RAIL
       ===================================================== */

    function renderCommunityRail() {

        const rail =
            byId(
                "communityRail"
            );


        if (!rail) {

            console.warn(
                "⚠️ #communityRail not found."
            );

            return;

        }


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


                        const isImage =
                            /^https?:\/\//i
                                .test(
                                    String(icon)
                                );


                        return `
                            <button
                                type="button"
                                class="
                                    community-rail-item
                                    ${active ? "active" : ""}
                                "
                                data-community-id="${escapeAttribute(community.id)}"
                                title="${escapeAttribute(community.name)}"
                            >

                                ${
                                    isImage
                                        ? `
                                            <img
                                                src="${escapeAttribute(icon)}"
                                                alt=""
                                                class="community-rail-image"
                                            >
                                        `
                                        : `
                                            <span class="community-rail-initials">
                                                ${escapeHTML(icon)}
                                            </span>
                                        `
                                }

                            </button>
                        `;

                    }
                )
                .join("");


        queryAll(
            "[data-community-id]",
            rail
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const id =
                            button.dataset
                                .communityId;


                        const community =
                            state.communities
                                .find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(id)
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
        );

    }


    /* =====================================================
       15. COMMUNITY ROLE
       ===================================================== */

    async function loadCommunityRole(
        communityId
    ) {

        state.currentRole =
            "student";


        if (
            !communityId ||
            !state.user?.id
        ) {

            updateRoleBadge();

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
                error.message
            );

            updateRoleBadge();

            return "student";

        }


        if (
            data?.is_banned
        ) {

            toast(
                "You are banned from this community.",
                "error"
            );

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
                "currentRoleBadge"
            );


        if (!badge) return;


        badge.textContent =
            String(
                state.currentRole ||
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

    }


    /* =====================================================
       16. JOIN COMMUNITY IF NECESSARY
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
                    is_muted,
                    is_banned
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
            error &&
            error.code !== "PGRST116"
        ) {

            console.warn(
                "⚠️ Membership lookup:",
                error.message
            );

        }


        if (existing) {

            return existing;

        }


        /*
         * Public communities:
         * automatically create student membership.
         */

        const community =
            state.communities.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        communityId
                    )
            );


        if (
            community &&
            community.is_public === false
        ) {

            return null;

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

            console.warn(
                "⚠️ Could not create community membership:",
                createError.message
            );

            return null;

        }


        return created;

    }


    /* =====================================================
       17. COMMUNITY HEADER
       ===================================================== */

    function renderActiveCommunity() {

        const community =
            state.currentCommunity;


        if (!community) return;


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

            if (
                community.icon_url
            ) {

                icon.innerHTML = `
                    <img
                        src="${escapeAttribute(community.icon_url)}"
                        alt=""
                    >
                `;

            } else {

                icon.textContent =
                    initials(
                        community.name
                    );

            }

        }


        const courseId =
            getURLCourseId() ||
            getStoredCourseId();


        const course =
            findCourseById(
                courseId
            );


        state.currentCourse =
            course || null;


        const banner =
            byId(
                "communityCourseBanner"
            );


        if (banner) {

            if (course) {

                showElement(
                    banner
                );

            }

        }


        setText(
            "communityCourseName",
            course?.title ||
            getURLCourseName() ||
            "General Community"
        );


        setText(
            "communityCourseLabel",
            course
                ? "Course Community"
                : "Community"
        );

    }


    /* =====================================================
       18. CHANNEL LOADING
       ===================================================== */

    async function loadChannels() {

        const communityId =
            state.currentCommunity?.id;


        console.log(
            "📡 Loading channels for:",
            communityId
        );


        if (!communityId) {

            state.channels =
                [];

            renderChannels();

            return [];

        }


        state.loadingChannels =
            true;


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
                    created_at
                    `
                )
                .eq(
                    "community_id",
                    communityId
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


        state.loadingChannels =
            false;


        if (error) {

            console.error(
                "❌ CHANNEL LOAD ERROR:",
                error
            );


            state.channels =
                [];


            renderChannels();


            toast(
                "Channels could not be loaded.",
                "error"
            );


            return [];

        }


        const channels =
            Array.isArray(data)
                ? data
                : [];


        const publicChannels =
            channels.filter(
                channel =>
                    !channel.is_private
            );


        const privateChannels =
            channels.filter(
                channel =>
                    channel.is_private
            );


        let allowedPrivateIds =
            new Set();


        if (
            privateChannels.length &&
            state.user?.id
        ) {

            const {
                data: memberships,
                error: membershipError
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


            if (membershipError) {

                console.warn(
                    "⚠️ Private channel membership:",
                    membershipError.message
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
            state.channels.length,
            state.channels
        );


        renderChannels();


        return state.channels;

    }


    /* =====================================================
       19. CHANNEL CATEGORY
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
       20. CHANNEL RENDERING
       ===================================================== */

    function renderChannels() {

        const list =
            byId(
                "channelList"
            );


        if (!list) {

            console.warn(
                "⚠️ #channelList not found."
            );

            return;

        }


        if (
            state.loadingChannels
        ) {

            list.innerHTML = `
                <div class="channel-loading">
                    Loading channels...
                </div>
            `;

            return;

        }


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

                        const text =
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


                        return text.includes(
                            search
                        );

                    }
                )
                : state.channels;


        if (
            !filtered.length
        ) {

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
                                class="
                                    channel-item
                                    ${active ? "active" : ""}
                                "
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

                                ${
                                    channel.is_private
                                        ? `
                                            <span
                                                class="channel-private-icon"
                                                title="Private channel"
                                            >
                                                🔒
                                            </span>
                                        `
                                        : ""
                                }

                            </button>
                        `;

                    }
                );

            }
        );


        list.innerHTML =
            html;


        queryAll(
            "[data-channel-id]",
            list
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const id =
                            button.dataset
                                .channelId;


                        const channel =
                            state.channels.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(id)
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
        );

    }


    /* =====================================================
       21. SELECT COMMUNITY
       ===================================================== */

    async function selectCommunity(
        community
    ) {

        if (!community) {

            return;

        }


        console.log(
            "🏠 Selecting community:",
            community.name,
            community.id
        );


        state.currentCommunity =
            community;


        state.currentChannel =
            null;


        state.messages =
            [];


        storageSet(
            STORAGE.communityId,
            community.id
        );


        storageSet(
            STORAGE.communityName,
            community.name
        );


        renderCommunityRail();


        renderActiveCommunity();


        await ensureCommunityMembership(
            community.id
        );


        await loadCommunityRole(
            community.id
        );


        await loadChannels();


        const initialChannel =
            chooseInitialChannel();


        if (
            initialChannel
        ) {

            await selectChannel(
                initialChannel
            );

        }


        setupCommunityRealtime(
            community.id
        );


        startPresence();


        return community;

    }


    function chooseInitialCommunity() {

        if (
            !state.communities.length
        ) {

            return null;

        }


        const urlCommunity =
            getURLParams()
                .get(
                    "community_id"
                );


        const stored =
            storageGet(
                STORAGE.communityId
            );


        return (
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(
                        urlCommunity
                    )
            ) ||

            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(
                        stored
                    )
            ) ||

            state.communities[0]
        );

    }


    function chooseInitialChannel() {

        if (
            !state.channels.length
        ) {

            return null;

        }


        const stored =
            storageGet(
                STORAGE.channelId
            );


        const courseId =
            getURLCourseId() ||
            getStoredCourseId();


        if (courseId) {

            const courseChannel =
                state.channels.find(
                    channel =>
                        String(
                            channel.course_id
                        ) ===
                        String(
                            courseId
                        )
                );


            if (
                courseChannel
            ) {

                return courseChannel;

            }

        }


        return (
            state.channels.find(
                channel =>
                    String(
                        channel.id
                    ) ===
                    String(stored)
            ) ||

            state.channels[0]
        );

    }


    /* =====================================================
       22. ACTIVE CHANNEL HEADER
       ===================================================== */

    function renderActiveChannel() {

        const channel =
            state.currentChannel;


        if (!channel) {

            setText(
                "activeChannelName",
                "Select a channel"
            );

            return;

        }


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


        const channelIcon =
            byId(
                "activeChannelIcon"
            );


        if (channelIcon) {

            channelIcon.textContent =
                channel.icon ||
                "#";

        }

    }


    /* =====================================================
       23. SELECT CHANNEL
       ===================================================== */

    async function selectChannel(
        channel
    ) {

        if (!channel) {

            return;

        }


        console.log(
            "📂 Selecting channel:",
            channel.name,
            channel.id
        );


        state.currentChannel =
            channel;


        storageSet(
            STORAGE.channelId,
            channel.id
        );


        renderChannels();


        renderActiveChannel();


        await loadMessages(
            channel.id
        );


        await loadChannelMembers(
            channel.id
        );


        setupChannelRealtime(
            channel.id
        );


        scrollMessagesToBottom();


        return channel;

    }


    /* =====================================================
       24. MESSAGES
       ===================================================== */

    async function loadMessages(
        channelId
    ) {

        if (!channelId) {

            return [];

        }


        state.loadingMessages =
            true;


        renderMessages();


        const {
            data,
            error
        } =
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
                )
                .limit(
                    200
                );


        state.loadingMessages =
            false;


        if (error) {

            console.error(
                "❌ Message loading failed:",
                error
            );


            state.messages =
                [];


            renderMessages();


            return [];

        }


        state.messages =
            Array.isArray(data)
                ? data
                : [];


        await enrichMessageProfiles();


        renderMessages();


        return state.messages;

    }


    async function enrichMessageProfiles() {

        /*
         * Messages remain usable even when
         * profile lookup is unavailable.
         */

        return true;

    }


    function getMessageAuthorName(
        message
    ) {

        if (
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            )
        ) {

            return "You";

        }


        return (
            message.author_name ||
            message.full_name ||
            message.username ||
            "Student"
        );

    }


    function renderMessages() {

        const container =
            byId(
                "messageList"
            );


        if (!container) {

            return;

        }


        if (
            state.loadingMessages
        ) {

            container.innerHTML = `
                <div class="message-loading">
                    Loading messages...
                </div>
            `;

            return;

        }


        if (
            !state.messages.length
        ) {

            container.innerHTML = `
                <div class="message-empty">
                    <div class="message-empty-icon">
                        💬
                    </div>

                    <strong>
                        No messages yet
                    </strong>

                    <span>
                        Start the discussion in this channel.
                    </span>
                </div>
            `;

            return;

        }


        const search =
            state.messageSearch
                .trim()
                .toLowerCase();


        const messages =
            search
                ? state.messages.filter(
                    message =>
                        String(
                            message.content ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                search
                            )
                )
                : state.messages;


        container.innerHTML =
            messages
                .map(
                    message =>
                        createMessageHTML(
                            message
                        )
                )
                .join("");


        bindMessageActions();

    }


    function createMessageHTML(
        message
    ) {

        const own =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );


        const author =
            getMessageAuthorName(
                message
            );


        const content =
            message.content ||
            "";


        const created =
            formatMessageDate(
                message.created_at
            );


        return `
            <article
                class="
                    community-message
                    ${own ? "own-message" : ""}
                "
                data-message-id="${escapeAttribute(message.id)}"
            >

                <div class="message-avatar">
                    ${escapeHTML(
                        initials(author)
                    )}
                </div>


                <div class="message-main">

                    <div class="message-meta">

                        <strong>
                            ${escapeHTML(author)}
                        </strong>

                        <time>
                            ${escapeHTML(created)}
                        </time>

                    </div>


                    <div class="message-content">
                        ${escapeHTML(content)}
                    </div>


                    <div class="message-actions">

                        <button
                            type="button"
                            data-reply-message="${escapeAttribute(message.id)}"
                        >
                            Reply
                        </button>

                        <button
                            type="button"
                            data-react-message="${escapeAttribute(message.id)}"
                        >
                            ❤️
                        </button>

                    </div>

                </div>

            </article>
        `;

    }


    function bindMessageActions() {

        queryAll(
            "[data-reply-message]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const id =
                            button.dataset
                                .replyMessage;


                        const message =
                            state.messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(id)
                            );


                        if (
                            message
                        ) {

                            state.currentReply =
                                message;

                            updateReplyUI();

                        }

                    }
                );

            }
        );


        queryAll(
            "[data-react-message]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await toggleReaction(
                            button.dataset
                                .reactMessage
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       25. REPLY UI
       ===================================================== */

    function updateReplyUI() {

        const reply =
            byId(
                "replyPreview"
            );


        if (!reply) return;


        if (
            !state.currentReply
        ) {

            reply.innerHTML =
                "";

            reply.classList.remove(
                "active"
            );

            return;

        }


        reply.classList.add(
            "active"
        );


        reply.innerHTML = `
            <div>
                Replying to
                <strong>
                    ${escapeHTML(
                        getMessageAuthorName(
                            state.currentReply
                        )
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        state.currentReply.content ||
                        ""
                    )}
                </span>
            </div>

            <button
                type="button"
                id="cancelReplyButton"
            >
                ×
            </button>
        `;


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


    function cancelReply() {

        state.currentReply =
            null;

        updateReplyUI();

    }


    /* =====================================================
       26. REACTIONS
       ===================================================== */

    async function toggleReaction(
        messageId
    ) {

        if (
            !messageId ||
            !state.user?.id
        ) {

            return;

        }


        const {
            data: existing,
            error: lookupError
        } =
            await db
                .from(
                    "chat_message_reactions"
                )
                .select("id")
                .eq(
                    "message_id",
                    messageId
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
                "Reaction lookup failed:",
                lookupError
            );

            return;

        }


        if (existing) {

            await db
                .from(
                    "chat_message_reactions"
                )
                .delete()
                .eq(
                    "id",
                    existing.id
                );

        } else {

            await db
                .from(
                    "chat_message_reactions"
                )
                .insert({
                    message_id:
                        messageId,

                    user_id:
                        state.user.id,

                    reaction:
                        "❤️"
                });

        }

    }


    /* =====================================================
       27. SEND MESSAGE
       ===================================================== */

    async function sendMessage() {

        if (
            state.sendingMessage
        ) {

            return;

        }


        const input =
            byId(
                "messageInput"
            );


        if (!input) {

            return;

        }


        const content =
            input.value.trim();


        if (
            !content
        ) {

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


        if (
            !state.user?.id
        ) {

            toast(
                "You are not signed in.",
                "error"
            );

            return;

        }


        state.sendingMessage =
            true;


        input.disabled =
            true;


        const payload = {

            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content:
                content

        };


        if (
            state.currentReply?.id
        ) {

            /*
             * Only add reply_to if the database
             * has that column. Our engine first
             * attempts the normal message.
             */

            payload.reply_to =
                state.currentReply.id;

        }


        let result =
            await db
                .from(
                    "chat_messages"
                )
                .insert(
                    payload
                )
                .select()
                .single();


        /*
         * If reply_to is not part of the
         * existing schema, retry without it.
         */

        if (
            result.error &&
            state.currentReply?.id &&
            /reply_to/i.test(
                result.error.message ||
                ""
            )
        ) {

            delete payload.reply_to;


            result =
                await db
                    .from(
                        "chat_messages"
                    )
                    .insert(
                        payload
                    )
                    .select()
                    .single();

        }


        state.sendingMessage =
            false;


        input.disabled =
            false;


        if (
            result.error
        ) {

            console.error(
                "❌ Message send failed:",
                result.error
            );


            toast(
                "Message could not be sent.",
                "error"
            );

            return;

        }


        input.value =
            "";


        cancelReply();


        /*
         * Realtime normally adds the message.
         * We also add it immediately so the sender
         * sees it even if Realtime is delayed.
         */

        if (
            result.data
        ) {

            const exists =
                state.messages.some(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            result.data.id
                        )
                );


            if (!exists) {

                state.messages.push(
                    result.data
                );

                renderMessages();

            }

        }


        scrollMessagesToBottom();

    }


    function scrollMessagesToBottom() {

        const container =
            byId(
                "messageList"
            );


        if (!container) return;


        requestAnimationFrame(
            () => {

                container.scrollTop =
                    container.scrollHeight;

            }
        );

    }


    /* =====================================================
       28. CHANNEL MEMBERS
       ===================================================== */

    async function loadChannelMembers(
        channelId
    ) {

        if (!channelId) {

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
                    "chat_channel_members"
                )
                .select("*")
                .eq(
                    "channel_id",
                    channelId
                );


        if (error) {

            console.warn(
                "⚠️ Channel members unavailable:",
                error.message
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


        renderMembers();


        return state.members;

    }


    async function loadCommunityMembers() {

        const communityId =
            state.currentCommunity?.id;


        if (!communityId) {

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
                .select("*")
                .eq(
                    "community_id",
                    communityId
                );


        if (error) {

            console.warn(
                "⚠️ Community members unavailable:",
                error.message
            );

            return [];

        }


        state.members =
            Array.isArray(data)
                ? data
                : [];


        renderMembers();


        return state.members;

    }


    function renderMembers() {

        const list =
            byId(
                "memberList"
            );


        if (!list) return;


        if (
            !state.members.length
        ) {

            list.innerHTML = `
                <div class="empty-state">
                    No members to display.
                </div>
            `;

            return;

        }


        list.innerHTML =
            state.members
                .map(
                    member => {

                        const name =
                            member.nickname ||
                            member.full_name ||
                            member.username ||
                            (
                                String(
                                    member.user_id
                                ) ===
                                String(
                                    state.user?.id
                                )
                                    ? "You"
                                    : "Student"
                            );


                        return `
                            <div
                                class="member-item"
                                data-member-id="${escapeAttribute(member.user_id || member.id)}"
                            >

                                <div class="member-avatar">
                                    ${escapeHTML(
                                        initials(name)
                                    )}
                                </div>

                                <div class="member-info">

                                    <strong>
                                        ${escapeHTML(name)}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            member.role ||
                                            "student"
                                        )}
                                    </small>

                                </div>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    /* =====================================================
       29. REALTIME CLEANUP
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
                            "Realtime cleanup:",
                            error
                        );

                    }

                }
            );


        state.realtimeChannels =
            [];


        if (
            state.presenceTimer
        ) {

            clearInterval(
                state.presenceTimer
            );

            state.presenceTimer =
                null;

        }

    }


    /* =====================================================
       30. COMMUNITY REALTIME
       ===================================================== */

    function setupCommunityRealtime(
        communityId
    ) {

        cleanupRealtime();


        if (!communityId) return;


        const channel =
            db.channel(
                `mwaniki-community-${communityId}`
            );


        channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_messages"
                },
                payload => {

                    const message =
                        payload.new;


                    if (
                        message?.channel_id !==
                        state.currentChannel?.id
                    ) {

                        return;

                    }


                    if (
                        payload.eventType ===
                        "INSERT"
                    ) {

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

                            renderMessages();

                            scrollMessagesToBottom();

                        }

                    }


                    if (
                        payload.eventType ===
                        "UPDATE"
                    ) {

                        state.messages =
                            state.messages.map(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        message.id
                                    )
                                        ? message
                                        : item
                            );

                        renderMessages();

                    }


                    if (
                        payload.eventType ===
                        "DELETE"
                    ) {

                        state.messages =
                            state.messages.filter(
                                item =>
                                    String(
                                        item.id
                                    ) !==
                                    String(
                                        message.id
                                    )
                            );

                        renderMessages();

                    }

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
            channel
        );

    }


    /* =====================================================
       31. CHANNEL REALTIME
       ===================================================== */

    function setupChannelRealtime(
        channelId
    ) {

        if (!channelId) return;


        const channel =
            db.channel(
                `mwaniki-channel-${channelId}`
            );


        channel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channelId}`
                },
                payload => {

                    const message =
                        payload.new;


                    if (
                        payload.eventType ===
                        "INSERT"
                    ) {

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

                            renderMessages();

                            scrollMessagesToBottom();

                        }

                    }

                }
            )
            .subscribe();


        state.realtimeChannels.push(
            channel
        );

    }


    /* =====================================================
       32. PRESENCE
       ===================================================== */

    async function updatePresence() {

        if (
            !state.user?.id
        ) {

            return;

        }


        if (
            !state.currentCommunity?.id
        ) {

            return;

        }


        const payload = {

            user_id:
                state.user.id,

            community_id:
                state.currentCommunity.id,

            last_seen_at:
                new Date()
                    .toISOString()

        };


        const {
            error
        } =
            await db
                .from(
                    "chat_presence"
                )
                .upsert(
                    payload,
                    {
                        onConflict:
                            "user_id,community_id"
                    }
                );


        if (error) {

            /*
             * Presence must never break
             * the community page.
             */

            console.debug(
                "Presence update:",
                error.message
            );

        }

    }


    function startPresence() {

        if (
            state.presenceTimer
        ) {

            clearInterval(
                state.presenceTimer
            );

        }


        updatePresence();


        state.presenceTimer =
            setInterval(
                updatePresence,
                60000
            );

    }


    /* =====================================================
       PART 2 STARTS DIRECTLY BELOW
       ===================================================== */
 /* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   community.js — PART 2 OF 2

   Continues Part 1.

   Includes:
   - Event system
   - Community/channel search
   - Message composer
   - Community creation
   - Channel creation
   - Call system
   - General calls
   - Community calls
   - Voice
   - Video
   - Screen sharing
   - Mute
   - Camera
   - WebRTC
   - Supabase call signaling
   - Incoming calls
   - Call cleanup
   - Initialization
   ========================================================= */


/* =========================================================
   33. COMMUNITY SEARCH
   ========================================================= */

function setupSearchEvents() {

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


/* =========================================================
   34. MESSAGE COMPOSER EVENTS
   ========================================================= */

function setupMessageComposer() {

    const input =
        byId(
            "messageInput"
        );


    if (!input) {

        console.warn(
            "⚠️ #messageInput not found."
        );

        return;

    }


    input.addEventListener(
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


    const sendButton =
        byId(
            "sendMessageButton"
        );


    if (sendButton) {

        sendButton.addEventListener(
            "click",
            sendMessage
        );

    }


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

}


/* =========================================================
   35. COMMUNITY CREATION
   ========================================================= */

function canManageCommunity() {

    return [
        "admin",
        "super_admin"
    ].includes(
        state.currentRole
    );

}


async function createCommunity() {

    if (
        !state.user?.id
    ) {

        toast(
            "Please sign in first.",
            "error"
        );

        return;

    }


    const name =
        window.prompt(
            "Community name:"
        );


    if (!name?.trim()) {

        return;

    }


    const cleanName =
        name.trim();


    const description =
        window.prompt(
            "Community description:"
        ) ||
        "";


    const slug =
        slugify(
            cleanName
        );


    const {
        data,
        error
    } =
        await db
            .from(
                "chat_communities"
            )
            .insert({
                name:
                    cleanName,

                slug:
                    slug,

                description:
                    description.trim(),

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

        console.error(
            "❌ Community creation failed:",
            error
        );


        toast(
            error.message ||
            "Community could not be created.",
            "error"
        );

        return;

    }


    toast(
        "Community created.",
        "success"
    );


    await loadCommunities();


    if (data) {

        await selectCommunity(
            data
        );

    }

}


/* =========================================================
   36. CHANNEL CREATION
   ========================================================= */

async function createChannel() {

    if (
        !state.currentCommunity?.id
    ) {

        toast(
            "Select a community first.",
            "error"
        );

        return;

    }


    const name =
        window.prompt(
            "Channel name:"
        );


    if (!name?.trim()) {

        return;

    }


    const cleanName =
        name.trim();


    const description =
        window.prompt(
            "Channel description:"
        ) ||
        "";


    const typeInput =
        window.prompt(
            "Channel type: text / study / announcement / voice",
            "text"
        );


    const channelType =
        (
            typeInput ||
            "text"
        )
            .trim()
            .toLowerCase();


    const slug =
        slugify(
            cleanName
        );


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
                    state.currentCommunity.id,

                name:
                    cleanName,

                slug:
                    slug,

                description:
                    description.trim(),

                channel_type:
                    channelType,

                position:
                    state.channels.length,

                is_private:
                    false,

                is_archived:
                    false,

                is_active:
                    true,

                created_by:
                    state.user.id
            })
            .select()
            .single();


    if (error) {

        console.error(
            "❌ Channel creation failed:",
            error
        );


        toast(
            error.message ||
            "Channel could not be created.",
            "error"
        );

        return;

    }


    toast(
        "Channel created.",
        "success"
    );


    await loadChannels();


    if (data) {

        await selectChannel(
            data
        );

    }

}


/* =========================================================
   37. EVENT SYSTEM
   ========================================================= */

function setupCommunityEvents() {

    const createCommunityButton =
        byId(
            "createCommunityButton"
        );


    if (
        createCommunityButton
    ) {

        createCommunityButton.addEventListener(
            "click",
            createCommunity
        );

    }


    const createChannelButton =
        byId(
            "createChannelButton"
        );


    if (
        createChannelButton
    ) {

        createChannelButton.addEventListener(
            "click",
            createChannel
        );

    }


    /*
     * Optional refresh buttons.
     */

    queryAll(
        "[data-community-refresh]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    await loadCommunities();

                    const selected =
                        chooseInitialCommunity();

                    if (selected) {

                        await selectCommunity(
                            selected
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   38. CALL CONFIGURATION
   ========================================================= */

const CALLING = {

    tables: {

        rooms:
            "chat_call_rooms",

        participants:
            "chat_call_participants",

        signals:
            "chat_call_signals"

    },


    /*
     * Google public STUN servers.
     *
     * STUN helps establish peer-to-peer
     * connections.
     *
     * Production reliability eventually
     * requires TURN as well.
     */

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

};


/* =========================================================
   39. CALL STATE
   ========================================================= */

const callState = {

    active:
        false,

    room:
        null,

    roomId:
        null,

    roomType:
        null,

    communityId:
        null,

    mode:
        "voice",

    localStream:
        null,

    screenStream:
        null,

    peers:
        new Map(),

    remoteStreams:
        new Map(),

    signalChannel:
        null,

    participantChannel:
        null,

    participantIds:
        new Set(),

    muted:
        false,

    cameraEnabled:
        false,

    screenSharing:
        false,

    joining:
        false,

    leaving:
        false,

    startedAt:
        null,

    timer:
        null

};


/* =========================================================
   40. CALL UI
   ========================================================= */

function ensureCallUI() {

    if (
        byId(
            "mwanikiCallOverlay"
        )
    ) {

        return;

    }


    const overlay =
        document.createElement(
            "section"
        );


    overlay.id =
        "mwanikiCallOverlay";


    overlay.innerHTML = `

        <div
            class="mwaniki-call-backdrop"
        ></div>


        <div
            class="mwaniki-call-window"
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

                    <span
                        id="mwanikiCallTimer"
                    >
                        00:00
                    </span>

                </div>


                <button
                    type="button"
                    id="mwanikiCallClose"
                >
                    ×
                </button>

            </header>


            <div
                id="mwanikiCallParticipants"
                class="mwaniki-call-participants"
            ></div>


            <footer
                class="mwaniki-call-controls"
            >

                <button
                    type="button"
                    id="mwanikiMuteButton"
                >
                    🎙️ Mute
                </button>


                <button
                    type="button"
                    id="mwanikiCameraButton"
                >
                    📷 Camera
                </button>


                <button
                    type="button"
                    id="mwanikiScreenButton"
                >
                    🖥️ Screen
                </button>


                <button
                    type="button"
                    id="mwanikiLeaveButton"
                    class="danger"
                >
                    ☎ Leave
                </button>

            </footer>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    bindCallUI();

}


/* =========================================================
   41. CALL UI EVENTS
   ========================================================= */

function bindCallUI() {

    const mute =
        byId(
            "mwanikiMuteButton"
        );


    if (mute) {

        mute.addEventListener(
            "click",
            toggleMute
        );

    }


    const camera =
        byId(
            "mwanikiCameraButton"
        );


    if (camera) {

        camera.addEventListener(
            "click",
            toggleCamera
        );

    }


    const screen =
        byId(
            "mwanikiScreenButton"
        );


    if (screen) {

        screen.addEventListener(
            "click",
            toggleScreenShare
        );

    }


    const leave =
        byId(
            "mwanikiLeaveButton"
        );


    if (leave) {

        leave.addEventListener(
            "click",
            leaveCall
        );

    }


    const close =
        byId(
            "mwanikiCallClose"
        );


    if (close) {

        close.addEventListener(
            "click",
            leaveCall
        );

    }

}


/* =========================================================
   42. CALL UI VISIBILITY
   ========================================================= */

function showCallUI(
    title
) {

    ensureCallUI();


    const overlay =
        byId(
            "mwanikiCallOverlay"
        );


    if (!overlay) return;


    overlay.classList.add(
        "active"
    );


    setText(
        "mwanikiCallTitle",
        title ||
        "Mwaniki Call"
    );


    updateCallControls();


    startCallTimer();

}


function hideCallUI() {

    const overlay =
        byId(
            "mwanikiCallOverlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "active"
        );

    }


    stopCallTimer();

}


/* =========================================================
   43. CALL TIMER
   ========================================================= */

function startCallTimer() {

    stopCallTimer();


    callState.startedAt =
        Date.now();


    callState.timer =
        setInterval(
            () => {

                if (
                    !callState.startedAt
                ) {

                    return;

                }


                const seconds =
                    Math.floor(
                        (
                            Date.now() -
                            callState.startedAt
                        ) / 1000
                    );


                const minutes =
                    Math.floor(
                        seconds / 60
                    );


                const remaining =
                    seconds % 60;


                setText(
                    "mwanikiCallTimer",
                    `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
                );

            },
            1000
        );

}


function stopCallTimer() {

    if (
        callState.timer
    ) {

        clearInterval(
            callState.timer
        );

        callState.timer =
            null;

    }

}


/* =========================================================
   44. LOCAL MEDIA
   ========================================================= */

async function requestLocalMedia(
    mode
) {

    if (
        callState.localStream
    ) {

        return callState.localStream;

    }


    const constraints = {

        audio:
            true,

        video:
            mode ===
            "video"

    };


    try {

        callState.localStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );


        callState.cameraEnabled =
            mode ===
            "video";


        return callState.localStream;

    } catch (error) {

        console.error(
            "❌ Microphone/camera error:",
            error
        );


        throw new Error(
            "Microphone or camera permission was denied."
        );

    }

}


/* =========================================================
   45. CREATE ROOM
   ========================================================= */

async function createCallRoom(
    type,
    communityId = null
) {

    const payload = {

        room_type:
            type,

        created_by:
            state.user.id,

        is_active:
            true

    };


    /*
     * General calls have no community_id.
     * Community calls receive the UUID community ID.
     */

    if (
        communityId
    ) {

        payload.community_id =
            communityId;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                CALLING.tables.rooms
            )
            .insert(
                payload
            )
            .select()
            .single();


    if (error) {

        console.error(
            "❌ Call room creation failed:",
            error
        );

        throw error;

    }


    return data;

}


/* =========================================================
   46. ADD PARTICIPANT
   ========================================================= */

async function addCallParticipant(
    roomId
) {

    const {
        data,
        error
    } =
        await db
            .from(
                CALLING.tables.participants
            )
            .insert({

                room_id:
                    roomId,

                user_id:
                    state.user.id,

                joined_at:
                    new Date()
                        .toISOString(),

                is_active:
                    true

            })
            .select()
            .single();


    if (error) {

        console.error(
            "❌ Call participant error:",
            error
        );

        throw error;

    }


    return data;

}


/* =========================================================
   47. JOIN EXISTING ROOM
   ========================================================= */

async function joinCallRoom(
    room
) {

    if (
        !room?.id
    ) {

        return;

    }


    if (
        callState.active
    ) {

        toast(
            "You are already in a call.",
            "error"
        );

        return;

    }


    callState.joining =
        true;


    try {

        callState.room =
            room;

        callState.roomId =
            room.id;

        callState.roomType =
            room.room_type ||
            "community";

        callState.communityId =
            room.community_id ||
            null;


        callState.mode =
            room.mode ||
            "voice";


        await requestLocalMedia(
            callState.mode
        );


        await addCallParticipant(
            room.id
        );


        callState.active =
            true;


        showCallUI(
            callState.roomType ===
            "general"
                ? "Mwaniki General Call"
                : (
                    state.currentCommunity?.name ||
                    "Community Call"
                )
        );


        setupCallRealtime(
            room.id
        );


        await loadCallParticipants(
            room.id
        );


        /*
         * Existing participants receive
         * our offer through signaling.
         */

        for (
            const userId of
            callState.participantIds
        ) {

            if (
                String(userId) ===
                String(state.user.id)
            ) {

                continue;

            }


            await createPeerConnection(
                userId,
                true
            );

        }

    } finally {

        callState.joining =
            false;

    }

}


/* =========================================================
   48. START COMMUNITY CALL
   ========================================================= */

async function startCommunityCall(
    mode = "voice"
) {

    if (
        !state.currentCommunity?.id
    ) {

        toast(
            "Select a community first.",
            "error"
        );

        return;

    }


    if (
        callState.active
    ) {

        toast(
            "You are already in a call.",
            "error"
        );

        return;

    }


    try {

        const room =
            await createCallRoom(
                "community",
                state.currentCommunity.id
            );


        room.mode =
            mode;


        await joinCallRoom(
            room
        );


        toast(
            `${mode === "video" ? "Video" : "Voice"} community call started.`,
            "success"
        );


    } catch (error) {

        console.error(
            "❌ Community call failed:",
            error
        );


        toast(
            "Unable to start community call.",
            "error"
        );

    }

}


/* =========================================================
   49. START GENERAL CALL
   ========================================================= */

async function startGeneralCall(
    mode = "voice"
) {

    if (
        callState.active
    ) {

        toast(
            "You are already in a call.",
            "error"
        );

        return;

    }


    try {

        const room =
            await createCallRoom(
                "general",
                null
            );


        room.mode =
            mode;


        await joinCallRoom(
            room
        );


        toast(
            "General call started.",
            "success"
        );


    } catch (error) {

        console.error(
            "❌ General call failed:",
            error
        );


        toast(
            "Unable to start general call.",
            "error"
        );

    }

}


/* =========================================================
   50. LOAD CALL PARTICIPANTS
   ========================================================= */

async function loadCallParticipants(
    roomId
) {

    const {
        data,
        error
    } =
        await db
            .from(
                CALLING.tables.participants
            )
            .select("*")
            .eq(
                "room_id",
                roomId
            )
            .eq(
                "is_active",
                true
            );


    if (error) {

        console.error(
            "❌ Call participants:",
            error
        );

        return [];

    }


    callState.participantIds =
        new Set(
            (
                data ||
                []
            ).map(
                participant =>
                    participant.user_id
            )
        );


    renderCallParticipants(
        data || []
    );


    return data || [];

}


/* =========================================================
   51. RENDER CALL PARTICIPANTS
   ========================================================= */

function renderCallParticipants(
    participants
) {

    const container =
        byId(
            "mwanikiCallParticipants"
        );


    if (!container) return;


    container.innerHTML =
        "";


    participants.forEach(
        participant => {

            const tile =
                document.createElement(
                    "div"
                );


            tile.className =
                "mwaniki-call-tile";


            tile.dataset.userId =
                participant.user_id;


            tile.innerHTML = `

                <div
                    class="mwaniki-call-avatar"
                >
                    ${escapeHTML(
                        initials(
                            String(
                                participant.user_id
                            ).slice(0, 8)
                        )
                    )}
                </div>

                <span>
                    ${String(
                        participant.user_id
                    ) ===
                    String(
                        state.user?.id
                    )
                        ? "You"
                        : "Participant"}
                </span>

            `;


            container.appendChild(
                tile
            );

        }
    );


    attachLocalVideoTile();

}


/* =========================================================
   52. LOCAL VIDEO TILE
   ========================================================= */

function attachLocalVideoTile() {

    if (
        !callState.localStream
    ) {

        return;

    }


    if (
        callState.mode !==
        "video"
    ) {

        return;

    }


    const container =
        byId(
            "mwanikiCallParticipants"
        );


    if (!container) return;


    let video =
        byId(
            "mwanikiLocalVideo"
        );


    if (!video) {

        video =
            document.createElement(
                "video"
            );


        video.id =
            "mwanikiLocalVideo";


        video.autoplay =
            true;


        video.muted =
            true;


        video.playsInline =
            true;


        video.className =
            "mwaniki-call-video";


        container.prepend(
            video
        );

    }


    video.srcObject =
        callState.localStream;

}


/* =========================================================
   53. PEER CONNECTION
   ========================================================= */

async function createPeerConnection(
    userId,
    initiator = false
) {

    if (
        String(userId) ===
        String(state.user.id)
    ) {

        return null;

    }


    if (
        callState.peers.has(
            String(userId)
        )
    ) {

        return callState.peers.get(
            String(userId)
        );

    }


    const peer =
        new RTCPeerConnection({
            iceServers:
                CALLING.iceServers
        });


    callState.peers.set(
        String(userId),
        peer
    );


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

                sendCallSignal({

                    type:
                        "ice-candidate",

                    target_user_id:
                        userId,

                    payload:
                        event.candidate

                });

            }

        };


    peer.ontrack =
        event => {

            const stream =
                event.streams?.[0];


            if (!stream) return;


            callState.remoteStreams.set(
                String(userId),
                stream
            );


            attachRemoteVideo(
                userId,
                stream
            );

        };


    peer.onconnectionstatechange =
        () => {

            console.log(
                "Peer state:",
                userId,
                peer.connectionState
            );


            if (
                [
                    "failed",
                    "closed",
                    "disconnected"
                ].includes(
                    peer.connectionState
                )
            ) {

                removePeer(
                    userId
                );

            }

        };


    if (
        initiator
    ) {

        const offer =
            await peer.createOffer();


        await peer.setLocalDescription(
            offer
        );


        await sendCallSignal({

            type:
                "offer",

            target_user_id:
                userId,

            payload:
                offer

        });

    }


    return peer;

}


/* =========================================================
   54. REMOTE VIDEO
   ========================================================= */

function attachRemoteVideo(
    userId,
    stream
) {

    const container =
        byId(
            "mwanikiCallParticipants"
        );


    if (!container) return;


    let video =
        container.querySelector(
            `[data-remote-user="${CSS.escape(String(userId))}"]`
        );


    if (!video) {

        video =
            document.createElement(
                "video"
            );


        video.autoplay =
            true;


        video.playsInline =
            true;


        video.className =
            "mwaniki-call-video";


        video.dataset.remoteUser =
            String(userId);


        container.appendChild(
            video
        );

    }


    video.srcObject =
        stream;

}


/* =========================================================
   55. CALL SIGNALING
   ========================================================= */

function setupCallRealtime(
    roomId
) {

    if (
        callState.signalChannel
    ) {

        try {

            db.removeChannel(
                callState.signalChannel
            );

        } catch (_) {}

    }


    const channel =
        db.channel(
            `mwaniki-call-${roomId}`
        );


    channel
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table:
                    CALLING.tables.signals,
                filter:
                    `room_id=eq.${roomId}`
            },
            async payload => {

                const signal =
                    payload.new;


                if (
                    String(
                        signal.sender_id
                    ) ===
                    String(
                        state.user.id
                    )
                ) {

                    return;

                }


                if (
                    signal.target_user_id &&
                    String(
                        signal.target_user_id
                    ) !==
                    String(
                        state.user.id
                    )
                ) {

                    return;

                }


                await handleCallSignal(
                    signal
                );

            }
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table:
                    CALLING.tables.participants,
                filter:
                    `room_id=eq.${roomId}`
            },
            async () => {

                await loadCallParticipants(
                    roomId
                );

            }
        )
        .subscribe(
            status => {

                console.log(
                    "📡 Call realtime:",
                    status
                );

            }
        );


    callState.signalChannel =
        channel;


    callState.participantChannel =
        channel;

}


/* =========================================================
   56. SEND CALL SIGNAL
   ========================================================= */

async function sendCallSignal(
    signal
) {

    if (
        !callState.roomId
    ) {

        return;

    }


    const {
        error
    } =
        await db
            .from(
                CALLING.tables.signals
            )
            .insert({

                room_id:
                    callState.roomId,

                sender_id:
                    state.user.id,

                target_user_id:
                    signal.target_user_id ||
                    null,

                signal_type:
                    signal.type,

                payload:
                    signal.payload

            });


    if (error) {

        console.error(
            "❌ Call signal error:",
            error
        );

    }

}


/* =========================================================
   57. HANDLE CALL SIGNAL
   ========================================================= */

async function handleCallSignal(
    signal
) {

    const senderId =
        signal.sender_id;


    if (
        !senderId
    ) {

        return;

    }


    const type =
        signal.signal_type;


    const payload =
        signal.payload;


    let peer =
        callState.peers.get(
            String(senderId)
        );


    if (
        !peer
    ) {

        peer =
            await createPeerConnection(
                senderId,
                false
            );

    }


    if (
        !peer
    ) {

        return;

    }


    if (
        type ===
        "offer"
    ) {

        await peer.setRemoteDescription(
            new RTCSessionDescription(
                payload
            )
        );


        const answer =
            await peer.createAnswer();


        await peer.setLocalDescription(
            answer
        );


        await sendCallSignal({

            type:
                "answer",

            target_user_id:
                senderId,

            payload:
                answer

        });

        return;

    }


    if (
        type ===
        "answer"
    ) {

        if (
            peer.signalingState !==
            "stable"
        ) {

            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    payload
                )
            );

        }

        return;

    }


    if (
        type ===
        "ice-candidate"
    ) {

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    payload
                )
            );

        } catch (error) {

            console.warn(
                "ICE candidate error:",
                error
            );

        }

    }

}


/* =========================================================
   58. MUTE
   ========================================================= */

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


    updateCallControls();

}


/* =========================================================
   59. CAMERA
   ========================================================= */

async function toggleCamera() {

    if (
        callState.mode !==
        "video"
    ) {

        try {

            const camera =
                await navigator.mediaDevices
                    .getUserMedia({
                        video: true
                    });


            if (
                !callState.localStream
            ) {

                callState.localStream =
                    camera;

            } else {

                camera
                    .getVideoTracks()
                    .forEach(
                        track => {

                            callState.localStream
                                .addTrack(
                                    track
                                );


                            callState.peers
                                .forEach(
                                    peer => {

                                        peer.addTrack(
                                            track,
                                            callState.localStream
                                        );

                                    }
                                );

                        }
                    );

            }


            callState.mode =
                "video";


            callState.cameraEnabled =
                true;


            attachLocalVideoTile();


            updateCallControls();


            return;

        } catch (error) {

            toast(
                "Camera permission was denied.",
                "error"
            );

            return;

        }

    }


    const tracks =
        callState.localStream
            ?.getVideoTracks() ||
        [];


    if (!tracks.length) {

        return;

    }


    callState.cameraEnabled =
        !callState.cameraEnabled;


    tracks.forEach(
        track => {

            track.enabled =
                callState.cameraEnabled;

        }
    );


    updateCallControls();

}


/* =========================================================
   60. SCREEN SHARING
   ========================================================= */

async function toggleScreenShare() {

    if (
        callState.screenSharing
    ) {

        await stopScreenShare();

        return;

    }


    if (
        !navigator.mediaDevices
            .getDisplayMedia
    ) {

        toast(
            "Screen sharing is not supported by this browser.",
            "error"
        );

        return;

    }


    try {

        callState.screenStream =
            await navigator.mediaDevices
                .getDisplayMedia({
                    video: true,
                    audio: false
                });


        const screenTrack =
            callState.screenStream
                .getVideoTracks()[0];


        if (!screenTrack) {

            return;

        }


        callState.peers.forEach(
            async peer => {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item.track?.kind ===
                                "video"
                        );


                if (sender) {

                    await sender.replaceTrack(
                        screenTrack
                    );

                } else {

                    peer.addTrack(
                        screenTrack,
                        callState.screenStream
                    );

                }

            }
        );


        callState.screenSharing =
            true;


        screenTrack.onended =
            () => {

                stopScreenShare();

            };


        updateCallControls();

    } catch (error) {

        console.warn(
            "Screen sharing cancelled:",
            error
        );

    }

}


/* =========================================================
   61. STOP SCREEN SHARE
   ========================================================= */

async function stopScreenShare() {

    if (
        !callState.screenStream
    ) {

        return;

    }


    callState.screenStream
        .getTracks()
        .forEach(
            track =>
                track.stop()
        );


    callState.screenStream =
        null;


    callState.screenSharing =
        false;


    updateCallControls();

}


/* =========================================================
   62. CALL CONTROLS
   ========================================================= */

function updateCallControls() {

    setText(
        "mwanikiMuteButton",
        callState.muted
            ? "🔇 Unmute"
            : "🎙️ Mute"
    );


    setText(
        "mwanikiCameraButton",
        callState.cameraEnabled
            ? "📷 Camera Off"
            : "📷 Camera"
    );


    setText(
        "mwanikiScreenButton",
        callState.screenSharing
            ? "🖥️ Stop Sharing"
            : "🖥️ Screen"
    );

}


/* =========================================================
   63. REMOVE PEER
   ========================================================= */

function removePeer(
    userId
) {

    const key =
        String(userId);


    const peer =
        callState.peers.get(
            key
        );


    if (peer) {

        try {

            peer.close();

        } catch (_) {}

    }


    callState.peers.delete(
        key
    );


    callState.remoteStreams.delete(
        key
    );


    const video =
        document.querySelector(
            `[data-remote-user="${CSS.escape(key)}"]`
        );


    if (video) {

        video.remove();

    }

}


/* =========================================================
   64. LEAVE CALL
   ========================================================= */

async function leaveCall() {

    if (
        callState.leaving
    ) {

        return;

    }


    callState.leaving =
        true;


    try {

        if (
            callState.roomId &&
            state.user?.id
        ) {

            await db
                .from(
                    CALLING.tables.participants
                )
                .update({
                    is_active:
                        false,

                    left_at:
                        new Date()
                            .toISOString()
                })
                .eq(
                    "room_id",
                    callState.roomId
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        }


        callState.peers
            .forEach(
                peer => {

                    try {

                        peer.close();

                    } catch (_) {}

                }
            );


        callState.peers.clear();


        if (
            callState.localStream
        ) {

            callState.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (
            callState.screenStream
        ) {

            callState.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (
            callState.signalChannel
        ) {

            try {

                await db.removeChannel(
                    callState.signalChannel
                );

            } catch (_) {}

        }


        callState.active =
            false;

        callState.room =
            null;

        callState.roomId =
            null;

        callState.roomType =
            null;

        callState.communityId =
            null;

        callState.localStream =
            null;

        callState.screenStream =
            null;

        callState.signalChannel =
            null;

        callState.participantChannel =
            null;

        callState.participantIds =
            new Set();

        callState.remoteStreams.clear();

        callState.muted =
            false;

        callState.cameraEnabled =
            false;

        callState.screenSharing =
            false;

        callState.startedAt =
            null;


        hideCallUI();


        toast(
            "You left the call.",
            "success"
        );

    } catch (error) {

        console.error(
            "❌ Leave call error:",
            error
        );

    } finally {

        callState.leaving =
            false;

    }

}


/* =========================================================
   65. LEGACY / EXISTING CALL BUTTONS
   ========================================================= */

async function handleVoiceButton() {

    await startCommunityCall(
        "voice"
    );

}


async function handleVideoButton() {

    await startCommunityCall(
        "video"
    );

}


/* =========================================================
   66. GENERAL CALL BUTTONS
   ========================================================= */

function setupGeneralCallButtons() {

    const selectors = [

        "#generalCallButton",

        "#startGeneralCallButton",

        "[data-general-call]",

        "[data-call-general]"

    ];


    const elements =
        queryAll(
            selectors.join(",")
        );


    elements.forEach(
        button => {

            if (
                button.dataset.callBound ===
                "true"
            ) {

                return;

            }


            button.dataset.callBound =
                "true";


            button.addEventListener(
                "click",
                async () => {

                    const mode =
                        button.dataset.callMode ===
                        "video"
                            ? "video"
                            : "voice";


                    await startGeneralCall(
                        mode
                    );

                }
            );

        }
    );

}


/* =========================================================
   67. COMMUNITY CALL BUTTONS
   ========================================================= */

function setupCommunityCallButtons() {

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


    queryAll(
        "[data-community-call]"
    ).forEach(
        button => {

            if (
                button.dataset.callBound ===
                "true"
            ) {

                return;

            }


            button.dataset.callBound =
                "true";


            button.addEventListener(
                "click",
                async () => {

                    const mode =
                        button.dataset.callMode ===
                        "video"
                            ? "video"
                            : "voice";


                    await startCommunityCall(
                        mode
                    );

                }
            );

        }
    );

}


/* =========================================================
   68. INITIAL EVENT SETUP
   ========================================================= */

function setupEvents() {

    setupSearchEvents();

    setupMessageComposer();

    setupCommunityEvents();

    setupCommunityCallButtons();

    setupGeneralCallButtons();

}


/* =========================================================
   69. BROWSER CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            callState.active
        ) {

            /*
             * Browser unload cannot reliably await
             * Supabase requests, but stopping local
             * media is still important.
             */

            callState.peers
                .forEach(
                    peer => {

                        try {

                            peer.close();

                        } catch (_) {}

                    }
                );


            if (
                callState.localStream
            ) {

                callState.localStream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

            }


            if (
                callState.screenStream
            ) {

                callState.screenStream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

            }

        }

    }
);


/* =========================================================
   70. PUBLIC API
   ========================================================= */

window.mwanikiCommunity = {

    state,

    refresh:
        async () => {

            await loadCommunities();

            const community =
                chooseInitialCommunity();

            if (community) {

                await selectCommunity(
                    community
                );

            }

        },

    selectCommunity,

    selectChannel,

    sendMessage,

    cancelReply,

    loadCommunities,

    loadChannels,

    loadMessages,

    startCommunityVoice:
        () =>
            startCommunityCall(
                "voice"
            ),

    startCommunityVideo:
        () =>
            startCommunityCall(
                "video"
            ),

    startGeneralVoice:
        () =>
            startGeneralCall(
                "voice"
            ),

    startGeneralVideo:
        () =>
            startGeneralCall(
                "video"
            ),

    leaveCall,

    toggleMute,

    toggleCamera,

    toggleScreenShare,

    callState

};


/* =========================================================
   71. INITIALIZATION
   ========================================================= */

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


    /*
     * Set up UI first so the page is
     * immediately interactive.
     */

    setupEvents();


    setupAuthListener();


    console.log(
        "🔵 Loading student profile..."
    );


    await loadStudentProfile();


    console.log(
        "🔵 Loading courses..."
    );


    await loadCourses();


    console.log(
        "🔵 Loading communities..."
    );


    await loadCommunities();


    console.log(
        "🔵 Communities loaded:",
        state.communities.length
    );


    if (
        !state.communities.length
    ) {

        const rail =
            byId(
                "communityRail"
            );


        if (rail) {

            rail.innerHTML = `
                <div class="channel-loading">
                    No communities found.
                </div>
            `;

        }


        const channelList =
            byId(
                "channelList"
            );


        if (channelList) {

            channelList.innerHTML = `
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


    ensureCallUI();


    state.initialized =
        true;


    console.log(
        "✅ Mwaniki Community fully initialized."
    );

}


initialize()
    .catch(
        error => {

            console.error(
                "🔥 Community initialization failed:",
                error
            );


            toast(
                "Community page failed to initialize.",
                "error"
            );

        }
    );


})();
