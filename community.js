/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE COMMUNITY ENGINE
   ============================================================

   FIXES INCLUDED
   ------------------------------------------------------------
   1. Reliable online / away / offline presence
   2. No false Away when another account is active
   3. Presence heartbeat every 15 seconds
   4. Activity-based Away / Idle detection
   5. Community member presence refresh
   6. Real reply support using parent_message_id
   7. Reply preview + cancel reply
   8. Message reaction support
   9. Delete own messages
   10. Moderator deletion
   11. Message realtime INSERT / UPDATE
   12. Typing indicator using Supabase broadcast
   13. Mobile-friendly fixed chat workspace
   14. Composer stays accessible without page scrolling
   15. Enter sends message, Shift+Enter creates newline
   16. Emoji picker support
   17. Member search
   18. Channel search
   19. Community/channel loading
   20. Course-linked channels
   21. Keeps community-calls.js separate
   ============================================================ */

import { supabase } from "./supabase.js";


(() => {

    "use strict";


    /* ============================================================
       SUPABASE
       ============================================================ */

    const db = supabase;

    if (!db) {

        console.error(
            "❌ Mwaniki Community: Supabase client unavailable."
        );

        return;

    }


    console.log(
        "🚀 Mwaniki Scholars Community engine loading..."
    );


    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const CONFIG = {

        presenceHeartbeat: 15000,

        presenceOnlineWindow: 60000,

        presenceAwayWindow: 180000,

        idleAfter: 120000,

        messageLimit: 500,

        typingTimeout: 2500,

        typingThrottle: 1000

    };


    /* ============================================================
       STATE
       ============================================================ */

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

        currentRole: "student",

        currentReply: null,

        currentCourse: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        realtimeChannels: [],

        presenceTimer: null,

        presenceRefreshing: false,

        lastActivity: Date.now(),

        lastPresenceWrite: 0,

        typingTimer: null,

        lastTypingBroadcast: 0,

        initialized: false,

        sendingMessage: false,

        loadingMessages: false,

        emojiOpen: false

    };


    /* ============================================================
       STORAGE
       ============================================================ */

    const STORAGE = {

        communityId:
            "mwanikiCommunityId",

        courseId:
            "communityCourseId",

        courseName:
            "communityCourseName"

    };


    /* ============================================================
       DOM
       ============================================================ */

    const $ = id =>
        document.getElementById(id);


    const q = (
        selector,
        parent = document
    ) =>
        parent.querySelector(selector);


    const qa = (
        selector,
        parent = document
    ) =>
        Array.from(
            parent.querySelectorAll(selector)
        );


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    function escapeHTML(value) {

        return String(
            value ?? ""
        )
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function initials(name) {

        const clean =
            String(
                name || "Student"
            )
                .trim()
                .replace(/\s+/g, " ");

        if (!clean) {
            return "MS";
        }

        const parts =
            clean.split(" ");

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


    function storageGet(key) {

        try {

            return localStorage.getItem(key);

        } catch {

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

        } catch {}

    }


    function show(element) {

        if (!element) return;

        element.classList.remove(
            "hidden"
        );

        element.hidden = false;

    }


    function hide(element) {

        if (!element) return;

        element.classList.add(
            "hidden"
        );

        element.hidden = true;

    }


    function toast(
        message,
        type = "normal"
    ) {

        const element =
            $("communityToast") ||
            $("toast");

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
            "show",
            "visible",
            "active"
        );

        clearTimeout(
            element.__mwanikiToastTimer
        );

        element.__mwanikiToastTimer =
            setTimeout(() => {

                element.classList.remove(
                    "show",
                    "visible",
                    "active"
                );

            }, 3000);

    }


    /* ============================================================
       PROFILE
       ============================================================ */

    function getDisplayName(
        profile = state.profile
    ) {

        return (
            profile?.full_name ||
            profile?.name ||
            profile?.student_name ||
            state.user?.user_metadata?.full_name ||
            state.user?.user_metadata?.name ||
            state.user?.email?.split("@")[0] ||
            "Student"
        );

    }


    function getAvatar(
        profile = state.profile
    ) {

        return (
            profile?.photo_url ||
            profile?.avatar_url ||
            state.user?.user_metadata?.avatar_url ||
            state.user?.user_metadata?.picture ||
            ""
        );

    }


    async function loadProfile() {

        if (!state.user?.id) {
            return;
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
                "⚠️ Student profile load failed:",
                error
            );

            return;

        }

        state.profile =
            data || null;

        updateHeaderProfile();

    }


    function updateHeaderProfile() {

        const name =
            getDisplayName();

        const avatar =
            getAvatar();

        const nameElements = [
            $("headerProfileName"),
            $("profileName")
        ];

        nameElements.forEach(
            element => {

                if (element) {
                    element.textContent =
                        name;
                }

            }
        );


        const avatarElements = [
            $("headerProfileAvatar"),
            $("profileLargeAvatar")
        ];

        avatarElements.forEach(
            element => {

                if (!element) return;

                if (avatar) {

                    if (
                        element.tagName ===
                        "IMG"
                    ) {

                        element.src =
                            avatar;

                        element.alt =
                            name;

                    } else {

                        element.innerHTML =
                            `<img src="${escapeHTML(
                                avatar
                            )}" alt="${escapeHTML(
                                name
                            )}">`;

                    }

                } else {

                    if (
                        element.tagName ===
                        "IMG"
                    ) {

                        element.removeAttribute(
                            "src"
                        );

                        element.alt =
                            initials(name);

                    } else {

                        element.textContent =
                            initials(name);

                    }

                }

            }
        );

    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    function presenceAge(
        timestamp
    ) {

        if (!timestamp) {
            return Infinity;
        }

        const parsed =
            Date.parse(timestamp);

        if (!Number.isFinite(parsed)) {
            return Infinity;
        }

        return Math.max(
            0,
            Date.now() - parsed
        );

    }


    /*
       IMPORTANT:

       The timestamp is authoritative.

       This prevents an old "away" database value from making
       an account look Away even though its heartbeat is fresh.
    */

    function calculatePresence(
        presence,
        member = null
    ) {

        const lastSeen =
            presence?.last_seen_at ||
            member?.last_seen_at ||
            presence?.updated_at ||
            member?.last_active_at ||
            null;

        const age =
            presenceAge(
                lastSeen
            );

        if (
            age <=
            CONFIG.presenceOnlineWindow
        ) {

            if (
                presence?.status ===
                "dnd"
            ) {

                return "dnd";

            }

            return "online";

        }


        if (
            age <=
            CONFIG.presenceAwayWindow
        ) {

            return "away";

        }

        return "offline";

    }


    function presenceLabel(
        status
    ) {

        switch (status) {

            case "online":
                return "Online";

            case "away":
                return "Away / Idle";

            case "dnd":
                return "Do Not Disturb";

            default:
                return "Offline";

        }

    }


    function updateHeaderPresence(
        status
    ) {

        const dot =
            $("headerPresenceDot");

        if (!dot) {
            return;
        }

        dot.classList.remove(
            "online",
            "away",
            "dnd",
            "offline"
        );

        dot.classList.add(
            status || "offline"
        );

        const label =
            presenceLabel(
                status
            );

        dot.title =
            label;

        dot.setAttribute(
            "aria-label",
            label
        );

    }


    function desiredPresence() {

        if (
            document.hidden
        ) {

            return "away";

        }

        const idleFor =
            Date.now() -
            state.lastActivity;

        if (
            idleFor >=
            CONFIG.idleAfter
        ) {

            return "away";

        }

        return "online";

    }


    async function writePresence(
        status
    ) {

        if (
            !state.user?.id ||
            state.presenceRefreshing
        ) {

            return;

        }

        state.presenceRefreshing =
            true;

        const now =
            new Date().toISOString();

        try {

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
                    "⚠️ Presence write failed:",
                    error
                );

                return;

            }


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
                        .update(
                            {
                                status:
                                    status,

                                last_seen_at:
                                    now,

                                last_active_at:
                                    now
                            }
                        )
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
                        "⚠️ Member presence update failed:",
                        memberError
                    );

                }

            }

            state.lastPresenceWrite =
                Date.now();

            updateHeaderPresence(
                status
            );

        } finally {

            state.presenceRefreshing =
                false;

        }

    }


    function registerActivity() {

        state.lastActivity =
            Date.now();

        /*
           If the user becomes active again after being idle,
           the next heartbeat immediately restores Online.
        */

        if (
            Date.now() -
            state.lastPresenceWrite >
            10000
        ) {

            writePresence(
                "online"
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

        state.lastActivity =
            Date.now();

        writePresence(
            "online"
        );


        const activityEvents = [

            "mousemove",
            "mousedown",
            "keydown",
            "touchstart",
            "scroll",
            "pointerdown"

        ];


        activityEvents.forEach(
            eventName => {

                window.addEventListener(
                    eventName,
                    registerActivity,
                    {
                        passive: true
                    }
                );

            }
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.hidden
                ) {

                    writePresence(
                        "away"
                    );

                } else {

                    state.lastActivity =
                        Date.now();

                    writePresence(
                        "online"
                    );

                }

            }
        );


        state.presenceTimer =
            setInterval(
                async () => {

                    const status =
                        desiredPresence();

                    await writePresence(
                        status
                    );

                    await refreshMemberPresence();

                },
                CONFIG.presenceHeartbeat
            );

    }


    /* ============================================================
       MEMBER PRESENCE
       ============================================================ */

    async function refreshMemberPresence() {

        if (
            !state.members.length
        ) {

            return;

        }


        const ids =
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

        if (!ids.length) {
            return;
        }


        const {
            data,
            error
        } =
            await db
                .from("chat_presence")
                .select(
                    "user_id,status,custom_status,last_seen_at,updated_at"
                )
                .in(
                    "user_id",
                    ids
                );

        if (error) {

            console.warn(
                "⚠️ Presence refresh failed:",
                error
            );

            return;

        }


        const presenceMap =
            new Map();

        (
            data || []
        ).forEach(
            row => {

                presenceMap.set(
                    String(row.user_id),
                    row
                );

            }
        );


        state.members =
            state.members.map(
                member => {

                    const presence =
                        presenceMap.get(
                            String(
                                member.user_id
                            )
                        ) || null;

                    return {

                        ...member,

                        presence,

                        computedPresence:
                            calculatePresence(
                                presence,
                                member
                            )

                    };

                }
            );


        renderMembers();


        const me =
            state.members.find(
                member =>
                    String(
                        member.user_id
                    ) ===
                    String(
                        state.user?.id
                    )
            );

        if (me) {

            updateHeaderPresence(
                me.computedPresence ||
                "offline"
            );

        }

    }


    /* ============================================================
       COURSES
       ============================================================ */

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
                "⚠️ Courses could not be loaded:",
                error
            );

            state.courses = [];

            return;

        }

        state.courses =
            data || [];

        populateCourseSelects();

    }


    function populateCourseSelects() {

        [
            $("communityCourseSelect"),
            $("channelCourseSelect")
        ].forEach(
            select => {

                if (!select) {
                    return;
                }

                const existing =
                    select.value;

                const first =
                    select.options[0];

                select.innerHTML =
                    "";

                if (first) {

                    select.appendChild(
                        first
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
                    existing &&
                    Array.from(
                        select.options
                    ).some(
                        option =>
                            option.value ===
                            existing
                    )
                ) {

                    select.value =
                        existing;

                }

            }
        );

    }


    /* ============================================================
       COMMUNITIES
       ============================================================ */

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
                "❌ Communities failed:",
                error
            );

            state.communities =
                [];

            renderCommunityRail();

            return;

        }

        state.communities =
            data || [];

        renderCommunityRail();

    }


    function renderCommunityRail() {

        const rail =
            $("communityRail");

        if (!rail) {
            return;
        }

        if (
            !state.communities.length
        ) {

            rail.innerHTML =
                `<div class="empty-state">
                    No communities
                </div>`;

            return;

        }


        rail.innerHTML =
            state.communities
                .map(
                    community => {

                        const active =
                            String(
                                community.id
                            ) ===
                            String(
                                state.currentCommunity?.id
                            );

                        const icon =
                            community.icon_url;

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

                                ${
                                    icon
                                        ? `
                                            <img
                                                src="${escapeHTML(
                                                    icon
                                                )}"
                                                alt=""
                                            >
                                        `
                                        : `
                                            <span>
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


        qa(
            "[data-community-id]",
            rail
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const community =
                            state.communities.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.communityId
                                    )
                            );

                        if (community) {

                            selectCommunity(
                                community
                            );

                        }

                    }
                );

            }
        );

    }


    /* ============================================================
       COMMUNITY SELECTION
       ============================================================ */

    async function selectCommunity(
        community
    ) {

        if (!community) {
            return;
        }

        state.currentCommunity =
            community;

        storageSet(
            STORAGE.communityId,
            community.id
        );

        storageSet(
            STORAGE.courseName,
            community.name
        );


        renderCommunityRail();


        await loadChannels();

        await loadMembers();

        subscribeCommunityRealtime();

        /*
           Always start in the discussion channel rather than
           accidentally opening Gaming/Memes.
        */

        const discussion =
            findDefaultDiscussionChannel();

        if (discussion) {

            await selectChannel(
                discussion
            );

        } else if (
            state.channels.length
        ) {

            await selectChannel(
                state.channels[0]
            );

        } else {

            clearChat();

        }

    }


    function findDefaultDiscussionChannel() {

        const preferred =
            [
                "general",
                "discussion",
                "main-discussion",
                "chat",
                "lounge"
            ];

        for (
            const wanted of preferred
        ) {

            const found =
                state.channels.find(
                    channel =>
                        String(
                            channel.slug ||
                            channel.name ||
                            ""
                        )
                            .toLowerCase()
                            .replace(/\s+/g, "-") ===
                        wanted
                );

            if (found) {
                return found;
            }

        }

        return (
            state.channels.find(
                channel =>
                    !/gaming|meme/i.test(
                        channel.name || ""
                    )
            ) ||
            null
        );

    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels() {

        if (
            !state.currentCommunity?.id
        ) {

            return;

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
                    "is_archived",
                    false
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
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.error(
                "❌ Channels failed:",
                error
            );

            state.channels =
                [];

            renderChannels();

            return;

        }

        state.channels =
            data || [];

        renderChannels();

    }


    function renderChannels() {

        const list =
            $("channelList");

        if (!list) {
            return;
        }


        let channels =
            state.channels;

        const search =
            state.channelSearch
                .trim()
                .toLowerCase();

        if (search) {

            channels =
                channels.filter(
                    channel =>
                        String(
                            channel.name || ""
                        )
                            .toLowerCase()
                            .includes(
                                search
                            )
                );

        }


        if (!channels.length) {

            list.innerHTML =
                `<div class="empty-state">
                    No channels found.
                </div>`;

            return;

        }


        list.innerHTML =
            channels
                .map(
                    channel => {

                        const active =
                            String(
                                channel.id
                            ) ===
                            String(
                                state.currentChannel?.id
                            );

                        return `
                            <button
                                type="button"
                                class="channel-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-channel-id="${escapeHTML(
                                    channel.id
                                )}"
                            >

                                <span class="channel-item-icon">
                                    ${
                                        escapeHTML(
                                            channel.icon ||
                                            "#"
                                        )
                                    }
                                </span>

                                <span class="channel-item-name">
                                    ${escapeHTML(
                                        channel.name ||
                                        "channel"
                                    )}
                                </span>

                            </button>
                        `;

                    }
                )
                .join("");


        qa(
            "[data-channel-id]",
            list
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const channel =
                            state.channels.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.channelId
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
        );

    }


    async function selectChannel(
        channel
    ) {

        if (!channel) {
            return;
        }


        state.currentChannel =
            channel;

        state.currentReply =
            null;

        storageSet(
            STORAGE.courseId,
            channel.course_id || ""
        );


        updateChannelHeader();

        renderChannels();

        cancelReply();

        await loadMessages(
            channel.id
        );

        subscribeMessageRealtime(
            channel.id
        );

        setupTypingRealtime(
            channel.id
        );

        focusMessageInput();

    }


    function updateChannelHeader() {

        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }


        const title =
            $("channelTitle") ||
            $("chatChannelTitle") ||
            $("currentChannelName");

        if (title) {

            title.textContent =
                channel.name ||
                "channel";

        }


        const description =
            $("channelDescription") ||
            $("chatChannelDescription");

        if (
            description
        ) {

            description.textContent =
                channel.description ||
                "";

        }


        const input =
            $("messageInput");

        if (input) {

            input.placeholder =
                `Message #${
                    channel.name ||
                    "channel"
                }`;

        }

    }


    /* ============================================================
       MEMBERS
       ============================================================ */

    async function loadMembers() {

        if (
            !state.currentCommunity?.id
        ) {

            state.members =
                [];

            renderMembers();

            return;

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
                    last_seen_at,
                    membership_status,
                    badge,
                    display_name,
                    avatar_url,
                    last_active_at,
                    status
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
                "❌ Members failed:",
                error
            );

            state.members =
                [];

            renderMembers();

            return;

        }


        state.members =
            data || [];


        const ids =
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


        let profiles = [];

        if (ids.length) {

            const {
                data: students
            } =
                await db
                    .from("students")
                    .select(
                        "id,full_name,email,photo_url"
                    )
                    .in(
                        "id",
                        ids
                    );

            profiles =
                students || [];

        }


        const profileMap =
            new Map();

        profiles.forEach(
            profile => {

                profileMap.set(
                    String(
                        profile.id
                    ),
                    profile
                );

            }
        );


        state.members =
            state.members.map(
                member => {

                    const profile =
                        profileMap.get(
                            String(
                                member.user_id
                            )
                        ) || null;

                    return {

                        ...member,

                        profile

                    };

                }
            );


        await refreshMemberPresence();

    }


    function renderMembers() {

        const list =
            $("memberList");

        if (!list) {
            return;
        }


        const count =
            $("memberCount");

        if (count) {

            count.textContent =
                String(
                    state.members.length
                );

        }


        let members =
            state.members;

        const search =
            state.memberSearch
                .trim()
                .toLowerCase();

        if (search) {

            members =
                members.filter(
                    member => {

                        const name =
                            getMemberName(
                                member
                            );

                        return name
                            .toLowerCase()
                            .includes(
                                search
                            );

                    }
                );

        }


        if (!members.length) {

            list.innerHTML =
                `<div class="empty-state">
                    No members found.
                </div>`;

            return;

        }


        members.sort(
            (
                a,
                b
            ) => {

                const rank = {
                    online: 0,
                    dnd: 1,
                    away: 2,
                    offline: 3
                };

                return (
                    (rank[
                        a.computedPresence ||
                        "offline"
                    ] ?? 9) -
                    (rank[
                        b.computedPresence ||
                        "offline"
                    ] ?? 9)
                );

            }
        );


        list.innerHTML =
            members
                .map(
                    member => {

                        const name =
                            getMemberName(
                                member
                            );

                        const avatar =
                            getMemberAvatar(
                                member
                            );

                        const status =
                            member.computedPresence ||
                            "offline";

                        const custom =
                            member.presence
                                ?.custom_status ||
                            "";

                        return `
                            <div
                                class="member-row status-${escapeHTML(
                                    status
                                )}"
                                data-member-id="${escapeHTML(
                                    member.user_id
                                )}"
                            >

                                <div class="member-avatar-wrap">

                                    ${
                                        avatar
                                            ? `
                                                <img
                                                    class="member-avatar"
                                                    src="${escapeHTML(
                                                        avatar
                                                    )}"
                                                    alt="${escapeHTML(
                                                        name
                                                    )}"
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

                                    <span
                                        class="presence-dot ${escapeHTML(
                                            status
                                        )}"
                                        title="${escapeHTML(
                                            presenceLabel(
                                                status
                                            )
                                        )}"
                                    ></span>

                                </div>


                                <div class="member-info">

                                    <div class="member-name">
                                        ${escapeHTML(
                                            name
                                        )}
                                    </div>

                                    <div class="member-status-line">

                                        <span class="member-status-text">
                                            ${escapeHTML(
                                                presenceLabel(
                                                    status
                                                )
                                            )}
                                        </span>

                                    </div>

                                    ${
                                        custom
                                            ? `
                                                <div class="member-custom-status">
                                                    ${escapeHTML(
                                                        custom
                                                    )}
                                                </div>
                                            `
                                            : ""
                                    }

                                </div>


                                ${
                                    String(
                                        member.user_id
                                    ) !==
                                    String(
                                        state.user?.id
                                    )
                                        ? `
                                            <div class="member-actions">

                                                <button
                                                    type="button"
                                                    class="member-action-button"
                                                    data-direct-message="${escapeHTML(
                                                        member.user_id
                                                    )}"
                                                    title="Message privately"
                                                >
                                                    💬
                                                </button>

                                                <button
                                                    type="button"
                                                    class="member-action-button"
                                                    data-call-member="${escapeHTML(
                                                        member.user_id
                                                    )}"
                                                    title="Call"
                                                >
                                                    📞
                                                </button>

                                            </div>
                                        `
                                        : ""
                                }

                            </div>
                        `;

                    }
                )
                .join("");


        bindMemberActions();

    }


    function getMemberName(
        member
    ) {

        return (
            member.nickname ||
            member.display_name ||
            member.profile?.full_name ||
            "Student"
        );

    }


    function getMemberAvatar(
        member
    ) {

        return (
            member.avatar_url ||
            member.profile?.photo_url ||
            ""
        );

    }


    function bindMemberActions() {

        qa(
            "[data-direct-message]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        openDirectMessage(
                            button.dataset.directMessage
                        );

                    }
                );

            }
        );


        qa(
            "[data-call-member]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        callMember(
                            button.dataset.callMember
                        );

                    }
                );

            }
        );

    }


    /* ============================================================
       MESSAGES
       ============================================================ */

    async function loadMessages(
        channelId
    ) {

        if (!channelId) {
            return;
        }


        state.loadingMessages =
            true;


        const loading =
            $("messageLoading");

        if (loading) {
            show(loading);
        }


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
                .limit(
                    CONFIG.messageLimit
                );


        state.loadingMessages =
            false;


        if (loading) {
            hide(loading);
        }


        if (error) {

            console.error(
                "❌ Messages failed:",
                error
            );

            state.messages =
                [];

            renderMessages();

            return;

        }


        state.messages =
            data || [];


        await enrichMessages();

        await loadReactions();

        renderMessages();

        scrollMessagesToBottom();

    }


    async function enrichMessages() {

        const ids =
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

        if (!ids.length) {
            return;
        }


        const {
            data,
            error
        } =
            await db
                .from("students")
                .select(
                    "id,full_name,photo_url"
                )
                .in(
                    "id",
                    ids
                );

        if (error) {

            console.warn(
                "⚠️ Message profile enrichment failed:",
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


        state.messages =
            state.messages.map(
                message => ({

                    ...message,

                    profile:
                        map.get(
                            String(
                                message.user_id
                            )
                        ) || null

                })
            );

    }


    /* ============================================================
       REACTIONS
       ============================================================ */

    async function loadReactions() {

        state.reactions =
            [];

        if (!state.messages.length) {
            return;
        }


        const ids =
            state.messages.map(
                message =>
                    message.id
            );


        /*
           We use the common schema:

           message_id
           user_id
           reaction

           If your table uses emoji instead of reaction,
           change REACTION_COLUMN below.
        */

        const {
            data,
            error
        } =
            await db
                .from(
                    "chat_message_reactions"
                )
                .select(
                    "id,message_id,user_id,reaction"
                )
                .in(
                    "message_id",
                    ids
                );


        if (error) {

            /*
               Do not break the chat if the reaction table
               has not yet been configured.
            */

            console.warn(
                "⚠️ Reactions unavailable:",
                error.message
            );

            return;

        }


        state.reactions =
            data || [];

    }


    const REACTIONS = [
        "👍",
        "❤️",
        "😂",
        "😮",
        "😢",
        "👏"
    ];


    function getMessageReactions(
        messageId
    ) {

        return state.reactions.filter(
            reaction =>
                String(
                    reaction.message_id
                ) ===
                String(
                    messageId
                )
        );

    }


    async function toggleReaction(
        message,
        emoji
    ) {

        if (
            !state.user?.id ||
            !message?.id
        ) {

            return;

        }


        const existing =
            state.reactions.find(
                reaction =>
                    String(
                        reaction.message_id
                    ) ===
                    String(
                        message.id
                    ) &&
                    String(
                        reaction.user_id
                    ) ===
                    String(
                        state.user.id
                    ) &&
                    reaction.reaction ===
                    emoji
            );


        if (existing) {

            const {
                error
            } =
                await db
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        existing.id
                    );

            if (error) {

                console.error(
                    "Reaction removal failed:",
                    error
                );

                toast(
                    "Could not remove reaction.",
                    "error"
                );

                return;

            }

        } else {

            const {
                data,
                error
            } =
                await db
                    .from(
                        "chat_message_reactions"
                    )
                    .insert(
                        {
                            message_id:
                                message.id,

                            user_id:
                                state.user.id,

                            reaction:
                                emoji
                        }
                    )
                    .select()
                    .single();

            if (error) {

                console.error(
                    "Reaction failed:",
                    error
                );

                toast(
                    "Could not react to this message.",
                    "error"
                );

                return;

            }

            if (data) {

                state.reactions.push(
                    data
                );

            }

        }


        await loadReactions();

        renderMessages();

    }


    function renderReactionBar(
        message
    ) {

        const reactions =
            getMessageReactions(
                message.id
            );

        const counts =
            new Map();

        reactions.forEach(
            reaction => {

                const emoji =
                    reaction.reaction;

                counts.set(
                    emoji,
                    (
                        counts.get(
                            emoji
                        ) || 0
                    ) + 1
                );

            }
        );


        const existing =
            Array.from(
                counts.entries()
            )
                .map(
                    ([emoji, count]) => {

                        const mine =
                            reactions.some(
                                reaction =>
                                    reaction.reaction ===
                                    emoji &&
                                    String(
                                        reaction.user_id
                                    ) ===
                                    String(
                                        state.user?.id
                                    )
                            );

                        return `
                            <button
                                type="button"
                                class="reaction-chip ${
                                    mine
                                        ? "mine"
                                        : ""
                                }"
                                data-reaction="${escapeHTML(
                                    emoji
                                )}"
                                data-message-id="${escapeHTML(
                                    message.id
                                )}"
                                title="React ${escapeHTML(
                                    emoji
                                )}"
                            >
                                ${escapeHTML(
                                    emoji
                                )}
                                <span>
                                    ${count}
                                </span>
                            </button>
                        `;

                    }
                )
                .join("");


        return `
            <div
                class="message-reactions"
                data-message-reactions
            >

                ${existing}

                <button
                    type="button"
                    class="reaction-add-button"
                    data-reaction-menu="${escapeHTML(
                        message.id
                    )}"
                    title="Add reaction"
                >
                    +
                </button>

            </div>
        `;

    }


    /* ============================================================
       MESSAGE RENDERING
       ============================================================ */

    function formatMessageContent(
        content
    ) {

        return escapeHTML(
            content
        )
            .replace(
                /\n/g,
                "<br>"
            )
            .replace(
                /(^|[\s])@([a-zA-Z0-9._-]+)/g,
                "$1<span class=\"mention\">@$2</span>"
            );

    }


    function renderMessages() {

        const list =
            $("messageList");

        if (!list) {
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
                            message.content || ""
                        )
                            .toLowerCase()
                            .includes(
                                search
                            )
                );

        }


        if (!messages.length) {

            list.innerHTML = `
                <div class="empty-message-state">

                    <div class="empty-message-icon">
                        💬
                    </div>

                    <h3>
                        No messages yet
                    </h3>

                    <p>
                        Start the conversation.
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


        bindMessageActions();

    }


    function renderMessage(
        message
    ) {

        const profile =
            message.profile ||
            {};

        const name =
            profile.full_name ||
            "Student";

        const avatar =
            profile.photo_url ||
            "";

        const own =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );

        const canDelete =
            !message.is_deleted &&
            (
                own ||
                hasModeratorPermission()
            );


        const parent =
            message.parent_message_id
                ? state.messages.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            message.parent_message_id
                        )
                )
                : null;


        if (
            message.is_deleted
        ) {

            return `
                <article
                    class="message-row message-deleted"
                    data-message-id="${escapeHTML(
                        message.id
                    )}"
                >

                    <div class="message-avatar">
                        ${escapeHTML(
                            initials(name)
                        )}
                    </div>

                    <div class="message-content">

                        <div class="message-deleted-text">
                            This message was deleted.
                        </div>

                    </div>

                </article>
            `;

        }


        return `
            <article
                class="message-row ${
                    own
                        ? "own-message"
                        : ""
                } ${
                    message.is_pinned
                        ? "pinned"
                        : ""
                }"
                data-message-id="${escapeHTML(
                    message.id
                )}"
            >

                <div class="message-avatar-wrap">

                    ${
                        avatar
                            ? `
                                <img
                                    class="message-avatar"
                                    src="${escapeHTML(
                                        avatar
                                    )}"
                                    alt="${escapeHTML(
                                        name
                                    )}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="message-avatar">
                                    ${escapeHTML(
                                        initials(name)
                                    )}
                                </div>
                            `
                    }

                </div>


                <div class="message-main">

                    <div class="message-meta">

                        <strong class="message-author">
                            ${escapeHTML(
                                name
                            )}
                        </strong>

                        <span class="message-time">
                            ${escapeHTML(
                                formatMessageTime(
                                    message.created_at
                                )
                            )}
                        </span>

                        ${
                            message.is_edited
                                ? `
                                    <span class="message-edited">
                                        edited
                                    </span>
                                `
                                : ""
                        }

                    </div>


                    ${
                        parent
                            ? `
                                <button
                                    type="button"
                                    class="message-reply-reference"
                                    data-jump-to-message="${escapeHTML(
                                        parent.id
                                    )}"
                                >
                                    ↩ Replying to
                                    ${escapeHTML(
                                        parent.profile?.full_name ||
                                        "Student"
                                    )}:
                                    <span>
                                        ${escapeHTML(
                                            String(
                                                parent.content || ""
                                            )
                                                .substring(
                                                    0,
                                                    100
                                                )
                                        )}
                                    </span>
                                </button>
                            `
                            : ""
                    }


                    <div class="message-body">

                        ${formatMessageContent(
                            message.content
                        )}

                    </div>


                    ${renderReactionBar(
                        message
                    )}


                    <div
                        class="message-actions"
                        data-message-actions
                    >

                        <button
                            type="button"
                            data-message-action="reply"
                            data-message-id="${escapeHTML(
                                message.id
                            )}"
                            title="Reply"
                        >
                            ↩
                            <span>
                                Reply
                            </span>
                        </button>


                        <button
                            type="button"
                            data-message-action="react"
                            data-message-id="${escapeHTML(
                                message.id
                            )}"
                            title="React"
                        >
                            😊
                            <span>
                                React
                            </span>
                        </button>


                        ${
                            canDelete
                                ? `
                                    <button
                                        type="button"
                                        data-message-action="delete"
                                        data-message-id="${escapeHTML(
                                            message.id
                                        )}"
                                        title="Delete"
                                    >
                                        🗑
                                        <span>
                                            Delete
                                        </span>
                                    </button>
                                `
                                : ""
                        }

                    </div>


                    <div
                        class="reaction-picker hidden"
                        data-reaction-picker="${escapeHTML(
                            message.id
                        )}"
                    >

                        ${REACTIONS.map(
                            emoji => `
                                <button
                                    type="button"
                                    data-reaction-emoji="${escapeHTML(
                                        emoji
                                    )}"
                                    data-message-id="${escapeHTML(
                                        message.id
                                    )}"
                                >
                                    ${emoji}
                                </button>
                            `
                        ).join("")}

                    </div>

                </div>

            </article>
        `;

    }


    function formatMessageTime(
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

        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);

    }


    function bindMessageActions() {

        qa(
            "[data-message-action]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        const action =
                            button.dataset.messageAction;

                        const message =
                            state.messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.messageId
                                    )
                            );

                        if (!message) {
                            return;
                        }


                        if (
                            action ===
                            "reply"
                        ) {

                            startReply(
                                message
                            );

                        }


                        if (
                            action ===
                            "react"
                        ) {

                            toggleReactionPicker(
                                message.id
                            );

                        }


                        if (
                            action ===
                            "delete"
                        ) {

                            deleteMessage(
                                message
                            );

                        }

                    }
                );

            }
        );


        qa(
            "[data-reaction]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        const message =
                            state.messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.messageId
                                    )
                            );

                        if (
                            message
                        ) {

                            toggleReaction(
                                message,
                                button.dataset.reaction
                            );

                        }

                    }
                );

            }
        );


        qa(
            "[data-reaction-emoji]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        const message =
                            state.messages.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset.messageId
                                    )
                            );

                        if (
                            message
                        ) {

                            toggleReaction(
                                message,
                                button.dataset.reactionEmoji
                            );

                        }

                        closeAllReactionPickers();

                    }
                );

            }
        );


        qa(
            "[data-reaction-menu]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        toggleReactionPicker(
                            button.dataset.reactionMenu
                        );

                    }
                );

            }
        );


        qa(
            "[data-jump-to-message]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const target =
                            q(
                                `[data-message-id="${CSS.escape(
                                    button.dataset.jumpToMessage
                                )}"]`
                            );

                        if (target) {

                            target.scrollIntoView(
                                {
                                    behavior:
                                        "smooth",
                                    block:
                                        "center"
                                }
                            );

                        }

                    }
                );

            }
        );

    }


    function toggleReactionPicker(
        messageId
    ) {

        closeAllReactionPickers(
            messageId
        );

        const picker =
            q(
                `[data-reaction-picker="${CSS.escape(
                    messageId
                )}"]`
            );

        if (!picker) {
            return;
        }

        picker.classList.toggle(
            "hidden"
        );

    }


    function closeAllReactionPickers(
        except = null
    ) {

        qa(
            "[data-reaction-picker]"
        ).forEach(
            picker => {

                if (
                    String(
                        picker.dataset.reactionPicker
                    ) !==
                    String(except)
                ) {

                    picker.classList.add(
                        "hidden"
                    );

                }

            }
        );

    }


    /* ============================================================
       REPLY
       ============================================================ */

    function startReply(
        message
    ) {

        state.currentReply =
            message;

        const preview =
            $("replyPreview");

        const text =
            $("replyPreviewText");

        if (preview) {
            show(preview);
        }

        if (text) {

            text.textContent =
                `${message.profile?.full_name || "Student"}: ${
                    String(
                        message.content || ""
                    )
                        .substring(
                            0,
                            140
                        )
                }`;

        }

        focusMessageInput();

    }


    function cancelReply() {

        state.currentReply =
            null;

        const preview =
            $("replyPreview");

        if (preview) {
            hide(preview);
        }

        const text =
            $("replyPreviewText");

        if (text) {
            text.textContent =
                "";
        }

    }


    /* ============================================================
       DELETE
       ============================================================ */

    function hasModeratorPermission() {

        const role =
            String(
                state.currentRole ||
                "student"
            ).toLowerCase();

        return [
            "moderator",
            "admin",
            "super_admin"
        ].includes(
            role
        );

    }


    async function deleteMessage(
        message
    ) {

        if (!message?.id) {
            return;
        }


        const allowed =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            ) ||
            hasModeratorPermission();

        if (!allowed) {

            toast(
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


        const now =
            new Date().toISOString();


        const {
            data,
            error
        } =
            await db
                .from("chat_messages")
                .update(
                    {
                        is_deleted:
                            true,

                        deleted_at:
                            now,

                        deleted_by:
                            state.user.id,

                        updated_at:
                            now
                    }
                )
                .eq(
                    "id",
                    message.id
                )
                .select(
                    "id,is_deleted,deleted_at"
                )
                .maybeSingle();


        if (error) {

            console.error(
                "❌ Delete failed:",
                error
            );

            toast(
                "Message could not be deleted.",
                "error"
            );

            return;

        }


        if (!data) {

            toast(
                "The database did not allow this message to be deleted.",
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
                now;

        }


        renderMessages();

        toast(
            "Message deleted.",
            "success"
        );

    }


    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    async function sendMessage(
        event
    ) {

        if (event) {

            event.preventDefault();

        }


        if (
            state.sendingMessage
        ) {

            return;

        }


        if (
            !state.user?.id ||
            !state.currentChannel?.id
        ) {

            toast(
                "Select a channel first.",
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


        state.sendingMessage =
            true;


        const button =
            $("sendMessageButton");

        if (button) {
            button.disabled =
                true;
        }


        stopTypingBroadcast();


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
                state.currentReply?.id ||
                null

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
                    created_at,
                    updated_at
                    `
                )
                .single();


        if (error) {

            console.error(
                "❌ Send message failed:",
                error
            );

            toast(
                "Message could not be sent.",
                "error"
            );

            state.sendingMessage =
                false;

            if (button) {
                button.disabled =
                    false;
            }

            return;

        }


        input.value =
            "";

        autoResizeInput();


        const localMessage = {

            ...data,

            profile:
                state.profile

        };


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
                localMessage
            );

        }


        cancelReply();

        renderMessages();

        scrollMessagesToBottom(
            true
        );


        state.sendingMessage =
            false;

        if (button) {
            button.disabled =
                false;
        }

    }


    /* ============================================================
       SCROLLING
       ============================================================ */

    function scrollMessagesToBottom(
        force = false
    ) {

        const list =
            $("messageList");

        if (!list) {
            return;
        }


        const distance =
            list.scrollHeight -
            list.scrollTop -
            list.clientHeight;


        if (
            force ||
            distance < 180
        ) {

            requestAnimationFrame(
                () => {

                    list.scrollTop =
                        list.scrollHeight;

                }
            );

        }

    }


    function focusMessageInput() {

        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        setTimeout(
            () => {

                try {

                    input.focus(
                        {
                            preventScroll:
                                true
                        }
                    );

                } catch {}

            },
            50
        );

    }


    /* ============================================================
       TYPING INDICATOR
       ============================================================ */

    function setupTypingRealtime(
        channelId
    ) {

        if (!channelId) {
            return;
        }


        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {

                    if (
                        channel.__mwanikiTyping
                    ) {

                        try {

                            db.removeChannel(
                                channel
                            );

                        } catch {}

                        return false;

                    }

                    return true;

                }
            );


        const channel =
            db.channel(
                `typing:${channelId}`
            );


        channel.on(
            "broadcast",
            {
                event:
                    "typing"
            },
            payload => {

                const user =
                    payload?.payload;

                if (
                    !user ||
                    String(
                        user.user_id
                    ) ===
                    String(
                        state.user?.id
                    )
                ) {

                    return;

                }


                const indicator =
                    $("typingIndicator");

                if (!indicator) {
                    return;
                }


                indicator.textContent =
                    `${user.name || "Someone"} is typing…`;

                show(
                    indicator
                );


                clearTimeout(
                    indicator.__mwanikiTypingTimer
                );


                indicator.__mwanikiTypingTimer =
                    setTimeout(
                        () => {

                            hide(
                                indicator
                            );

                        },
                        CONFIG.typingTimeout
                    );

            }
        );


        channel.subscribe(
            status => {

                console.log(
                    "Typing realtime:",
                    status
                );

            }
        );


        channel.__mwanikiTyping =
            true;

        state.realtimeChannels.push(
            channel
        );

    }


    function broadcastTyping() {

        if (
            !state.currentChannel?.id ||
            !state.user?.id
        ) {

            return;

        }


        const now =
            Date.now();

        if (
            now -
            state.lastTypingBroadcast <
            CONFIG.typingThrottle
        ) {

            return;

        }


        state.lastTypingBroadcast =
            now;


        const channel =
            state.realtimeChannels.find(
                item =>
                    item.__mwanikiTyping
            );

        if (!channel) {
            return;
        }


        channel.send(
            {
                type:
                    "broadcast",

                event:
                    "typing",

                payload: {

                    user_id:
                        state.user.id,

                    name:
                        getDisplayName()

                }

            }
        );

    }


    function stopTypingBroadcast() {

        clearTimeout(
            state.typingTimer
        );

        state.typingTimer =
            null;

    }


    /* ============================================================
       MESSAGE REALTIME
       ============================================================ */

    function removeMessageRealtimeChannels() {

        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {

                    if (
                        channel.__mwanikiMessages
                    ) {

                        try {

                            db.removeChannel(
                                channel
                            );

                        } catch {}

                        return false;

                    }

                    return true;

                }
            );

    }


    function subscribeMessageRealtime(
        channelId
    ) {

        if (!channelId) {
            return;
        }


        removeMessageRealtimeChannels();


        const realtime =
            db.channel(
                `messages:${channelId}`
            );


        realtime.on(
            "postgres_changes",
            {
                event:
                    "INSERT",

                schema:
                    "public",

                table:
                    "chat_messages",

                filter:
                    `channel_id=eq.${channelId}`

            },
            async payload => {

                const incoming =
                    payload.new;

                if (!incoming) {
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


                if (
                    !exists
                ) {

                    const ids = [
                        incoming.user_id
                    ];


                    let profile =
                        null;


                    if (
                        incoming.user_id
                    ) {

                        const {
                            data
                        } =
                            await db
                                .from(
                                    "students"
                                )
                                .select(
                                    "id,full_name,photo_url"
                                )
                                .eq(
                                    "id",
                                    incoming.user_id
                                )
                                .maybeSingle();

                        profile =
                            data || null;

                    }


                    state.messages.push(
                        {
                            ...incoming,
                            profile
                        }
                    );


                    renderMessages();

                    scrollMessagesToBottom();

                }

            }
        );


        realtime.on(
            "postgres_changes",
            {
                event:
                    "UPDATE",

                schema:
                    "public",

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
                    ] = {

                        ...state.messages[
                            index
                        ],

                        ...updated

                    };

                }


                renderMessages();

            }
        );


        realtime.subscribe(
            status => {

                console.log(
                    "Message realtime:",
                    status
                );

            }
        );


        realtime.__mwanikiMessages =
            true;

        state.realtimeChannels.push(
            realtime
        );

    }


    /* ============================================================
       COMMUNITY REALTIME
       ============================================================ */

    function subscribeCommunityRealtime() {

        if (
            !state.currentCommunity?.id
        ) {

            return;

        }


        const id =
            state.currentCommunity.id;


        state.realtimeChannels =
            state.realtimeChannels.filter(
                channel => {

                    if (
                        channel.__mwanikiCommunity
                    ) {

                        try {

                            db.removeChannel(
                                channel
                            );

                        } catch {}

                        return false;

                    }

                    return true;

                }
            );


        const channel =
            db.channel(
                `community:${id}`
            );


        channel.on(
            "postgres_changes",
            {
                event:
                    "*",

                schema:
                    "public",

                table:
                    "chat_channels",

                filter:
                    `community_id=eq.${id}`

            },
            async () => {

                await loadChannels();

            }
        );


        channel.on(
            "postgres_changes",
            {
                event:
                    "*",

                schema:
                    "public",

                table:
                    "chat_community_members",

                filter:
                    `community_id=eq.${id}`

            },
            async () => {

                await loadMembers();

            }
        );


        channel.on(
            "postgres_changes",
            {
                event:
                    "*",

                schema:
                    "public",

                table:
                    "chat_presence"

            },
            async () => {

                await refreshMemberPresence();

            }
        );


        channel.subscribe(
            status => {

                console.log(
                    "Community realtime:",
                    status
                );

            }
        );


        channel.__mwanikiCommunity =
            true;

        state.realtimeChannels.push(
            channel
        );

    }


    /* ============================================================
       DIRECT MESSAGES
       ============================================================ */

    function openDirectMessage(
        userId
    ) {

        const member =
            state.members.find(
                item =>
                    String(
                        item.user_id
                    ) ===
                    String(
                        userId
                    )
            );


        if (
            window.mwanikiDirectMessages &&
            typeof
            window.mwanikiDirectMessages.open ===
            "function"
        ) {

            window.mwanikiDirectMessages.open(
                userId
            );

            return;

        }


        /*
           Keep this button functional even if the separate
           DM module is not loaded yet.
        */

        toast(
            member
                ? `Private chat with ${getMemberName(
                    member
                )} is ready for the DM module.`
                : "Private messaging is not available yet.",
            "normal"
        );

    }


    /* ============================================================
       CALL ENGINE BRIDGE
       ============================================================ */

    function getCallEngine() {

        return (
            window.mwanikiCalls ||
            window.mwanikiCallEngine ||
            window.communityCalls ||
            window.calls ||
            null
        );

    }


    async function callMember(
        userId
    ) {

        if (!userId) {
            return;
        }


        const engine =
            getCallEngine();


        if (
            engine &&
            typeof engine.callUser ===
            "function"
        ) {

            await engine.callUser(
                userId
            );

            return;

        }


        if (
            engine &&
            typeof engine.callMember ===
            "function"
        ) {

            await engine.callMember(
                userId
            );

            return;

        }


        toast(
            "The real call engine is not ready.",
            "error"
        );

    }


    /* ============================================================
       UI EVENTS
       ============================================================ */

    function setupEvents() {

        const input =
            $("messageInput");

        if (input) {

            input.addEventListener(
                "input",
                () => {

                    autoResizeInput();

                    broadcastTyping();

                }
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

                        sendMessage(
                            event
                        );

                    }

                }
            );

        }


        const form =
            $("messageForm");

        if (form) {

            form.addEventListener(
                "submit",
                sendMessage
            );

        }


        const send =
            $("sendMessageButton");

        if (
            send &&
            !form
        ) {

            send.addEventListener(
                "click",
                sendMessage
            );

        }


        const cancelReplyButton =
            $("cancelReplyButton");

        if (cancelReplyButton) {

            cancelReplyButton.addEventListener(
                "click",
                cancelReply
            );

        }


        const memberSearch =
            $("memberSearchInput");

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


        const channelSearch =
            $("channelSearchInput");

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


        const messageSearch =
            $("messageSearchInput");

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


        setupPickerEvents();

        setupDrawerEvents();

        setupHomeButton();

        setupGeneralCallButton();

        setupProfileButton();

        setupGlobalClickClose();

    }


    /* ============================================================
       PICKERS
       ============================================================ */

    function setupPickerEvents() {

        const emojiButton =
            $("emojiButton");

        const emojiPanel =
            $("emojiPanel");

        const closeEmoji =
            $("closeEmojiButton");

        if (
            emojiButton &&
            emojiPanel
        ) {

            emojiButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    closeAllPickers();

                    emojiPanel.classList.toggle(
                        "hidden"
                    );

                    state.emojiOpen =
                        !emojiPanel.classList.contains(
                            "hidden"
                        );

                    if (
                        state.emojiOpen
                    ) {

                        renderEmojiGrid();

                    }

                }
            );

        }


        if (closeEmoji) {

            closeEmoji.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    closeAllPickers();

                }
            );

        }

    }


    function renderEmojiGrid() {

        const grid =
            $("emojiGrid");

        if (!grid) {
            return;
        }


        const emojis = [
            "😀",
            "😂",
            "🤣",
            "😊",
            "😍",
            "🥰",
            "😎",
            "🤔",
            "😮",
            "😢",
            "😭",
            "😡",
            "👍",
            "👎",
            "👏",
            "🙏",
            "❤️",
            "🔥",
            "🎉",
            "💯",
            "🧠",
            "🫀",
            "🩺",
            "💊",
            "🧪",
            "📚",
            "🎓",
            "✅"
        ];


        grid.innerHTML =
            emojis
                .map(
                    emoji => `
                        <button
                            type="button"
                            class="emoji-choice"
                            data-emoji="${emoji}"
                        >
                            ${emoji}
                        </button>
                    `
                )
                .join("");


        qa(
            "[data-emoji]",
            grid
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const input =
                            $("messageInput");

                        if (!input) {
                            return;
                        }

                        const start =
                            input.selectionStart ??
                            input.value.length;

                        const end =
                            input.selectionEnd ??
                            input.value.length;

                        input.value =
                            input.value.substring(
                                0,
                                start
                            ) +
                            button.dataset.emoji +
                            input.value.substring(
                                end
                            );

                        input.focus();

                        input.selectionStart =
                            input.selectionEnd =
                                start +
                                button.dataset.emoji.length;

                        autoResizeInput();

                    }
                );

            }
        );

    }


    function closeAllPickers() {

        [
            $("emojiPanel"),
            $("stickerPanel"),
            $("gifPanel")
        ].forEach(
            panel => {

                if (panel) {
                    hide(panel);
                }

            }
        );

        state.emojiOpen =
            false;

        closeAllReactionPickers();

    }


    function setupGlobalClickClose() {

        document.addEventListener(
            "click",
            event => {

                const emojiPanel =
                    $("emojiPanel");

                const emojiButton =
                    $("emojiButton");


                if (
                    emojiPanel &&
                    !emojiPanel.contains(
                        event.target
                    ) &&
                    !emojiButton?.contains(
                        event.target
                    )
                ) {

                    hide(
                        emojiPanel
                    );

                    state.emojiOpen =
                        false;

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

                    closeAllPickers();

                    cancelReply();

                }

            }
        );

    }


    /* ============================================================
       COMPOSER / MOBILE LAYOUT
       ============================================================ */

    function autoResizeInput() {

        const input =
            $("messageInput");

        if (!input) {
            return;
        }


        /*
           The textarea can grow, but never enough to push the
           composer off-screen.
        */

        input.style.height =
            "auto";

        input.style.height =
            Math.min(
                input.scrollHeight,
                120
            ) + "px";

    }


    function injectResponsiveChatLayout() {

        if (
            $("mwanikiCommunityResponsiveCSS")
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );

        style.id =
            "mwanikiCommunityResponsiveCSS";


        style.textContent = `

            html,
            body {
                height: 100%;
                min-height: 100%;
                overflow: hidden;
            }

            body {
                overscroll-behavior: none;
            }

            .community-page,
            .community-layout,
            .app-shell,
            .community-shell {
                height: 100dvh;
                min-height: 0;
            }

            .chat-main {
                min-height: 0 !important;
                height: 100%;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            }

            .message-list {
                flex: 1 1 auto !important;
                min-height: 0 !important;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                overscroll-behavior: contain;
                -webkit-overflow-scrolling: touch;
                padding-bottom: 18px;
            }

            .message-loading,
            .typing-indicator {
                flex: 0 0 auto;
            }

            .message-composer,
            .chat-composer,
            .message-input-area,
            .chat-input-area {
                flex: 0 0 auto !important;
                position: relative !important;
                bottom: auto !important;
                width: 100%;
                z-index: 20;
            }

            #messageInput {
                min-height: 42px;
                max-height: 120px;
                resize: none;
                overflow-y: auto;
            }

            .member-avatar-wrap {
                position: relative;
                width: 40px;
                min-width: 40px;
                height: 40px;
            }

            .member-avatar {
                width: 40px !important;
                height: 40px !important;
                max-width: 40px !important;
                max-height: 40px !important;
                object-fit: cover;
                border-radius: 50%;
            }

            .presence-dot {
                position: absolute;
                right: -1px;
                bottom: -1px;
                width: 11px;
                height: 11px;
                border-radius: 50%;
                border: 2px solid var(--community-panel, #fff);
                display: block;
            }

            .presence-dot.online {
                background: #22c55e;
            }

            .presence-dot.away {
                background: #f59e0b;
            }

            .presence-dot.dnd {
                background: #ef4444;
            }

            .presence-dot.offline {
                background: #94a3b8;
            }

            .member-row {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }

            .member-info {
                min-width: 0;
                flex: 1;
            }

            .member-name {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .member-status-line {
                display: flex;
                align-items: center;
                min-height: 17px;
            }

            .member-status-text {
                font-size: 11px;
                opacity: .72;
            }

            .member-custom-status {
                font-size: 11px;
                opacity: .55;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .member-actions {
                display: flex;
                gap: 4px;
                flex-shrink: 0;
            }

            .member-action-button {
                width: 30px;
                height: 30px;
                border: 0;
                border-radius: 8px;
                cursor: pointer;
            }

            .message-row {
                position: relative;
            }

            .message-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 6px;
            }

            .message-actions button {
                border: 0;
                border-radius: 7px;
                padding: 4px 7px;
                cursor: pointer;
                font-size: 12px;
            }

            .message-reactions {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 5px;
            }

            .reaction-chip,
            .reaction-add-button {
                border: 1px solid rgba(0,0,0,.08);
                border-radius: 999px;
                padding: 2px 8px;
                cursor: pointer;
            }

            .reaction-chip.mine {
                outline: 2px solid rgba(8,127,115,.2);
            }

            .reaction-picker {
                display: flex;
                gap: 4px;
                padding: 7px;
                border-radius: 10px;
                position: absolute;
                z-index: 40;
                margin-top: 4px;
                box-shadow: 0 8px 28px rgba(0,0,0,.16);
            }

            .reaction-picker button {
                width: 32px;
                height: 32px;
                border: 0;
                background: transparent;
                cursor: pointer;
                border-radius: 7px;
                font-size: 18px;
            }

            .reply-preview {
                flex: 0 0 auto;
            }

            .hidden {
                display: none !important;
            }

            @media (max-width: 768px) {

                .chat-main {
                    width: 100%;
                }

                .message-list {
                    padding-left: 10px;
                    padding-right: 10px;
                }

                .message-actions button span {
                    display: none;
                }

                .message-actions button {
                    min-width: 34px;
                    min-height: 32px;
                }

                .message-composer,
                .chat-composer,
                .message-input-area,
                .chat-input-area {
                    padding:
                        7px
                        max(
                            8px,
                            env(safe-area-inset-right)
                        )
                        calc(
                            7px +
                            env(safe-area-inset-bottom)
                        )
                        max(
                            8px,
                            env(safe-area-inset-left)
                        );
                }

                #messageInput {
                    font-size: 16px !important;
                }

            }

            @media (max-width: 480px) {

                .message-avatar {
                    width: 34px !important;
                    height: 34px !important;
                    max-width: 34px !important;
                    max-height: 34px !important;
                }

                .message-avatar-wrap {
                    width: 34px;
                    min-width: 34px;
                    height: 34px;
                }

                .presence-dot {
                    width: 10px;
                    height: 10px;
                }

                .message-row {
                    gap: 7px;
                }

                .message-body {
                    max-width: 100%;
                    overflow-wrap: anywhere;
                }

                .message-composer input,
                .message-composer textarea,
                .chat-composer input,
                .chat-composer textarea {
                    font-size: 16px !important;
                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* ============================================================
       DRAWERS
       ============================================================ */

    function setupDrawerEvents() {

        const channelButton =
            $("channelToggleButton");

        if (channelButton) {

            channelButton.addEventListener(
                "click",
                () => {

                    const sidebar =
                        $("channelSidebar");

                    if (sidebar) {

                        sidebar.classList.toggle(
                            "open"
                        );

                    }

                }
            );

        }


        const memberButton =
            $("channelMembersButton");

        if (memberButton) {

            memberButton.addEventListener(
                "click",
                () => {

                    const sidebar =
                        $("memberSidebar");

                    if (sidebar) {

                        sidebar.classList.toggle(
                            "open"
                        );

                    }

                }
            );

        }

    }


    /* ============================================================
       HOME
       ============================================================ */

    function setupHomeButton() {

        const button =
            $("communityHomeButton");

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./dashboard.html";

            }
        );

    }


    /* ============================================================
       GENERAL CALL
       ============================================================ */

    function setupGeneralCallButton() {

        const button =
            $("generalCallButton");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            () => {

                if (
                    window.mwanikiCalls &&
                    typeof
                    window.mwanikiCalls.openPicker ===
                    "function"
                ) {

                    window.mwanikiCalls.openPicker(
                        null
                    );

                    return;

                }


                if (
                    window.mwanikiCallEngine &&
                    typeof
                    window.mwanikiCallEngine.openPicker ===
                    "function"
                ) {

                    window.mwanikiCallEngine.openPicker(
                        null
                    );

                    return;

                }


                toast(
                    "The call engine is not ready.",
                    "error"
                );

            }
        );

    }


    /* ============================================================
       PROFILE
       ============================================================ */

    function setupProfileButton() {

        const button =
            $("profileButton");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./profile.html";

            }
        );

    }


    /* ============================================================
       CLEAR CHAT
       ============================================================ */

    function clearChat() {

        state.messages =
            [];

        state.currentChannel =
            null;

        const list =
            $("messageList");

        if (list) {

            list.innerHTML =
                `<div class="empty-message-state">
                    Select a channel to start chatting.
                </div>`;

        }

    }


    /* ============================================================
       AUTH
       ============================================================ */

    async function requireAuth() {

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

            return false;

        }


        if (!data?.user) {

            window.location.href =
                "./index.html";

            return false;

        }


        state.user =
            data.user;

        return true;

    }


    function setupAuthListener() {

        db.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {

                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    cleanup();

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


    /* ============================================================
       CLEANUP
       ============================================================ */

    function cleanup() {

        if (
            state.presenceTimer
        ) {

            clearInterval(
                state.presenceTimer
            );

            state.presenceTimer =
                null;

        }


        state.realtimeChannels
            .forEach(
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


    window.addEventListener(
        "beforeunload",
        () => {

            /*
               Do not make an awaited network request here.
               The next user's heartbeat is authoritative.
            */

            cleanup();

        }
    );


    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initialize() {

        if (
            state.initialized
        ) {

            return;

        }


        injectResponsiveChatLayout();


        const authenticated =
            await requireAuth();

        if (!authenticated) {
            return;
        }


        setupAuthListener();

        setupEvents();

        await loadProfile();

        await loadCourses();

        await loadCommunities();


        if (
            !state.communities.length
        ) {

            toast(
                "No active communities were found.",
                "error"
            );

            state.initialized =
                true;

            return;

        }


        /*
           Restore stored community if valid.
        */

        const storedId =
            storageGet(
                STORAGE.communityId
            );


        let initial =
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(
                        storedId
                    )
            );


        /*
           If no stored community exists, use the first
           community — normally Mwaniki Scholars.
        */

        if (!initial) {

            initial =
                state.communities.find(
                    community =>
                        /mwaniki scholars/i.test(
                            community.name || ""
                        )
                ) ||
                state.communities[0];

        }


        await selectCommunity(
            initial
        );


        startPresence();


        state.initialized =
            true;


        console.log(
            "✅ Mwaniki Scholars Community ready."
        );

    }


    /* ============================================================
       GLOBAL API
       ============================================================ */

    window.mwanikiCommunity = {

        state,

        refresh: async () => {

            await loadCommunities();

            if (
                state.currentCommunity
            ) {

                await selectCommunity(
                    state.currentCommunity
                );

            }

        },

        sendMessage,

        deleteMessage,

        startReply,

        cancelReply,

        toggleReaction,

        selectChannel,

        selectCommunity,

        refreshPresence:
            refreshMemberPresence,

        openDirectMessage,

        callMember

    };


    /* ============================================================
       START
       ============================================================ */

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
