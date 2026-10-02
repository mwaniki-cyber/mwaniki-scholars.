/* ============================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js

   RESPONSIBILITIES:
   - Authentication
   - Student profile
   - Courses
   - Communities
   - Channels
   - Community members
   - Messages
   - Replies
   - Message search
   - Presence
   - Realtime messages/channels/members
   - Community/channel creation
   - Mobile drawers

   IMPORTANT:
   - NO CALL ENGINE HERE
   - NO WebRTC HERE
   - NO UUID CALL INPUT HERE
   - Calls are handled by community-calls.js
   ============================================================ */

import { supabase } from "./supabase.js";


(() => {

    "use strict";


    console.log(
        "🚀 Mwaniki Scholars Community Engine loading..."
    );


    /* ========================================================
       SUPABASE
       ======================================================== */

    const db = supabase;


    if (!db) {

        console.error(
            "❌ Supabase client is unavailable."
        );

        return;

    }


    /* ========================================================
       APPLICATION STATE
       ======================================================== */

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


    /* ========================================================
       STORAGE
       ======================================================== */

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


    /* ========================================================
       ROLE ORDER
       ======================================================== */

    const ROLE_ORDER = {

        super_admin: 5,

        admin: 4,

        moderator: 3,

        tutor: 2,

        student: 1

    };


    /* ========================================================
       DOM HELPERS
       ======================================================== */

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


    /* ========================================================
       SECURITY
       ======================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

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


    /* ========================================================
       TOAST
       ======================================================== */

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

        clearTimeout(toastTimer);

        toastTimer =
            setTimeout(() => {

                element.classList.remove("show");
                element.classList.remove("visible");
                element.classList.remove("active");

            }, 3200);

    }


    /* ========================================================
       DATE/TIME
       ======================================================== */

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


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    function storageGet(key) {

        try {

            return localStorage.getItem(key);

        } catch {

            return null;

        }

    }


    function storageSet(key, value) {

        try {

            localStorage.setItem(
                key,
                String(value)
            );

        } catch {}

    }


    function storageRemove(key) {

        try {

            localStorage.removeItem(key);

        } catch {}

    }


    /* ========================================================
       AUTH
       ======================================================== */

    async function loadAuthenticatedUser() {

        const {
            data,
            error
        } =
            await db.auth.getUser();

        if (error) {

            console.error(
                "❌ Authentication error:",
                error
            );

            return null;

        }

        return data?.user || null;

    }


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
                "⚠️ Student profile lookup failed:",
                error
            );

            state.profile = null;

            return null;

        }

        state.profile =
            data || null;

        return state.profile;

    }


    function getDisplayName(profile = state.profile) {

        profile =
            profile || {};

        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            state.user?.user_metadata?.full_name ||
            state.user?.user_metadata?.name ||
            state.user?.user_metadata?.display_name ||
            state.user?.email?.split("@")[0] ||
            "Mwaniki Scholar"
        );

    }


    function getProfilePhoto(profile = state.profile) {

        profile =
            profile || {};

        return (
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.profile_image ||
            state.user?.user_metadata?.avatar_url ||
            state.user?.user_metadata?.picture ||
            ""
        );

    }


    /* ========================================================
       COURSES
       ======================================================== */

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

        const configs = [

            {
                id: "communityCourseSelect",
                emptyText: "General Community"
            },

            {
                id: "channelCourseSelect",
                emptyText: "No specific course"
            }

        ];


        configs.forEach(config => {

            const select =
                byId(config.id);

            if (!select) return;

            select.innerHTML = "";


            const empty =
                document.createElement(
                    "option"
                );

            empty.value = "";

            empty.textContent =
                config.emptyText;

            select.appendChild(empty);


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

                select.appendChild(option);

            });

        });

    }


    function findCourse(courseId) {

        if (
            courseId === null ||
            courseId === undefined ||
            courseId === ""
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


    /* ========================================================
       COMMUNITIES
       ======================================================== */

    async function loadCommunities() {

        console.log(
            "🌐 Loading communities..."
        );


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
                "❌ Communities failed to load:",
                error
            );

            state.communities = [];

            renderCommunityRail();

            toast(
                "Unable to load communities.",
                "error"
            );

            return [];

        }


        state.communities =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            "Communities loaded:",
            state.communities.length
        );


        renderCommunityRail();

        return state.communities;

    }


    function renderCommunityRail() {

        const rail =
            byId("communityRail");

        if (!rail) return;


        if (!state.communities.length) {

            rail.innerHTML = `
                <div class="channel-loading">
                    No communities available.
                </div>
            `;

            return;

        }


        rail.innerHTML =
            state.communities
                .map(community => {

                    const active =
                        state.currentCommunity &&
                        String(
                            community.id
                        ) ===
                        String(
                            state.currentCommunity.id
                        );


                    const name =
                        community.name ||
                        "Community";


                    const icon =
                        community.icon_url ||
                        initials(name);


                    const iconMarkup =
                        String(icon)
                            .startsWith("http")
                            ? `
                                <img
                                    src="${escapeHTML(icon)}"
                                    alt=""
                                    loading="lazy"
                                >
                            `
                            : `
                                <span>
                                    ${escapeHTML(icon)}
                                </span>
                            `;


                    return `
                        <button
                            class="community-rail-item ${active ? "active" : ""}"
                            type="button"
                            data-community-id="${escapeAttribute(community.id)}"
                            title="${escapeAttribute(name)}"
                            aria-label="${escapeAttribute(name)}"
                        >

                            <div class="community-rail-icon">
                                ${iconMarkup}
                            </div>

                            <span class="community-rail-name">
                                ${escapeHTML(name)}
                            </span>

                        </button>
                    `;

                })
                .join("");


        queryAll(
            "[data-community-id]",
            rail
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const id =
                        button.dataset.communityId;

                    const community =
                        state.communities.find(
                            item =>
                                String(item.id) ===
                                String(id)
                        );

                    if (!community) return;

                    await selectCommunity(
                        community
                    );

                }
            );

        });

    }


    /* ========================================================
       COMMUNITY MEMBERSHIP
       ======================================================== */

    async function ensureCommunityMembership(
        communityId
    ) {

        if (
            !state.user?.id ||
            !communityId
        ) {

            return null;

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_community_members")
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


        if (error) {

            console.warn(
                "⚠️ Membership lookup failed:",
                error
            );

            return null;

        }


        if (data) {

            return data;

        }


        const {
            data: inserted,
            error: insertError
        } =
            await db
                .from("chat_community_members")
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


        if (insertError) {

            console.warn(
                "⚠️ Could not create community membership:",
                insertError
            );

            return null;

        }


        return inserted;

    }


    async function loadCommunityRole(
        communityId
    ) {

        if (
            !state.user?.id ||
            !communityId
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
                .from("chat_community_members")
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


        if (error || !data) {

            state.currentRole =
                "student";

            return "student";

        }


        state.currentRole =
            data.role ||
            "student";


        if (data.is_banned) {

            toast(
                "You are not allowed to access this community.",
                "error"
            );

        }


        return state.currentRole;

    }


    /* ========================================================
       SELECT COMMUNITY
       ======================================================== */

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

        state.channels =
            [];

        state.members =
            [];

        state.messages =
            [];


        storageSet(
            STORAGE.communityId,
            community.id
        );

        storageSet(
            STORAGE.communityName,
            community.name || ""
        );


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
            byId("activeCommunityIcon");


        if (icon) {

            if (
                community.icon_url &&
                String(
                    community.icon_url
                ).startsWith("http")
            ) {

                icon.innerHTML = `
                    <img
                        src="${escapeAttribute(community.icon_url)}"
                        alt=""
                    >
                `;

            } else {

                icon.textContent =
                    community.icon_url ||
                    initials(
                        community.name
                    );

            }

        }


        await ensureCommunityMembership(
            community.id
        );


        await loadCommunityRole(
            community.id
        );


        setText(
            "activeRoleBadge",
            formatRole(
                state.currentRole
            )
        );


        await loadCommunityCourseContext(
            community
        );


        await loadChannels();


        await loadMembers();


        renderCommunityRail();


        closeChannelDrawer();


        console.log(
            "Community selected:",
            community.name
        );

    }


    function formatRole(role) {

        const value =
            String(
                role ||
                "student"
            ).toLowerCase();

        return value
            .replace(/_/g, " ")
            .replace(/\b\w/g, letter =>
                letter.toUpperCase()
            );

    }


    /* ========================================================
       COURSE CONTEXT
       ======================================================== */

    async function loadCommunityCourseContext(
        community
    ) {

        let courseId =
            community.course_id ||
            storageGet(
                STORAGE.courseId
            );


        if (!courseId) {

            const url =
                new URLSearchParams(
                    window.location.search
                );

            courseId =
                url.get("course_id");

        }


        const course =
            findCourse(courseId);


        state.currentCourse =
            course;


        if (course) {

            storageSet(
                STORAGE.courseId,
                course.id
            );

            storageSet(
                STORAGE.courseName,
                course.title
            );


            setText(
                "communityCourseName",
                course.title
            );


            setText(
                "communityCourseLabel",
                "Course Community"
            );


        } else {

            setText(
                "communityCourseName",
                "General Community"
            );


            setText(
                "communityCourseLabel",
                "Community"
            );

        }

    }


    /* ========================================================
       CHANNELS
       ======================================================== */

    async function loadChannels() {

        if (
            !state.currentCommunity?.id
        ) {

            return [];

        }


        console.log(
            "📚 Loading channels for:",
            state.currentCommunity.name
        );


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
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Channels failed to load:",
                error
            );

            state.channels = [];

            renderChannels();

            toast(
                "Unable to load channels.",
                "error"
            );

            return [];

        }


        state.channels =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            "Channels loaded:",
            state.channels.length
        );


        renderChannels();


        const selected =
            selectBestInitialChannel();


        if (selected) {

            await selectChannel(
                selected,
                {
                    silent: true
                }
            );

        }


        return state.channels;

    }


    function getFilteredChannels() {

        const search =
            state.channelSearch
                .trim()
                .toLowerCase();


        if (!search) {

            return state.channels;

        }


        return state.channels.filter(
            channel => {

                const text =
                    [
                        channel.name,
                        channel.description,
                        channel.channel_type
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                return text.includes(search);

            }
        );

    }


    function renderChannels() {

        const list =
            byId("channelList");

        if (!list) return;


        const channels =
            getFilteredChannels();


        if (!channels.length) {

            list.innerHTML = `
                <div class="channel-loading">
                    No channels found.
                </div>
            `;

            return;

        }


        list.innerHTML =
            channels
                .map(channel => {

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
                            "announcement"
                                ? "📢"
                                : "#"
                        );


                    return `
                        <button
                            class="channel-item ${active ? "active" : ""}"
                            type="button"
                            data-channel-id="${escapeAttribute(channel.id)}"
                        >

                            <span class="channel-item-icon">
                                ${escapeHTML(icon)}
                            </span>

                            <span class="channel-item-main">

                                <strong>
                                    ${escapeHTML(
                                        channel.name ||
                                        "channel"
                                    )}
                                </strong>

                                ${
                                    channel.description
                                        ? `
                                            <small>
                                                ${escapeHTML(
                                                    channel.description
                                                )}
                                            </small>
                                        `
                                        : ""
                                }

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

                })
                .join("");


        queryAll(
            "[data-channel-id]",
            list
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const channel =
                        state.channels.find(
                            item =>
                                String(item.id) ===
                                String(
                                    button.dataset.channelId
                                )
                        );

                    if (!channel) return;


                    const allowed =
                        await canAccessChannel(
                            channel
                        );


                    if (!allowed) {

                        toast(
                            "You do not have access to this channel.",
                            "error"
                        );

                        return;

                    }


                    await selectChannel(
                        channel
                    );

                }
            );

        });

    }


    async function canAccessChannel(
        channel
    ) {

        if (!channel) return false;

        if (!channel.is_private) {

            return true;

        }


        if (!state.user?.id) {

            return false;

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_channel_members")
                .select("id")
                .eq(
                    "channel_id",
                    channel.id
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Private channel access check failed:",
                error
            );

            return false;

        }


        return Boolean(data);

    }


    function selectBestInitialChannel() {

        if (!state.channels.length) {

            return null;

        }


        const stored =
            storageGet(
                "mwanikiChannelId"
            );


        if (stored) {

            const storedChannel =
                state.channels.find(
                    channel =>
                        String(
                            channel.id
                        ) ===
                        String(stored)
                );

            if (storedChannel) {

                return storedChannel;

            }

        }


        const general =
            state.channels.find(
                channel =>
                    String(
                        channel.name || ""
                    ).toLowerCase() ===
                    "general"
            );


        return (
            general ||
            state.channels[0]
        );

    }


    async function selectChannel(
        channel,
        options = {}
    ) {

        if (!channel) return;


        const allowed =
            await canAccessChannel(
                channel
            );


        if (!allowed) {

            toast(
                "You do not have access to this channel.",
                "error"
            );

            return;

        }


        state.currentChannel =
            channel;


        storageSet(
            "mwanikiChannelId",
            channel.id
        );


        setText(
            "activeChannelName",
            channel.name ||
            "general"
        );


        setText(
            "activeChannelDescription",
            channel.description ||
            "Welcome to the community."
        );


        const input =
            byId("messageInput");


        if (input) {

            input.placeholder =
                `Message #${
                    channel.name ||
                    "general"
                }`;

        }


        renderChannels();


        if (!options.silent) {

            closeChannelDrawer();

        }


        await loadMessages();


        markChannelRead();

    }


    /* ========================================================
       MEMBERS
       ======================================================== */

    async function loadMembers() {

        if (
            !state.currentCommunity?.id
        ) {

            return [];

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_community_members")
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
                .order(
                    "joined_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Members failed to load:",
                error
            );

            state.members = [];

            renderMembers();

            return [];

        }


        const members =
            data || [];


        const userIds =
            members
                .map(member =>
                    member.user_id
                )
                .filter(Boolean);


        let profiles = [];


        if (userIds.length) {

            const {
                data: profileData,
                error: profileError
            } =
                await db
                    .from("students")
                    .select("*")
                    .in(
                        "id",
                        userIds
                    );


            if (profileError) {

                console.warn(
                    "⚠️ Member profiles failed:",
                    profileError
                );

            } else {

                profiles =
                    profileData || [];

            }

        }


        const profileMap =
            new Map(
                profiles.map(profile => [
                    String(profile.id),
                    profile
                ])
            );


        state.members =
            members.map(member => ({

                ...member,

                profile:
                    profileMap.get(
                        String(
                            member.user_id
                        )
                    ) ||
                    null

            }));


        renderMembers();


        return state.members;

    }


    function getMemberName(member) {

        const profile =
            member?.profile ||
            {};

        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            member.nickname ||
            "Mwaniki Scholar"
        );

    }


    function getMemberPhoto(member) {

        const profile =
            member?.profile ||
            {};

        return (
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.profile_image ||
            ""
        );

    }


    function renderAvatar(
        name,
        photo,
        className = "avatar"
    ) {

        if (photo) {

            return `
                <div class="${className}">
                    <img
                        src="${escapeAttribute(photo)}"
                        alt="${escapeAttribute(name)}"
                        loading="lazy"
                    >
                </div>
            `;

        }


        return `
            <div class="${className} avatar-initials">
                ${escapeHTML(
                    initials(name)
                )}
            </div>
        `;

    }


    function renderMembers() {

        const list =
            byId("memberList");

        if (!list) return;


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


                    return getMemberName(
                        member
                    )
                        .toLowerCase()
                        .includes(search);

                }
            );


        setText(
            "memberCount",
            `${state.members.length} member${
                state.members.length === 1
                    ? ""
                    : "s"
            }`
        );


        if (!filtered.length) {

            list.innerHTML = `
                <div class="member-loading">
                    No members found.
                </div>
            `;

            return;

        }


        list.innerHTML =
            filtered
                .map(member => {

                    const name =
                        getMemberName(
                            member
                        );

                    const photo =
                        getMemberPhoto(
                            member
                        );

                    const role =
                        formatRole(
                            member.role
                        );


                    const online =
                        isMemberOnline(
                            member
                        );


                    return `
                        <div
                            class="member-item"
                            data-member-id="${escapeAttribute(member.user_id)}"
                        >

                            ${renderAvatar(
                                name,
                                photo,
                                "member-avatar"
                            )}

                            <div class="member-info">

                                <strong>
                                    ${escapeHTML(name)}
                                </strong>

                                <span>
                                    ${escapeHTML(role)}
                                </span>

                            </div>

                            <span
                                class="member-status ${
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

                })
                .join("");

    }


    function isMemberOnline(member) {

        if (!member?.last_seen_at) {

            return false;

        }


        const timestamp =
            new Date(
                member.last_seen_at
            ).getTime();


        if (
            Number.isNaN(timestamp)
        ) {

            return false;

        }


        return (
            Date.now() -
            timestamp
        ) <
        5 * 60 * 1000;

    }


    /* ========================================================
       MESSAGES
       ======================================================== */

    async function loadMessages() {

        if (
            !state.currentChannel?.id
        ) {

            renderMessages();

            return;

        }


        state.loadingMessages =
            true;


        renderMessageLoading();


        const {
            data,
            error
        } =
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
                .limit(200);


        state.loadingMessages =
            false;


        if (error) {

            console.error(
                "❌ Messages failed to load:",
                error
            );

            state.messages = [];

            renderMessagesError();

            return;

        }


        state.messages =
            await enrichMessages(
                data || []
            );


        renderMessages();

    }


    async function enrichMessages(
        messages
    ) {

        if (!messages.length) {

            return [];

        }


        const userIds =
            [
                ...new Set(
                    messages
                        .map(message =>
                            message.user_id
                        )
                        .filter(Boolean)
                )
            ];


        const profileMap =
            new Map();


        if (userIds.length) {

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
                    "⚠️ Message profile lookup failed:",
                    error
                );

            } else {

                (
                    data || []
                ).forEach(profile => {

                    profileMap.set(
                        String(profile.id),
                        profile
                    );

                });

            }

        }


        /*
         * Also use already-loaded community
         * member profiles. This prevents
         * messages from falling back to
         * "Mwaniki Scholar" unnecessarily.
         */

        state.members.forEach(member => {

            if (
                member.user_id &&
                member.profile
            ) {

                profileMap.set(
                    String(
                        member.user_id
                    ),
                    member.profile
                );

            }

        });


        return messages.map(message => ({

            ...message,

            profile:
                profileMap.get(
                    String(
                        message.user_id
                    )
                ) ||
                (
                    message.user_id ===
                    state.user?.id
                        ? state.profile
                        : null
                )

        }));

    }


    function renderMessageLoading() {

        const list =
            byId("messageList");

        if (!list) return;


        list.innerHTML = `
            <div class="channel-loading">
                Loading messages...
            </div>
        `;

    }


    function renderMessagesError() {

        const list =
            byId("messageList");

        if (!list) return;


        list.innerHTML = `
            <div class="channel-loading">
                Unable to load messages.
            </div>
        `;

    }


    function getMessageDisplayName(
        message
    ) {

        const profile =
            message?.profile ||
            {};


        if (
            message?.user_id ===
            state.user?.id
        ) {

            return getDisplayName(
                state.profile
            );

        }


        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            "Mwaniki Scholar"
        );

    }


    function getMessagePhoto(
        message
    ) {

        const profile =
            message?.profile ||
            {};


        if (
            message?.user_id ===
            state.user?.id
        ) {

            return getProfilePhoto(
                state.profile
            );

        }


        return (
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.profile_image ||
            ""
        );

    }


    function renderMessages() {

        const list =
            byId("messageList");

        if (!list) return;


        let messages =
            [...state.messages];


        const search =
            state.messageSearch
                .trim()
                .toLowerCase();


        if (search) {

            messages =
                messages.filter(message =>
                    String(
                        message.content ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search)
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
                                ? "No matching messages"
                                : "Welcome to the channel"
                        }
                    </h2>

                    <p>
                        ${
                            search
                                ? "Try another search."
                                : "Start the discussion and learn with other Mwaniki Scholars."
                        }
                    </p>

                </div>
            `;

            return;

        }


        let previousDate = "";


        list.innerHTML =
            messages
                .map(message => {

                    const name =
                        getMessageDisplayName(
                            message
                        );

                    const photo =
                        getMessagePhoto(
                            message
                        );

                    const dateKey =
                        new Date(
                            message.created_at
                        )
                            .toDateString();


                    let separator = "";


                    if (
                        dateKey !==
                        previousDate
                    ) {

                        separator = `
                            <div class="message-date-separator">
                                <span>
                                    ${escapeHTML(
                                        formatMessageDate(
                                            message.created_at
                                        )
                                    )}
                                </span>
                            </div>
                        `;

                        previousDate =
                            dateKey;

                    }


                    const content =
                        escapeHTML(
                            message.content ||
                            ""
                        )
                            .replace(
                                /\n/g,
                                "<br>"
                            );


                    const own =
                        message.user_id ===
                        state.user?.id;


                    return `
                        ${separator}

                        <article
                            class="message-item ${
                                own
                                    ? "own-message"
                                    : ""
                            }"
                            data-message-id="${escapeAttribute(message.id)}"
                        >

                            ${renderAvatar(
                                name,
                                photo,
                                "message-avatar"
                            )}

                            <div class="message-body">

                                <div class="message-meta">

                                    <strong class="message-author">
                                        ${escapeHTML(name)}
                                    </strong>

                                    ${
                                        message.user_id ===
                                        state.user?.id
                                            ? `
                                                <span class="message-you">
                                                    You
                                                </span>
                                            `
                                            : ""
                                    }

                                    <time>
                                        ${escapeHTML(
                                            formatMessageTime(
                                                message.created_at
                                            )
                                        )}
                                    </time>

                                </div>


                                <div class="message-content">
                                    ${content}
                                </div>


                                <div class="message-actions">

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-reply-message="${escapeAttribute(message.id)}"
                                    >
                                        ↩ Reply
                                    </button>

                                </div>

                            </div>

                        </article>
                    `;

                })
                .join("");


        attachMessageActions();

        list.scrollTop =
            list.scrollHeight;

    }


    function attachMessageActions() {

        queryAll(
            "[data-reply-message]"
        )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const message =
                            state.messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset
                                            .replyMessage
                                    )
                            );

                        if (!message) return;

                        setReply(
                            message
                        );

                    }
                );

            });

    }


    /* ========================================================
       SEND MESSAGE
       ======================================================== */

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
                "You must be signed in.",
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
            byId("messageInput");

        if (!input) return;


        const content =
            input.value.trim();


        if (!content) return;


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
         * Only add reply fields when a reply
         * actually exists. This prevents
         * schema errors if reply support
         * differs between deployments.
         */

        if (
            state.currentReply?.id
        ) {

            payload.reply_to_id =
                state.currentReply.id;

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_messages")
                .insert(payload)
                .select()
                .single();


        state.sendingMessage =
            false;


        if (error) {

            /*
             * If reply_to_id does not exist
             * in the database, retry once
             * without it.
             */

            if (
                payload.reply_to_id
            ) {

                const fallbackPayload = {

                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content

                };


                const retry =
                    await db
                        .from("chat_messages")
                        .insert(
                            fallbackPayload
                        )
                        .select()
                        .single();


                if (
                    !retry.error
                ) {

                    input.value = "";

                    cancelReply();

                    await loadMessages();

                    return;

                }

            }


            console.error(
                "❌ Message send failed:",
                error
            );

            toast(
                error.message ||
                "Message could not be sent.",
                "error"
            );

            return;

        }


        input.value = "";

        cancelReply();


        /*
         * Realtime will normally deliver this.
         * We also refresh locally to make the UI
         * reliable when realtime is delayed.
         */

        if (data) {

            const enriched =
                await enrichMessages(
                    [data]
                );


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
                    ...enriched
                );

                renderMessages();

            }

        }

    }


    /* ========================================================
       REPLY
       ======================================================== */

    function setReply(message) {

        state.currentReply =
            message;


        const preview =
            byId("replyPreview");


        if (!preview) return;


        const text =
            byId(
                "replyPreviewText"
            );


        if (text) {

            text.textContent =
                String(
                    message.content ||
                    ""
                )
                    .slice(0, 180);

        }


        showElement(preview);


        const input =
            byId("messageInput");


        if (input) {

            input.focus();

        }

    }


    function cancelReply() {

        state.currentReply =
            null;


        hideElement(
            byId("replyPreview")
        );

        setText(
            "replyPreviewText",
            ""
        );

    }


    /* ========================================================
       PRESENCE
       ======================================================== */

    async function updatePresence() {

        if (
            !state.user?.id
        ) {

            return;

        }


        const now =
            new Date()
                .toISOString();


        /*
         * IMPORTANT:
         * chat_presence has user_id as
         * its conflict key.
         *
         * Do NOT use:
         * user_id,community_id
         */

        const {
            error
        } =
            await db
                .from("chat_presence")
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

    }


    async function setOfflinePresence() {

        if (
            !state.user?.id
        ) {

            return;

        }


        const now =
            new Date()
                .toISOString();


        await db
            .from("chat_presence")
            .update(
                {
                    status:
                        "offline",

                    last_seen_at:
                        now,

                    updated_at:
                        now

                }
            )
            .eq(
                "user_id",
                state.user.id
            );

    }


    function startPresence() {

        updatePresence();


        clearInterval(
            state.presenceTimer
        );


        state.presenceTimer =
            setInterval(
                updatePresence,
                60 * 1000
            );


        window.addEventListener(
            "beforeunload",
            () => {

                setOfflinePresence();

            }
        );

    }


    /* ========================================================
       READ STATUS
       ======================================================== */

    async function markChannelRead() {

        if (
            !state.user?.id ||
            !state.currentChannel?.id
        ) {

            return;

        }


        /*
         * Only execute this if the table exists
         * with the expected columns.
         */

        const {
            error
        } =
            await db
                .from("chat_read_status")
                .upsert(
                    {
                        user_id:
                            state.user.id,

                        channel_id:
                            state.currentChannel.id,

                        last_read_at:
                            new Date()
                                .toISOString()
                    },
                    {
                        onConflict:
                            "user_id,channel_id"
                    }
                );


        if (error) {

            console.warn(
                "⚠️ Read status update failed:",
                error
            );

        }

    }


    /* ========================================================
       CREATE COMMUNITY
       ======================================================== */

    function canCreateCommunity() {

        const role =
            ROLE_ORDER[
                state.currentRole
            ] || 0;

        return role >=
            ROLE_ORDER.admin;

    }


    function canCreateChannel() {

        const role =
            ROLE_ORDER[
                state.currentRole
            ] || 0;

        return role >=
            ROLE_ORDER.moderator;

    }


    async function createCommunity() {

        if (
            !state.user?.id
        ) {

            toast(
                "You must be signed in.",
                "error"
            );

            return;

        }


        if (!canCreateCommunity()) {

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


        const courseId =
            byId(
                "communityCourseSelect"
            )?.value || null;


        const icon =
            byId(
                "communityIconInput"
            )?.value.trim();


        if (!name) {

            setFormMessage(
                "communityFormMessage",
                "Community name is required.",
                true
            );

            return;

        }


        const slug =
            await makeUniqueCommunitySlug(
                slugify(name)
            );


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


        /*
         * Add course_id only when a course was
         * explicitly selected. This keeps the
         * request compatible with schemas where
         * course_id is optional.
         */

        if (courseId) {

            payload.course_id =
                Number(courseId);

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_communities")
                .insert(payload)
                .select()
                .single();


        if (error) {

            /*
             * If the community table does not
             * have course_id, retry without it.
             */

            if (
                courseId &&
                /course_id/i.test(
                    error.message || ""
                )
            ) {

                delete payload.course_id;


                const retry =
                    await db
                        .from(
                            "chat_communities"
                        )
                        .insert(payload)
                        .select()
                        .single();


                if (
                    !retry.error
                ) {

                    await finishCommunityCreation(
                        retry.data
                    );

                    return;

                }

            }


            console.error(
                "❌ Community creation failed:",
                error
            );

            setFormMessage(
                "communityFormMessage",
                error.message ||
                "Community could not be created.",
                true
            );

            return;

        }


        await finishCommunityCreation(
            data
        );

    }


    async function finishCommunityCreation(
        community
    ) {

        if (!community) return;


        closeModal(
            "communityModal"
        );


        resetCommunityForm();


        await loadCommunities();


        const fresh =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(community.id)
            ) ||
            community;


        await selectCommunity(
            fresh
        );


        toast(
            "Community created successfully.",
            "success"
        );

    }


    async function makeUniqueCommunitySlug(
        baseSlug
    ) {

        let slug =
            baseSlug ||
            `community-${Date.now()}`;


        const {
            data
        } =
            await db
                .from("chat_communities")
                .select("slug")
                .like(
                    "slug",
                    `${slug}%`
                );


        const existing =
            new Set(
                (data || [])
                    .map(item =>
                        String(
                            item.slug
                        )
                    )
            );


        if (!existing.has(slug)) {

            return slug;

        }


        let number = 2;


        while (
            existing.has(
                `${slug}-${number}`
            )
        ) {

            number++;

        }


        return `${slug}-${number}`;

    }


    function resetCommunityForm() {

        const form =
            byId("communityForm");

        if (form) {

            form.reset();

        }


        setFormMessage(
            "communityFormMessage",
            "",
            false
        );

    }


    /* ========================================================
       CREATE CHANNEL
       ======================================================== */

    async function createChannel() {

        if (
            !state.user?.id
        ) {

            toast(
                "You must be signed in.",
                "error"
            );

            return;

        }


        if (
            !state.currentCommunity?.id
        ) {

            toast(
                "Select a community first.",
                "error"
            );

            return;

        }


        if (!canCreateChannel()) {

            toast(
                "You do not have permission to create channels.",
                "error"
            );

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


        const category =
            byId(
                "channelCategoryInput"
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
            null;


        if (!name) {

            setFormMessage(
                "channelFormMessage",
                "Channel name is required.",
                true
            );

            return;

        }


        const existing =
            state.channels.some(
                channel =>
                    String(
                        channel.name ||
                        ""
                    )
                        .toLowerCase() ===
                    name.toLowerCase()
            );


        if (existing) {

            setFormMessage(
                "channelFormMessage",
                "A channel with that name already exists.",
                true
            );

            return;

        }


        const maxPosition =
            state.channels.reduce(
                (max, channel) =>
                    Math.max(
                        max,
                        Number(
                            channel.position ||
                            0
                        )
                    ),
                0
            );


        const payload = {

            community_id:
                state.currentCommunity.id,

            name,

            slug:
                slugify(name),

            description:
                description ||
                null,

            channel_type:
                category ||
                "text",

            position:
                maxPosition + 1,

            is_private:
                visibility === "private",

            is_archived:
                false,

            is_active:
                true,

            created_by:
                state.user.id

        };


        if (courseId) {

            payload.course_id =
                Number(courseId);

        }


        const {
            data,
            error
        } =
            await db
                .from("chat_channels")
                .insert(payload)
                .select()
                .single();


        if (error) {

            if (
                courseId &&
                /course_id/i.test(
                    error.message || ""
                )
            ) {

                delete payload.course_id;


                const retry =
                    await db
                        .from("chat_channels")
                        .insert(payload)
                        .select()
                        .single();


                if (!retry.error) {

                    await finishChannelCreation(
                        retry.data
                    );

                    return;

                }

            }


            console.error(
                "❌ Channel creation failed:",
                error
            );

            setFormMessage(
                "channelFormMessage",
                error.message ||
                "Channel could not be created.",
                true
            );

            return;

        }


        await finishChannelCreation(
            data
        );

    }


    async function finishChannelCreation(
        channel
    ) {

        closeModal(
            "channelModal"
        );


        resetChannelForm();


        await loadChannels();


        const fresh =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(channel.id)
            );


        if (fresh) {

            await selectChannel(
                fresh
            );

        }


        toast(
            "Channel created successfully.",
            "success"
        );

    }


    function resetChannelForm() {

        const form =
            byId("channelForm");

        if (form) {

            form.reset();

        }


        setFormMessage(
            "channelFormMessage",
            "",
            false
        );

    }


    function setFormMessage(
        id,
        message,
        error = false
    ) {

        const element =
            byId(id);

        if (!element) return;


        element.textContent =
            message || "";


        element.classList.toggle(
            "error",
            Boolean(error)
        );

    }


    /* ========================================================
       MODALS
       ======================================================== */

    function openModal(id) {

        showElement(
            byId(id)
        );

    }


    function closeModal(id) {

        hideElement(
            byId(id)
        );

    }


    /* ========================================================
       COMMUNITY MENU
       ======================================================== */

    function toggleCommunityMenu() {

        const menu =
            byId("communityMenu");

        if (!menu) return;


        menu.classList.toggle(
            "hidden"
        );

    }


    function closeCommunityMenu() {

        hideElement(
            byId("communityMenu")
        );

    }


    /* ========================================================
       CHANNEL DRAWER
       ======================================================== */

    function openChannelDrawer() {

        const sidebar =
            byId("channelSidebar");

        if (!sidebar) return;


        sidebar.classList.add(
            "mobile-open"
        );


        showElement(
            byId(
                "communityDrawerOverlay"
            )
        );


        state.drawerOverlayActive =
            true;

    }


    function closeChannelDrawer() {

        const sidebar =
            byId("channelSidebar");

        if (sidebar) {

            sidebar.classList.remove(
                "mobile-open"
            );

        }


        if (
            !byId("memberSidebar")?.classList.contains(
                "mobile-open"
            )
        ) {

            hideElement(
                byId(
                    "communityDrawerOverlay"
                )
            );

            state.drawerOverlayActive =
                false;

        }

    }


    /* ========================================================
       MEMBER DRAWER
       ======================================================== */

    function openMemberDrawer() {

        const sidebar =
            byId("memberSidebar");

        if (!sidebar) return;


        sidebar.classList.add(
            "mobile-open"
        );


        showElement(
            byId(
                "communityDrawerOverlay"
            )
        );


        state.drawerOverlayActive =
            true;

    }


    function closeMemberDrawer() {

        const sidebar =
            byId("memberSidebar");

        if (sidebar) {

            sidebar.classList.remove(
                "mobile-open"
            );

        }


        if (
            !byId("channelSidebar")?.classList.contains(
                "mobile-open"
            )
        ) {

            hideElement(
                byId(
                    "communityDrawerOverlay"
                )
            );

            state.drawerOverlayActive =
                false;

        }

    }


    /* ========================================================
       COMMUNITY REFRESH
       ======================================================== */

    async function refreshCommunity() {

        if (!state.currentCommunity) {

            await loadCommunities();

            if (
                state.communities.length
            ) {

                await selectCommunity(
                    state.communities[0]
                );

            }

            return;

        }


        await loadCourses();

        await loadCommunities();


        const refreshed =
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(
                        state.currentCommunity.id
                    )
            );


        if (refreshed) {

            await selectCommunity(
                refreshed
            );

        }

    }


    /* ========================================================
       REALTIME
       ======================================================== */

    function cleanupRealtime() {

        state.realtimeChannels.forEach(
            channel => {

                try {

                    db.removeChannel(
                        channel
                    );

                } catch {}

            }
        );


        state.realtimeChannels =
            [];

    }


    function setupRealtime() {

        cleanupRealtime();


        /*
         * MESSAGE REALTIME
         */

        if (
            state.currentChannel?.id
        ) {

            subscribeToCurrentChannel();

        }


        /*
         * COMMUNITY CHANNEL CHANGES
         */

        if (
            state.currentCommunity?.id
        ) {

            const channel =
                db
                    .channel(
                        `community-${state.currentCommunity.id}`
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
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
                            event: "*",
                            schema: "public",
                            table:
                                "chat_community_members",
                            filter:
                                `community_id=eq.${state.currentCommunity.id}`
                        },
                        async () => {

                            await loadMembers();

                        }
                    )
                    .subscribe();


            state.realtimeChannels.push(
                channel
            );

        }

    }


    function subscribeToCurrentChannel() {

        if (
            !state.currentChannel?.id
        ) {

            return;

        }


        const channelId =
            state.currentChannel.id;


        const channel =
            db
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
                            await enrichMessages(
                                [
                                    payload.new
                                ]
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


                        if (!exists) {

                            state.messages.push(
                                ...incoming
                            );

                            renderMessages();

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

                        const enriched =
                            await enrichMessages(
                                [
                                    payload.new
                                ]
                            );


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

                            state.messages[index] =
                                enriched[0];

                        }


                        renderMessages();

                    }
                )
                .subscribe();


        state.realtimeChannels.push(
            channel
        );

    }


    /* ========================================================
       SEARCH
       ======================================================== */

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


    function toggleMessageSearch() {

        const panel =
            byId(
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

                input.value = "";

            }

            renderMessages();

        }

    }


    /* ========================================================
       EVENT BINDING
       ======================================================== */

    function bindEvents() {

        /*
         * MESSAGE FORM
         */

        byId(
            "messageForm"
        )?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                sendMessage();

            }
        );


        /*
         * ENTER TO SEND
         */

        byId(
            "messageInput"
        )?.addEventListener(
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
         * REPLY
         */

        byId(
            "cancelReplyButton"
        )?.addEventListener(
            "click",
            cancelReply
        );


        /*
         * CHANNEL DRAWER
         */

        byId(
            "channelToggleButton"
        )?.addEventListener(
            "click",
            openChannelDrawer
        );


        /*
         * MEMBER DRAWER
         */

        byId(
            "memberToggleButton"
        )?.addEventListener(
            "click",
            openMemberDrawer
        );


        byId(
            "closeMemberSidebarButton"
        )?.addEventListener(
            "click",
            closeMemberDrawer
        );


        byId(
            "communityDrawerOverlay"
        )?.addEventListener(
            "click",
            () => {

                closeChannelDrawer();

                closeMemberDrawer();

            }
        );


        /*
         * MESSAGE SEARCH
         */

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


        /*
         * COMMUNITY MENU
         */

        byId(
            "communityMenuButton"
        )?.addEventListener(
            "click",
            toggleCommunityMenu
        );


        byId(
            "communityMenuRefresh"
        )?.addEventListener(
            "click",
            async () => {

                closeCommunityMenu();

                await refreshCommunity();

            }
        );


        byId(
            "communityMenuCreateChannel"
        )?.addEventListener(
            "click",
            () => {

                closeCommunityMenu();

                if (
                    canCreateChannel()
                ) {

                    openModal(
                        "channelModal"
                    );

                } else {

                    toast(
                        "You do not have permission to create channels.",
                        "error"
                    );

                }

            }
        );


        byId(
            "communityMenuCreateCommunity"
        )?.addEventListener(
            "click",
            () => {

                closeCommunityMenu();

                if (
                    canCreateCommunity()
                ) {

                    openModal(
                        "communityModal"
                    );

                } else {

                    toast(
                        "You do not have permission to create communities.",
                        "error"
                    );

                }

            }
        );


        /*
         * CREATE COMMUNITY
         */

        byId(
            "createCommunityButton"
        )?.addEventListener(
            "click",
            () => {

                if (
                    canCreateCommunity()
                ) {

                    openModal(
                        "communityModal"
                    );

                } else {

                    toast(
                        "You do not have permission to create communities.",
                        "error"
                    );

                }

            }
        );


        byId(
            "closeCommunityModalButton"
        )?.addEventListener(
            "click",
            () => {

                closeModal(
                    "communityModal"
                );

            }
        );


        byId(
            "cancelCommunityButton"
        )?.addEventListener(
            "click",
            () => {

                closeModal(
                    "communityModal"
                );

                resetCommunityForm();

            }
        );


        byId(
            "communityForm"
        )?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                createCommunity();

            }
        );


        /*
         * CREATE CHANNEL
         */

        byId(
            "createChannelButton"
        )?.addEventListener(
            "click",
            () => {

                if (
                    canCreateChannel()
                ) {

                    openModal(
                        "channelModal"
                    );

                } else {

                    toast(
                        "You do not have permission to create channels.",
                        "error"
                    );

                }

            }
        );


        byId(
            "closeChannelModalButton"
        )?.addEventListener(
            "click",
            () => {

                closeModal(
                    "channelModal"
                );

            }
        );


        byId(
            "cancelChannelButton"
        )?.addEventListener(
            "click",
            () => {

                closeModal(
                    "channelModal"
                );

                resetChannelForm();

            }
        );


        byId(
            "channelForm"
        )?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                createChannel();

            }
        );


        /*
         * ATTACHMENT BUTTON
         */

        byId(
            "attachmentButton"
        )?.addEventListener(
            "click",
            () => {

                toast(
                    "Attachment support will use the community attachment system."
                );

            }
        );


        /*
         * CLOSE MENU WHEN CLICKING OUTSIDE
         */

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


        /*
         * ESCAPE KEY
         */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Escape"
                ) {

                    return;

                }


                closeCommunityMenu();

                closeChannelDrawer();

                closeMemberDrawer();

                closeModal(
                    "communityModal"
                );

                closeModal(
                    "channelModal"
                );

            }
        );

    }


    /* ========================================================
       INITIAL COMMUNITY SELECTION
       ======================================================== */

    async function selectInitialCommunity() {

        if (
            !state.communities.length
        ) {

            return;

        }


        const url =
            new URLSearchParams(
                window.location.search
            );


        const requestedCourseId =
            url.get(
                "course_id"
            );


        /*
         * If opened from a course page,
         * prefer a community linked to
         * that course.
         */

        if (requestedCourseId) {

            const courseCommunity =
                state.communities.find(
                    community =>
                        String(
                            community.course_id
                        ) ===
                        String(
                            requestedCourseId
                        )
                );


            if (courseCommunity) {

                await selectCommunity(
                    courseCommunity
                );

                return;

            }

        }


        /*
         * Restore previous community.
         */

        const storedId =
            storageGet(
                STORAGE.communityId
            );


        if (storedId) {

            const storedCommunity =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            storedId
                        )
                );


            if (storedCommunity) {

                await selectCommunity(
                    storedCommunity
                );

                return;

            }

        }


        /*
         * Otherwise first community.
         */

        await selectCommunity(
            state.communities[0]
        );

    }


    /* ========================================================
       INITIALIZE
       ======================================================== */

    async function initialize() {

        try {

            console.log(
                "🚀 Initializing Mwaniki Community..."
            );


            state.user =
                await loadAuthenticatedUser();


            if (!state.user) {

                console.warn(
                    "⚠️ No authenticated user."
                );


                toast(
                    "Please sign in to access the community.",
                    "error"
                );


                return;

            }


            await loadStudentProfile();


            await loadCourses();


            await loadCommunities();


            await selectInitialCommunity();


            setupSearch();


            bindEvents();


            startPresence();


            setupRealtime();


            state.initialized =
                true;


            console.log(
                "✅ Mwaniki Community fully initialized."
            );


        } catch (error) {

            console.error(
                "❌ Mwaniki Community initialization failed:",
                error
            );


            toast(
                "Community initialization failed. Check the browser console.",
                "error"
            );

        }

    }


    /* ========================================================
       AUTH LISTENER
       ======================================================== */

    db.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            if (
                event ===
                "SIGNED_OUT"
            ) {

                cleanupRealtime();

                clearInterval(
                    state.presenceTimer
                );

                window.location.href =
                    "./index.html";

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


    /* ========================================================
       PUBLIC API
       ======================================================== */

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

        cancelReply,

        loadCommunities,

        loadChannels,

        loadMembers,

        loadMessages,

        updatePresence,

        getCurrentDisplayName:
            () =>
                getDisplayName(),

        getCurrentProfilePhoto:
            () =>
                getProfilePhoto()

    };


    /* ========================================================
       START
       ======================================================== */

    initialize();


})();
