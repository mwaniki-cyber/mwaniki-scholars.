/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY + CHAT + CALL ENGINE
   COMPLETE SINGLE-FILE ENGINE
   ========================================================= */

import { supabase } from "./supabase.js";


/* =========================================================
   GLOBAL ENGINE GUARD
   ========================================================= */

if (window.__MWANIKI_COMMUNITY_ENGINE__) {

    console.warn(
        "⚠️ Mwaniki Community Engine already loaded."
    );

} else {

    window.__MWANIKI_COMMUNITY_ENGINE__ = true;

    console.log(
        "🚀 Mwaniki Scholars Community Engine loading..."
    );


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

        currentCourse: null,

        currentRole: "student",

        currentReply: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        profileCache: new Map(),

        realtimeChannels: [],

        callRealtimeChannel: null,

        presenceTimer: null,

        messageSubscription: null,

        initialized: false,

        loadingMessages: false,

        sendingMessage: false,

        drawerOverlayActive: false

    };


    /* =====================================================
       STORAGE
       ===================================================== */

    const STORAGE = {

        communityId:
            "mwanikiCommunityId",

        communityName:
            "mwanikiCommunityName",

        courseId:
            "mwanikiCommunityCourseId",

        courseName:
            "mwanikiCommunityCourseName",

        channelId:
            "mwanikiCommunityChannelId"

    };


    /* =====================================================
       ROLES
       ===================================================== */

    const ROLE_ORDER = {

        super_admin: 5,

        admin: 4,

        moderator: 3,

        tutor: 2,

        student: 1

    };


    /* =====================================================
       CALL PICKER STATE
       ===================================================== */

    const callPickerState = {

        users: [],

        selectedUserIds: new Set(),

        callType: "video",

        scope: "general",

        communityId: null,

        directUserId: null

    };


    /* =====================================================
       ACTIVE CALL STATE
       ===================================================== */

    const callState = {

        active: false,

        room: null,

        callType: "video",

        scope: "general",

        localStream: null,

        screenStream: null,

        peers: new Map(),

        pendingIce: new Map(),

        participantProfiles: new Map(),

        timerInterval: null,

        startedAt: null,

        syncInterval: null,

        realtimeChannel: null,

        minimized: false,

        microphoneEnabled: true,

        cameraEnabled: true,

        screenSharing: false,

        processingSignalIds: new Set()

    };


    /* =====================================================
       DOM HELPERS
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

        if (!element) {
            return;
        }

        element.classList.remove("hidden");

        element.style.display = "";

    }


    function hideElement(element) {

        if (!element) {
            return;
        }

        element.classList.add("hidden");

    }


    function setText(element, value) {

        if (!element) {
            return;
        }

        element.textContent =
            value == null
                ? ""
                : String(value);

    }


    /* =====================================================
       HTML ESCAPING
       ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showToast(message) {

        const toast =
            byId("communityToast");

        if (!toast) {

            console.log(
                "Toast:",
                message
            );

            return;
        }

        toast.textContent =
            message;

        toast.classList.add(
            "show"
        );

        clearTimeout(
            toast.__hideTimer
        );

        toast.__hideTimer =
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
       ERROR DISPLAY
       ===================================================== */

    function displayLoadError(
        element,
        message
    ) {

        if (!element) {
            return;
        }

        element.innerHTML = `
            <div class="community-error">
                <strong>Unable to load</strong>
                <p>
                    ${escapeHTML(message)}
                </p>
            </div>
        `;

    }


    /* =====================================================
       SLUG
       ===================================================== */

    function slugify(value) {

        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 80);

    }


    /* =====================================================
       CURRENT USER NAME
       ===================================================== */

    function getCurrentDisplayName() {

        const profile =
            state.profile || {};

        return (

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            state.user?.user_metadata?.full_name ||

            state.user?.user_metadata?.name ||

            state.user?.email?.split("@")[0] ||

            "Student"

        );

    }


    /* =====================================================
       PROFILE HELPERS
       ===================================================== */

    function getProfileName(profile) {

        if (!profile) {
            return "Online user";
        }

        return (

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            profile.username ||

            "Online user"

        );

    }


    function getProfilePhoto(profile) {

        if (!profile) {
            return "";
        }

        return (

            profile.photo_url ||

            profile.profile_photo ||

            profile.profile_image ||

            profile.avatar_url ||

            profile.image_url ||

            ""

        );

    }


    function getInitials(name) {

        const clean =
            String(name || "User")
                .trim();

        if (!clean) {
            return "U";
        }

        const parts =
            clean
                .split(/\s+/)
                .filter(Boolean);

        if (parts.length === 1) {

            return parts[0]
                .substring(0, 2)
                .toUpperCase();

        }

        return (

            parts[0].charAt(0) +

            parts[
                parts.length - 1
            ].charAt(0)

        ).toUpperCase();

    }


    /* =====================================================
       AUTHENTICATION
       ===================================================== */

    async function loadAuthenticatedUser() {

        const {
            data,
            error
        } =
            await supabase.auth.getSession();

        if (error) {

            throw error;

        }

        const session =
            data?.session;

        if (!session?.user) {

            throw new Error(
                "No active student session. Please sign in."
            );

        }

        state.user =
            session.user;

        console.log(
            "Authenticated user:",
            state.user.id
        );

    }


    /* =====================================================
       LOAD CURRENT PROFILE
       ===================================================== */

    async function loadCurrentProfile() {

        if (!state.user?.id) {
            return;
        }

        const {
            data,
            error
        } =
            await supabase
                .from("students")
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();

        if (error) {

            console.warn(
                "Could not load student profile:",
                error
            );

            state.profile = {

                id:
                    state.user.id,

                full_name:
                    state.user
                        ?.user_metadata
                        ?.full_name ||

                    state.user
                        ?.user_metadata
                        ?.name ||

                    state.user.email
                        ?.split("@")[0] ||

                    "Student"

            };

            return;

        }

        state.profile =
            data || {

                id:
                    state.user.id,

                full_name:
                    state.user.email
                        ?.split("@")[0] ||

                    "Student"

            };

        state.profileCache.set(
            String(state.user.id),
            state.profile
        );

    }


    /* =====================================================
       LOAD COURSES
       ===================================================== */

    async function loadCourses() {

        const {
            data,
            error
        } =
            await supabase
                .from("courses")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.warn(
                "Courses could not be loaded:",
                error
            );

            state.courses = [];

            return;

        }

        state.courses =
            data || [];

    }


    /* =====================================================
       LOAD COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        const rail =
            byId("communityRail");

        try {

            const {
                data,
                error
            } =
                await supabase
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
                data || [];

            console.log(
                "Communities loaded:",
                state.communities.length
            );

            renderCommunities();

        } catch (error) {

            console.error(
                "❌ Failed to load communities:",
                error
            );

            state.communities = [];

            displayLoadError(
                rail,
                error.message ||
                    "Unable to load communities."
            );

            throw error;

        }

    }


    /* =====================================================
       RENDER COMMUNITIES
       ===================================================== */

    function renderCommunities() {

        const rail =
            byId("communityRail");

        if (!rail) {
            return;
        }

        const createButton =
            byId(
                "createCommunityButton"
            );

        rail.innerHTML = "";


        state.communities.forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-rail-item";

                button.dataset.communityId =
                    community.id;

                const icon =
                    community.icon_url;

                button.innerHTML = `

                    <span
                        class="community-rail-icon"
                    >

                        ${
                            icon
                                ? `
                                    <img
                                        src="${escapeHTML(icon)}"
                                        alt=""
                                    >
                                  `
                                : `
                                    ${escapeHTML(
                                        (
                                            community.name ||
                                            "C"
                                        )
                                            .substring(0, 2)
                                            .toUpperCase()
                                    )}
                                  `
                        }

                    </span>

                    <span
                        class="community-rail-name"
                    >
                        ${escapeHTML(
                            community.name
                        )}
                    </span>

                `;

                button.addEventListener(
                    "click",
                    () => {

                        selectCommunity(
                            community.id
                        );

                    }
                );

                rail.appendChild(
                    button
                );

            }
        );


        if (createButton) {

            rail.appendChild(
                createButton
            );

        }

    }


    /* =====================================================
       SELECT COMMUNITY
       ===================================================== */

    async function selectCommunity(
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
                "Community not found."
            );

            return;

        }

        state.currentCommunity =
            community;

        localStorage.setItem(
            STORAGE.communityId,
            community.id
        );

        localStorage.setItem(
            STORAGE.communityName,
            community.name
        );

        state.currentChannel =
            null;

        state.currentCourse =
            null;

        state.currentRole =
            "student";

        await ensureCommunityMembership();

        await loadCommunityMembers();

        await loadChannels();

        renderActiveCommunity();

        subscribeToCommunity();

        if (state.channels.length) {

            const savedChannel =
                localStorage.getItem(
                    STORAGE.channelId
                );

            const channel =
                state.channels.find(
                    item =>
                        String(item.id) ===
                        String(savedChannel)
                ) ||
                state.channels[0];

            await selectChannel(
                channel.id
            );

        } else {

            renderMessagesEmpty();

        }

    }


    /* =====================================================
       ENSURE COMMUNITY MEMBERSHIP
       ===================================================== */

    async function ensureCommunityMembership() {

        if (
            !state.user?.id ||
            !state.currentCommunity?.id
        ) {
            return;
        }

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_community_members"
                )
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
                data.role ||
                "student";

            return;

        }


        /*
         * Try to create membership for public
         * communities if permitted by RLS.
         */

        if (
            state.currentCommunity.is_public
        ) {

            const {
                data: inserted,
                error: insertError
            } =
                await supabase
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

                    })
                    .select("*")
                    .maybeSingle();

            if (
                !insertError &&
                inserted
            ) {

                state.currentRole =
                    inserted.role ||
                    "student";

            }

        }

    }


    /* =====================================================
       LOAD COMMUNITY MEMBERS
       ===================================================== */

    async function loadCommunityMembers() {

        const list =
            byId("memberList");

        if (
            !state.currentCommunity?.id
        ) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "chat_community_members"
                    )
                    .select("*")
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
                throw error;
            }

            state.members =
                data || [];


            const ids =
                state.members
                    .map(
                        member =>
                            member.user_id
                    )
                    .filter(Boolean);


            await loadProfiles(
                ids
            );

            renderMembers();

        } catch (error) {

            console.error(
                "Failed to load members:",
                error
            );

            state.members = [];

            if (list) {

                displayLoadError(
                    list,
                    error.message ||
                        "Unable to load members."
                );

            }

        }

    }


    /* =====================================================
       LOAD PROFILES
       ===================================================== */

    async function loadProfiles(
        userIds
    ) {

        const uniqueIds =
            [
                ...new Set(
                    (userIds || [])
                        .filter(Boolean)
                        .map(String)
                )
            ];

        if (!uniqueIds.length) {
            return;
        }


        const missing =
            uniqueIds.filter(
                id =>
                    !state.profileCache.has(
                        id
                    )
            );


        if (!missing.length) {
            return;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("students")
                .select("*")
                .in(
                    "id",
                    missing
                );


        if (error) {

            console.warn(
                "Could not load profiles:",
                error
            );

            return;

        }


        (data || []).forEach(
            profile => {

                if (profile?.id) {

                    state.profileCache.set(
                        String(profile.id),
                        profile
                    );

                }

            }
        );

    }


    /* =====================================================
       RENDER MEMBERS
       ===================================================== */

    function renderMembers() {

        const list =
            byId("memberList");

        const count =
            byId("memberCount");

        if (!list) {
            return;
        }


        let members =
            [...state.members];


        const search =
            state.memberSearch
                .trim()
                .toLowerCase();


        if (search) {

            members =
                members.filter(
                    member => {

                        const profile =
                            state.profileCache.get(
                                String(
                                    member.user_id
                                )
                            );

                        return getProfileName(
                            profile
                        )
                            .toLowerCase()
                            .includes(search);

                    }
                );

        }


        setText(
            count,
            state.members.length
        );


        if (!members.length) {

            list.innerHTML = `
                <div class="member-empty">
                    No members found.
                </div>
            `;

            return;

        }


        list.innerHTML =
            members
                .map(member => {

                    const profile =
                        state.profileCache.get(
                            String(
                                member.user_id
                            )
                        ) || {};

                    const name =
                        getProfileName(
                            profile
                        );

                    const photo =
                        getProfilePhoto(
                            profile
                        );

                    const initials =
                        getInitials(
                            name
                        );


                    return `

                        <div
                            class="member-item"
                            data-user-id="${escapeHTML(
                                member.user_id
                            )}"
                        >

                            <div
                                class="member-avatar"
                            >

                                ${
                                    photo
                                        ? `
                                            <img
                                                src="${escapeHTML(photo)}"
                                                alt="${escapeHTML(name)}"
                                                loading="lazy"
                                            >
                                          `
                                        : `
                                            <span>
                                                ${escapeHTML(
                                                    initials
                                                )}
                                            </span>
                                          `
                                }

                            </div>


                            <div
                                class="member-info"
                            >

                                <strong>
                                    ${escapeHTML(
                                        name
                                    )}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        member.role ||
                                        "student"
                                    )}
                                </small>

                            </div>


                            ${
                                String(
                                    member.user_id
                                ) !==
                                String(
                                    state.user?.id
                                )
                                    ? `

                                        <div
                                            class="member-call-actions"
                                        >

                                            <button
                                                type="button"
                                                data-direct-call
                                                data-user-id="${escapeHTML(
                                                    member.user_id
                                                )}"
                                                data-call-type="voice"
                                                title="Voice call"
                                            >
                                                📞
                                            </button>

                                            <button
                                                type="button"
                                                data-direct-call
                                                data-user-id="${escapeHTML(
                                                    member.user_id
                                                )}"
                                                data-call-type="video"
                                                title="Video call"
                                            >
                                                🎥
                                            </button>

                                        </div>

                                      `
                                    : ""
                            }

                        </div>

                    `;

                })
                .join("");


        bindDirectCallButtons();

    }


    /* =====================================================
       LOAD CHANNELS
       ===================================================== */

    async function loadChannels() {

        const list =
            byId("channelList");

        if (
            !state.currentCommunity?.id
        ) {
            return;
        }

        try {

            const {
                data,
                error
            } =
                await supabase
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
                throw error;
            }

            state.channels =
                data || [];


            console.log(
                "Channels loaded:",
                state.channels.length
            );


            renderChannels();

        } catch (error) {

            console.error(
                "❌ Failed to load channels:",
                error
            );

            state.channels = [];

            displayLoadError(
                list,
                error.message ||
                    "Unable to load channels."
            );

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


        let channels =
            [...state.channels];


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
                            .includes(search)
                );

        }


        if (!channels.length) {

            list.innerHTML = `
                <div class="channel-empty">
                    No channels available.
                </div>
            `;

            return;

        }


        list.innerHTML =
            channels
                .map(channel => {

                    const active =
                        String(
                            state.currentChannel?.id
                        ) ===
                        String(
                            channel.id
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

                            <span
                                class="channel-icon"
                            >
                                ${
                                    channel.icon ||
                                    "#"
                                }
                            </span>

                            <span
                                class="channel-name"
                            >
                                ${escapeHTML(
                                    channel.name
                                )}
                            </span>

                        </button>

                    `;

                })
                .join("");


        list
            .querySelectorAll(
                "[data-channel-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectChannel(
                            button.dataset.channelId
                        );

                    }
                );

            });

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


        localStorage.setItem(
            STORAGE.channelId,
            channel.id
        );


        state.currentCourse =
            state.courses.find(
                course =>
                    String(course.id) ===
                    String(channel.course_id)
            ) || null;


        renderActiveChannel();

        renderChannels();

        await loadMessages();

        subscribeToMessages();

    }


    /* =====================================================
       RENDER ACTIVE COMMUNITY
       ===================================================== */

    function renderActiveCommunity() {

        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }


        setText(
            byId("activeCommunityName"),
            community.name
        );

        setText(
            byId("activeCommunityDescription"),
            community.description ||
                "Community"
        );


        const icon =
            byId("activeCommunityIcon");

        if (icon) {

            if (community.icon_url) {

                icon.innerHTML = `
                    <img
                        src="${escapeHTML(
                            community.icon_url
                        )}"
                        alt=""
                    >
                `;

            } else {

                icon.textContent =
                    (
                        community.name ||
                        "C"
                    )
                        .substring(0, 2)
                        .toUpperCase();

            }

        }


        const courseBanner =
            byId(
                "communityCourseBanner"
            );

        if (courseBanner) {

            if (
                state.currentCourse
            ) {

                showElement(
                    courseBanner
                );

                setText(
                    byId(
                        "communityCourseName"
                    ),
                    state.currentCourse.title
                );

                setText(
                    byId(
                        "communityCourseLabel"
                    ),
                    "Course Community"
                );

            } else {

                hideElement(
                    courseBanner
                );

            }

        }

    }


    /* =====================================================
       RENDER ACTIVE CHANNEL
       ===================================================== */

    function renderActiveChannel() {

        const channel =
            state.currentChannel;

        if (!channel) {
            return;
        }


        setText(
            byId("activeChannelName"),
            channel.name
        );


        setText(
            byId(
                "activeChannelDescription"
            ),
            channel.description ||
                "Community discussion"
        );


        setText(
            byId("activeRoleBadge"),
            state.currentRole ||
                "student"
        );

    }


    /* =====================================================
       LOAD MESSAGES
       ===================================================== */

    async function loadMessages() {

        const list =
            byId("messageList");

        if (
            !state.currentChannel?.id
        ) {
            renderMessagesEmpty();
            return;
        }


        state.loadingMessages =
            true;


        if (list) {

            list.innerHTML = `
                <div class="message-loading">
                    Loading messages...
                </div>
            `;

        }


        try {

            const {
                data,
                error
            } =
                await supabase
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
                    .limit(500);

            if (error) {
                throw error;
            }


            state.messages =
                data || [];


            const ids =
                state.messages
                    .map(
                        message =>
                            message.user_id
                    )
                    .filter(Boolean);


            await loadProfiles(
                ids
            );


            renderMessages();

        } catch (error) {

            console.error(
                "Failed to load messages:",
                error
            );

            displayLoadError(
                list,
                error.message ||
                    "Unable to load messages."
            );

        } finally {

            state.loadingMessages =
                false;

        }

    }


    /* =====================================================
       RENDER EMPTY MESSAGES
       ===================================================== */

    function renderMessagesEmpty() {

        const list =
            byId("messageList");

        if (!list) {
            return;
        }

        list.innerHTML = `
            <div class="message-empty">
                Select a channel to start chatting.
            </div>
        `;

    }


    /* =====================================================
       RENDER MESSAGES
       ===================================================== */

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

            list.innerHTML = `
                <div class="message-empty">
                    No messages yet.
                </div>
            `;

            return;

        }


        list.innerHTML =
            messages
                .map(message => {

                    const profile =
                        state.profileCache.get(
                            String(
                                message.user_id
                            )
                        ) || {};


                    const name =
                        getProfileName(
                            profile
                        );


                    const photo =
                        getProfilePhoto(
                            profile
                        );


                    const initials =
                        getInitials(
                            name
                        );


                    const own =
                        String(
                            message.user_id
                        ) ===
                        String(
                            state.user?.id
                        );


                    const date =
                        message.created_at
                            ? new Date(
                                message.created_at
                            )
                                .toLocaleString()
                            : "";


                    return `

                        <article
                            class="message-item ${
                                own
                                    ? "own-message"
                                    : ""
                            }"
                            data-message-id="${escapeHTML(
                                message.id
                            )}"
                        >

                            <div
                                class="message-avatar"
                            >

                                ${
                                    photo
                                        ? `
                                            <img
                                                src="${escapeHTML(photo)}"
                                                alt="${escapeHTML(name)}"
                                                loading="lazy"
                                                onerror="
                                                    this.style.display='none';
                                                    this.nextElementSibling.style.display='flex';
                                                "
                                            >

                                            <span
                                                style="
                                                    display:none;
                                                    width:100%;
                                                    height:100%;
                                                    align-items:center;
                                                    justify-content:center;
                                                "
                                            >
                                                ${escapeHTML(
                                                    initials
                                                )}
                                            </span>
                                          `
                                        : `
                                            <span>
                                                ${escapeHTML(
                                                    initials
                                                )}
                                            </span>
                                          `
                                }

                            </div>


                            <div
                                class="message-content"
                            >

                                <div
                                    class="message-header"
                                >

                                    <strong
                                        class="message-author"
                                    >
                                        ${escapeHTML(
                                            name
                                        )}
                                    </strong>

                                    <time>
                                        ${escapeHTML(
                                            date
                                        )}
                                    </time>

                                </div>


                                <div
                                    class="message-text"
                                >
                                    ${escapeHTML(
                                        message.content ||
                                        ""
                                    )}
                                </div>

                            </div>

                        </article>

                    `;

                })
                .join("");

    }


    /* =====================================================
       SEND MESSAGE
       ===================================================== */

    async function sendMessage(
        event
    ) {

        if (event) {
            event.preventDefault();
        }


        if (
            state.sendingMessage ||
            !state.user?.id ||
            !state.currentChannel?.id
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


        state.sendingMessage =
            true;


        try {

            let payload = {

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    content

            };


            /*
             * Try reply support if the database
             * contains reply_to_id.
             */

            if (
                state.currentReply?.id
            ) {

                payload.reply_to_id =
                    state.currentReply.id;

            }


            let result =
                await supabase
                    .from("chat_messages")
                    .insert(payload)
                    .select("*")
                    .maybeSingle();


            /*
             * If reply_to_id does not exist,
             * retry without it.
             */

            if (
                result.error &&
                payload.reply_to_id
            ) {

                delete payload.reply_to_id;

                result =
                    await supabase
                        .from("chat_messages")
                        .insert(payload)
                        .select("*")
                        .maybeSingle();

            }


            if (result.error) {
                throw result.error;
            }


            input.value = "";

            cancelReply();


        } catch (error) {

            console.error(
                "Failed to send message:",
                error
            );

            showToast(
                error.message ||
                    "Message could not be sent."
            );

        } finally {

            state.sendingMessage =
                false;

        }

    }


    /* =====================================================
       REPLY
       ===================================================== */

    function cancelReply() {

        state.currentReply =
            null;

        hideElement(
            byId("replyPreview")
        );

        setText(
            byId("replyPreviewText"),
            ""
        );

    }


    /* =====================================================
       PRESENCE
       ===================================================== */

    async function setOnlinePresence() {

        if (!state.user?.id) {
            return;
        }


        const now =
            new Date()
                .toISOString();


        const {
            error
        } =
            await supabase
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

            console.error(
                "❌ Presence update failed:",
                error
            );

            return;

        }


        console.log(
            "🟢 Presence online"
        );

    }


    async function setOfflinePresence() {

        if (!state.user?.id) {
            return;
        }


        await supabase
            .from("chat_presence")
            .update(
                {

                    status:
                        "offline",

                    last_seen_at:
                        new Date()
                            .toISOString(),

                    updated_at:
                        new Date()
                            .toISOString()

                }
            )
            .eq(
                "user_id",
                state.user.id
            );

    }


    function startPresenceHeartbeat() {

        clearInterval(
            state.presenceTimer
        );


        state.presenceTimer =
            setInterval(
                () => {

                    setOnlinePresence();

                },
                60000
            );

    }


    /* =====================================================
       REALTIME COMMUNITY
       ===================================================== */

    function removeRealtimeChannels() {

        state.realtimeChannels
            .forEach(
                channel => {

                    try {

                        supabase.removeChannel(
                            channel
                        );

                    } catch (_) {}

                }
            );


        state.realtimeChannels =
            [];

    }


    function subscribeToCommunity() {

        if (
            !state.currentCommunity?.id
        ) {
            return;
        }


        removeRealtimeChannels();


        const channel =
            supabase
                .channel(
                    `mwaniki-community-${
                        state.currentCommunity.id
                    }`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_community_members",
                        filter:
                            `community_id=eq.${
                                state.currentCommunity.id
                            }`
                    },
                    async () => {

                        await loadCommunityMembers();

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_channels",
                        filter:
                            `community_id=eq.${
                                state.currentCommunity.id
                            }`
                    },
                    async () => {

                        await loadChannels();

                    }
                )
                .subscribe();


        state.realtimeChannels.push(
            channel
        );

    }


    /* =====================================================
       MESSAGE REALTIME
       ===================================================== */

    function subscribeToMessages() {

        if (
            !state.currentChannel?.id
        ) {
            return;
        }


        if (
            state.messageSubscription
        ) {

            try {

                supabase.removeChannel(
                    state.messageSubscription
                );

            } catch (_) {}

        }


        const channel =
            supabase
                .channel(
                    `mwaniki-messages-${
                        state.currentChannel.id
                    }`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_messages",
                        filter:
                            `channel_id=eq.${
                                state.currentChannel.id
                            }`
                    },
                    async payload => {

                        const message =
                            payload.new;


                        await loadProfiles(
                            [
                                message.user_id
                            ]
                        );


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

                        }

                    }
                )
                .subscribe();


        state.messageSubscription =
            channel;

    }


    /* =====================================================
       COMMUNITY UI EVENTS
       ===================================================== */

    function setupCommunityEvents() {

        const messageForm =
            byId("messageForm");

        if (messageForm) {

            messageForm.addEventListener(
                "submit",
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


        const closeSearch =
            byId(
                "closeMessageSearchButton"
            );

        if (closeSearch) {

            closeSearch.addEventListener(
                "click",
                () => {

                    hideElement(
                        byId(
                            "messageSearchPanel"
                        )
                    );

                    state.messageSearch =
                        "";

                    if (messageSearch) {
                        messageSearch.value =
                            "";
                    }

                    renderMessages();

                }
            );

        }


        const chatSearchButton =
            byId(
                "chatSearchButton"
            );

        if (chatSearchButton) {

            chatSearchButton.addEventListener(
                "click",
                () => {

                    showElement(
                        byId(
                            "messageSearchPanel"
                        )
                    );

                    byId(
                        "messageSearchInput"
                    )?.focus();

                }
            );

        }


        const memberButton =
            byId(
                "memberToggleButton"
            );

        if (memberButton) {

            memberButton.addEventListener(
                "click",
                openMemberDrawer
            );

        }


        const closeMemberButton =
            byId(
                "closeMemberSidebarButton"
            );

        if (closeMemberButton) {

            closeMemberButton.addEventListener(
                "click",
                closeMemberDrawer
            );

        }


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


        const closeCommunity =
            byId(
                "closeCommunityModalButton"
            );

        if (closeCommunity) {

            closeCommunity.addEventListener(
                "click",
                closeCommunityModal
            );

        }


        const cancelCommunity =
            byId(
                "cancelCommunityButton"
            );

        if (cancelCommunity) {

            cancelCommunity.addEventListener(
                "click",
                closeCommunityModal
            );

        }


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


        const closeChannel =
            byId(
                "closeChannelModalButton"
            );

        if (closeChannel) {

            closeChannel.addEventListener(
                "click",
                closeChannelModal
            );

        }


        const cancelChannel =
            byId(
                "cancelChannelButton"
            );

        if (cancelChannel) {

            cancelChannel.addEventListener(
                "click",
                closeChannelModal
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

    }


    /* =====================================================
       MEMBER DRAWER
       ===================================================== */

    function openMemberDrawer() {

        showElement(
            byId("memberSidebar")
        );

    }


    function closeMemberDrawer() {

        hideElement(
            byId("memberSidebar")
        );

    }


    /* =====================================================
       COMMUNITY MODAL
       ===================================================== */

    function openCommunityModal() {

        showElement(
            byId("communityModal")
        );

    }


    function closeCommunityModal() {

        hideElement(
            byId("communityModal")
        );

        const form =
            byId("communityForm");

        if (form) {
            form.reset();
        }

    }


    /* =====================================================
       CREATE COMMUNITY
       ===================================================== */

    async function createCommunity(
        event
    ) {

        event.preventDefault();


        if (!state.user?.id) {
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


        const iconUrl =
            byId(
                "communityIconInput"
            )?.value.trim();


        const message =
            byId(
                "communityFormMessage"
            );


        if (!name) {

            setText(
                message,
                "Community name is required."
            );

            return;

        }


        const slug =
            slugify(name) ||
            `community-${Date.now()}`;


        try {

            const {
                error
            } =
                await supabase
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
                            iconUrl ||
                            null,

                        is_public:
                            true,

                        is_active:
                            true,

                        created_by:
                            state.user.id

                    });


            if (error) {
                throw error;
            }


            closeCommunityModal();

            showToast(
                "Community created."
            );


            await loadCommunities();

            const created =
                state.communities.find(
                    community =>
                        community.slug ===
                        slug
                );


            if (created) {

                await selectCommunity(
                    created.id
                );

            }

        } catch (error) {

            console.error(
                "Community creation failed:",
                error
            );

            setText(
                message,
                error.message ||
                    "Could not create community."
            );

        }

    }


    /* =====================================================
       CHANNEL MODAL
       ===================================================== */

    function openChannelModal() {

        if (!state.currentCommunity) {

            showToast(
                "Select a community first."
            );

            return;
        }


        populateCourseSelect(
            byId(
                "channelCourseSelect"
            )
        );


        showElement(
            byId("channelModal")
        );

    }


    function closeChannelModal() {

        hideElement(
            byId("channelModal")
        );

        const form =
            byId("channelForm");

        if (form) {
            form.reset();
        }

    }


    /* =====================================================
       COURSE SELECT
       ===================================================== */

    function populateCourseSelect(
        select
    ) {

        if (!select) {
            return;
        }


        select.innerHTML = `
            <option value="">
                No course
            </option>
        `;


        state.courses.forEach(
            course => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    course.id;

                option.textContent =
                    course.title;

                select.appendChild(
                    option
                );

            }
        );

    }


    /* =====================================================
       CREATE CHANNEL
       ===================================================== */

    async function createChannel(
        event
    ) {

        event.preventDefault();


        if (
            !state.user?.id ||
            !state.currentCommunity?.id
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
            )?.value || null;


        const message =
            byId(
                "channelFormMessage"
            );


        if (!name) {

            setText(
                message,
                "Channel name is required."
            );

            return;

        }


        const payload = {

            community_id:
                state.currentCommunity.id,

            name,

            slug:
                slugify(name) ||
                `channel-${Date.now()}`,

            description:
                description ||
                null,

            channel_type:
                "text",

            icon:
                "#",

            position:
                state.channels.length,

            is_private:
                visibility === "private",

            is_archived:
                false,

            is_active:
                true,

            course_id:
                courseId,

            created_by:
                state.user.id

        };


        try {

            let result =
                await supabase
                    .from(
                        "chat_channels"
                    )
                    .insert(payload);


            /*
             * If the database has a category column,
             * try again with category only if the first
             * attempt fails because of schema mismatch.
             */

            if (
                result.error &&
                category
            ) {

                const categoryPayload = {

                    ...payload,

                    category

                };


                result =
                    await supabase
                        .from(
                            "chat_channels"
                        )
                        .insert(
                            categoryPayload
                        );

            }


            if (result.error) {
                throw result.error;
            }


            closeChannelModal();

            showToast(
                "Channel created."
            );


            await loadChannels();

        } catch (error) {

            console.error(
                "Channel creation failed:",
                error
            );

            setText(
                message,
                error.message ||
                    "Could not create channel."
            );

        }

    }


    /* =====================================================
       ONLINE CALL USER HELPERS
       ===================================================== */

    async function loadOnlineCallUsers(
        options = {}
    ) {

        const {

            scope =
                "general",

            communityId =
                null,

            excludeCurrentUser =
                true

        } = options;


        console.log(
            "📞 Loading online call users..."
        );


        const statusElement =
            byId(
                "generalCallUserStatus"
            );


        const listElement =
            byId(
                "generalCallUserList"
            );


        if (!listElement) {

            console.error(
                "❌ #generalCallUserList does not exist."
            );

            return [];

        }


        if (!state.user?.id) {

            listElement.innerHTML = `
                <div class="call-user-empty">
                    Please sign in first.
                </div>
            `;

            return [];

        }


        setText(
            statusElement,
            "Loading online users..."
        );


        listElement.innerHTML = `
            <div class="call-user-loading">
                Loading online users...
            </div>
        `;


        /* =================================================
           STEP 1:
           CHAT PRESENCE

           IMPORTANT:
           chat_presence contains NO community_id.
           ================================================= */

        const {
            data: presenceRows,
            error: presenceError
        } =
            await supabase
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at,updated_at"
                )
                .eq(
                    "status",
                    "online"
                );


        if (presenceError) {

            console.error(
                "❌ chat_presence query failed:",
                presenceError
            );


            setText(
                statusElement,
                "Could not load online users."
            );


            listElement.innerHTML = `
                <div class="call-user-empty">

                    <strong>
                        Could not load online users
                    </strong>

                    <small>
                        ${escapeHTML(
                            presenceError.message ||
                            "Presence query failed."
                        )}
                    </small>

                </div>
            `;


            return [];

        }


        console.log(
            "📡 Online presence rows:",
            presenceRows
        );


        let onlineUserIds =
            [
                ...new Set(
                    (presenceRows || [])
                        .map(
                            row =>
                                row.user_id
                        )
                        .filter(Boolean)
                        .map(String)
                )
            ];


        /* =================================================
           REMOVE CURRENT USER
           ================================================= */

        if (
            excludeCurrentUser
        ) {

            onlineUserIds =
                onlineUserIds.filter(
                    id =>
                        id !==
                        String(
                            state.user.id
                        )
                );

        }


        /* =================================================
           COMMUNITY FILTER

           Only applied to community calls.
           General calls see all online users.
           ================================================= */

        if (
            scope === "community" &&
            communityId &&
            onlineUserIds.length
        ) {

            const {
                data:
                    communityMembers,
                error:
                    memberError
            } =
                await supabase
                    .from(
                        "chat_community_members"
                    )
                    .select(
                        "user_id"
                    )
                    .eq(
                        "community_id",
                        communityId
                    )
                    .in(
                        "user_id",
                        onlineUserIds
                    );


            if (memberError) {

                console.error(
                    "Community member filter failed:",
                    memberError
                );

            } else {

                onlineUserIds =
                    [
                        ...new Set(
                            (
                                communityMembers ||
                                []
                            )
                                .map(
                                    member =>
                                        member.user_id
                                )
                                .filter(Boolean)
                                .map(String)
                        )
                    ];

            }

        }


        /* =================================================
           NO USERS
           ================================================= */

        if (!onlineUserIds.length) {

            callPickerState.users =
                [];


            setText(
                statusElement,
                "No other users are currently online."
            );


            listElement.innerHTML = `

                <div class="call-user-empty">

                    <div
                        style="
                            font-size:28px;
                            margin-bottom:8px;
                        "
                    >
                        👥
                    </div>

                    <strong>
                        No other users online
                    </strong>

                    <p>
                        Users who are online
                        will appear here.
                    </p>

                </div>

            `;


            updateCallSelectionUI();

            return [];

        }


        /* =================================================
           STEP 2:
           REAL STUDENT PROFILES
           ================================================= */

        const {
            data: students,
            error: studentsError
        } =
            await supabase
                .from("students")
                .select("*")
                .in(
                    "id",
                    onlineUserIds
                );


        if (studentsError) {

            console.error(
                "❌ students lookup failed:",
                studentsError
            );


            /*
             * IMPORTANT:
             * We DO NOT turn this into [].
             * The users are still online.
             */

            callPickerState.users =
                onlineUserIds.map(
                    userId => ({

                        id:
                            userId,

                        full_name:
                            "Online user",

                        photo_url:
                            "",

                        online:
                            true

                    })
                );

        } else {

            const profileMap =
                new Map(
                    (
                        students ||
                        []
                    ).map(
                        student => [
                            String(
                                student.id
                            ),
                            student
                        ]
                    )
                );


            callPickerState.users =
                onlineUserIds.map(
                    userId => {

                        const profile =
                            profileMap.get(
                                String(
                                    userId
                                )
                            );


                        return {

                            ...(profile || {}),

                            id:
                                userId,

                            online:
                                true

                        };

                    }
                );

        }


        callPickerState.users.sort(
            (a, b) =>
                getProfileName(a)
                    .localeCompare(
                        getProfileName(b)
                    )
        );


        console.log(
            "✅ Call users loaded:",
            callPickerState.users
        );


        renderOnlineCallUsers();


        setText(
            statusElement,
            `${
                callPickerState.users.length
            } online user${
                callPickerState.users.length ===
                1
                    ? ""
                    : "s"
            } available`
        );


        return callPickerState.users;

    }


    /* =====================================================
       RENDER ONLINE CALL USERS
       ===================================================== */

    function renderOnlineCallUsers() {

        const listElement =
            byId(
                "generalCallUserList"
            );


        if (!listElement) {
            return;
        }


        if (
            !callPickerState.users.length
        ) {

            listElement.innerHTML = `
                <div class="call-user-empty">
                    No online users available.
                </div>
            `;

            updateCallSelectionUI();

            return;

        }


        listElement.innerHTML =
            callPickerState.users
                .map(
                    user => {

                        const id =
                            String(
                                user.id
                            );


                        const name =
                            getProfileName(
                                user
                            );


                        const photo =
                            getProfilePhoto(
                                user
                            );


                        const initials =
                            getInitials(
                                name
                            );


                        const selected =
                            callPickerState
                                .selectedUserIds
                                .has(id);


                        return `

                            <label
                                class="
                                    general-call-user
                                    ${
                                        selected
                                            ? "selected"
                                            : ""
                                    }
                                "
                                data-user-id="${escapeHTML(
                                    id
                                )}"
                            >

                                <input
                                    type="checkbox"
                                    class="
                                        general-call-user-checkbox
                                    "
                                    data-user-id="${escapeHTML(
                                        id
                                    )}"
                                    ${
                                        selected
                                            ? "checked"
                                            : ""
                                    }
                                >


                                <div
                                    class="
                                        general-call-user-avatar
                                    "
                                >

                                    ${
                                        photo
                                            ? `

                                                <img
                                                    src="${escapeHTML(
                                                        photo
                                                    )}"
                                                    alt="${escapeHTML(
                                                        name
                                                    )}"
                                                    loading="lazy"
                                                    onerror="
                                                        this.style.display='none';
                                                        this.nextElementSibling.style.display='flex';
                                                    "
                                                >

                                                <span
                                                    class="
                                                        general-call-user-initials
                                                    "
                                                    style="
                                                        display:none;
                                                    "
                                                >
                                                    ${escapeHTML(
                                                        initials
                                                    )}
                                                </span>

                                              `
                                            : `

                                                <span
                                                    class="
                                                        general-call-user-initials
                                                    "
                                                >
                                                    ${escapeHTML(
                                                        initials
                                                    )}
                                                </span>

                                              `
                                    }

                                </div>


                                <div
                                    class="
                                        general-call-user-info
                                    "
                                >

                                    <strong>
                                        ${escapeHTML(
                                            name
                                        )}
                                    </strong>

                                    <span>
                                        ● Online
                                    </span>

                                </div>

                            </label>

                        `;

                    }
                )
                .join("");


        listElement
            .querySelectorAll(
                ".general-call-user-checkbox"
            )
            .forEach(
                checkbox => {

                    checkbox.addEventListener(
                        "change",
                        event => {

                            const id =
                                String(
                                    event.target
                                        .dataset
                                        .userId
                                );


                            if (
                                event.target
                                    .checked
                            ) {

                                callPickerState
                                    .selectedUserIds
                                    .add(id);

                            } else {

                                callPickerState
                                    .selectedUserIds
                                    .delete(id);

                            }


                            renderOnlineCallUsers();

                        }
                    );

                }
            );


        updateCallSelectionUI();

    }


    /* =====================================================
       CALL SELECTION UI
       ===================================================== */

    function updateCallSelectionUI() {

        const count =
            callPickerState
                .selectedUserIds
                .size;


        const selection =
            byId(
                "generalCallSelectionCount"
            );


        const start =
            byId(
                "startGeneralCallButton"
            );


        if (selection) {

            selection.textContent =
                count
                    ? `${count} user${
                        count === 1
                            ? ""
                            : "s"
                    } selected`
                    : "Select one or more users.";

        }


        if (start) {

            start.disabled =
                count === 0;

        }

    }


    /* =====================================================
       OPEN GENERAL CALL PICKER
       ===================================================== */

    async function openGeneralCallPicker(
        callType = "video"
    ) {

        callPickerState.callType =
            callType;

        callPickerState.scope =
            "general";

        callPickerState.communityId =
            null;

        callPickerState.directUserId =
            null;

        callPickerState.selectedUserIds =
            new Set();


        const modal =
            byId(
                "generalCallModal"
            );


        if (!modal) {

            console.error(
                "General call modal missing."
            );

            return;

        }


        setText(
            byId("generalCallTitle"),
            callType === "voice"
                ? "Start Voice Call"
                : "Start Video Call"
        );


        modal.classList.remove(
            "hidden"
        );

        modal.style.display =
            "flex";


        await loadOnlineCallUsers({

            scope:
                "general",

            communityId:
                null,

            excludeCurrentUser:
                true

        });

    }


    /* =====================================================
       OPEN COMMUNITY CALL PICKER
       ===================================================== */

    async function openCommunityCallPicker(
        callType = "video"
    ) {

        if (
            !state.currentCommunity
        ) {

            showToast(
                "Select a community first."
            );

            return;

        }


        callPickerState.callType =
            callType;

        callPickerState.scope =
            "community";

        callPickerState.communityId =
            state.currentCommunity.id;

        callPickerState.directUserId =
            null;

        callPickerState.selectedUserIds =
            new Set();


        const modal =
            byId(
                "generalCallModal"
            );


        if (!modal) {
            return;
        }


        setText(
            byId("generalCallTitle"),
            callType === "voice"
                ? `Call ${state.currentCommunity.name}`
                : `Video Call ${state.currentCommunity.name}`
        );


        modal.classList.remove(
            "hidden"
        );

        modal.style.display =
            "flex";


        await loadOnlineCallUsers({

            scope:
                "community",

            communityId:
                state.currentCommunity.id,

            excludeCurrentUser:
                true

        });

    }


    /* =====================================================
       CLOSE CALL PICKER
       ===================================================== */

    function closeGeneralCallPicker() {

        const modal =
            byId(
                "generalCallModal"
            );


        if (!modal) {
            return;
        }


        modal.classList.add(
            "hidden"
        );

        modal.style.display =
            "none";


        callPickerState.selectedUserIds =
            new Set();

    }


    /* =====================================================
       CALL ROOM CODE
       ===================================================== */

    function createRoomCode() {

        const suffix =
            crypto.randomUUID
                ? crypto
                    .randomUUID()
                    .replace(
                        /-/g,
                        ""
                    )
                    .substring(
                        0,
                        10
                    )
                    .toUpperCase()
                :
                    Math.random()
                        .toString(
                            36
                        )
                        .substring(
                            2,
                            12
                        )
                        .toUpperCase();


        return `MS-${suffix}`;

    }


    /* =====================================================
       CREATE CALL ROOM
       ===================================================== */

    async function createCallRoom({
        callType,
        scope,
        communityId,
        participantIds
    }) {

        const roomPayload = {

            community_id:
                communityId || null,

            room_code:
                createRoomCode(),

            call_scope:
                scope,

            call_type:
                callType,

            status:
                "waiting",

            created_by:
                state.user.id

        };


        console.log(
            "📞 Creating room:",
            roomPayload
        );


        const {
            data: room,
            error: roomError
        } =
            await supabase
                .from(
                    "chat_call_rooms"
                )
                .insert(
                    roomPayload
                )
                .select("*")
                .single();


        if (roomError) {

            console.error(
                "❌ chat_call_rooms insert failed:",
                roomError
            );

            throw roomError;

        }


        const allParticipants =
            [
                state.user.id,

                ...(participantIds || [])
            ];


        const uniqueParticipants =
            [
                ...new Set(
                    allParticipants
                        .filter(Boolean)
                        .map(String)
                )
            ];


        const participantRows =
            uniqueParticipants.map(
                userId => ({

                    room_id:
                        room.id,

                    user_id:
                        userId,

                    status:
                        String(userId) ===
                        String(
                            state.user.id
                        )
                            ? "joined"
                            : "invited",

                    is_muted:
                        false,

                    is_camera_on:
                        callType ===
                        "video",

                    is_screen_sharing:
                        false

                })
            );


        const {
            error:
                participantError
        } =
            await supabase
                .from(
                    "chat_call_participants"
                )
                .insert(
                    participantRows
                );


        if (participantError) {

            /*
             * Remove room if participant creation fails.
             */

            await supabase
                .from(
                    "chat_call_rooms"
                )
                .delete()
                .eq(
                    "id",
                    room.id
                );


            console.error(
                "❌ Participant insert failed:",
                participantError
            );

            throw participantError;

        }


        return room;

    }


    /* =====================================================
       START CALL
       ===================================================== */

    async function startCall({
        callType = "video",
        scope = "general",
        communityId = null,
        participantIds = []
    }) {

        if (
            callState.active
        ) {

            showToast(
                "You are already in a call."
            );

            return;

        }


        if (!state.user?.id) {

            showToast(
                "You must be signed in."
            );

            return;

        }


        try {

            const room =
                await createCallRoom({

                    callType,

                    scope,

                    communityId,

                    participantIds

                });


            callState.active =
                true;

            callState.room =
                room;

            callState.callType =
                callType;

            callState.scope =
                scope;

            callState.startedAt =
                Date.now();

            callState.microphoneEnabled =
                true;

            callState.cameraEnabled =
                callType === "video";

            callState.screenSharing =
                false;


            await openLocalMedia(
                callType
            );


            renderCallOverlay();

            showCallOverlay();

            startCallTimer();

            await subscribeToCallRoom();

            await syncCallParticipants();

            startCallParticipantSync();


            /*
             * Process any signals that arrived
             * before the realtime subscription.
             */

            await loadPendingSignals();


            showToast(
                "Call started."
            );


        } catch (error) {

            console.error(
                "❌ Could not start call:",
                error
            );

            showToast(
                error.message ||
                    "Could not start call."
            );


            await cleanupCall(
                false
            );

        }

    }


    /* =====================================================
       LOCAL MEDIA
       ===================================================== */

    async function openLocalMedia(
        callType
    ) {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support camera/microphone access."
            );

        }


        callState.localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio:
                        true,

                    video:
                        callType ===
                        "video"

                });


        const localVideo =
            byId(
                "localVideo"
            );


        if (localVideo) {

            localVideo.srcObject =
                callState.localStream;

            localVideo.muted =
                true;

            localVideo.autoplay =
                true;

            localVideo.playsInline =
                true;


            if (
                callType ===
                "video"
            ) {

                localVideo.style.display =
                    "block";

            } else {

                localVideo.style.display =
                    "none";

            }

        }

    }


    /* =====================================================
       CALL OVERLAY
       ===================================================== */

    function showCallOverlay() {

        const overlay =
            byId(
                "callOverlay"
            );


        if (!overlay) {
            return;
        }


        overlay.classList.remove(
            "hidden"
        );

        overlay.style.display =
            "flex";

    }


    function hideCallOverlay() {

        const overlay =
            byId(
                "callOverlay"
            );


        if (!overlay) {
            return;
        }


        overlay.classList.add(
            "hidden"
        );

        overlay.style.display =
            "none";

    }


    /* =====================================================
       RENDER CALL OVERLAY
       ===================================================== */

    function renderCallOverlay() {

        setText(
            byId("callTypeIcon"),
            callState.callType ===
                "voice"
                ? "📞"
                : "🎥"
        );


        setText(
            byId("callTitle"),
            callState.scope ===
                "community"
                ? (
                    state.currentCommunity
                        ?.name ||
                    "Community Call"
                )
                : callState.scope ===
                    "direct"
                    ? "Direct Call"
                    : "General Call"
        );


        setText(
            byId("callSubtitle"),
            callState.callType ===
                "voice"
                ? "Voice call"
                : "Video call"
        );

    }


    /* =====================================================
       CALL TIMER
       ===================================================== */

    function startCallTimer() {

        clearInterval(
            callState.timerInterval
        );


        callState.timerInterval =
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
                        byId(
                            "callDuration"
                        ),
                        `${String(
                            minutes
                        ).padStart(
                            2,
                            "0"
                        )}:${String(
                            remaining
                        ).padStart(
                            2,
                            "0"
                        )}`
                    );

                },
                1000
            );

    }


    /* =====================================================
       CALL REALTIME
       ===================================================== */

    async function subscribeToCallRoom() {

        if (
            !callState.room?.id
        ) {
            return;
        }


        if (
            callState.realtimeChannel
        ) {

            try {

                await supabase.removeChannel(
                    callState.realtimeChannel
                );

            } catch (_) {}

        }


        const roomId =
            callState.room.id;


        const channel =
            supabase
                .channel(
                    `mwaniki-call-room-${roomId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_call_participants",
                        filter:
                            `room_id=eq.${roomId}`
                    },
                    async payload => {

                        await syncCallParticipants();


                        if (
                            payload.eventType ===
                            "UPDATE"
                        ) {

                            const participant =
                                payload.new;


                            if (
                                participant
                                    .user_id ===
                                state.user.id
                            ) {
                                return;
                            }


                            if (
                                participant.status ===
                                "joined"
                            ) {

                                await ensurePeerConnection(
                                    participant.user_id
                                );

                            }

                        }

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_call_signals",
                        filter:
                            `receiver_id=eq.${state.user.id}`
                    },
                    async payload => {

                        const signal =
                            payload.new;


                        if (
                            String(
                                signal.room_id
                            ) !==
                            String(
                                roomId
                            )
                        ) {
                            return;
                        }


                        await processCallSignal(
                            signal
                        );

                    }
                )
                .subscribe();


        callState.realtimeChannel =
            channel;

    }


    /* =====================================================
       CALL PARTICIPANT SYNC
       ===================================================== */

    function startCallParticipantSync() {

        clearInterval(
            callState.syncInterval
        );


        callState.syncInterval =
            setInterval(
                async () => {

                    if (
                        !callState.active
                    ) {
                        return;
                    }


                    try {

                        await syncCallParticipants();

                    } catch (error) {

                        console.warn(
                            "Call participant sync failed:",
                            error
                        );

                    }

                },
                3000
            );

    }


    async function syncCallParticipants() {

        if (
            !callState.room?.id
        ) {
            return;
        }


        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_call_participants"
                )
                .select("*")
                .eq(
                    "room_id",
                    callState.room.id
                );


        if (error) {

            console.warn(
                "Could not sync participants:",
                error
            );

            return;

        }


        const ids =
            (data || [])
                .map(
                    participant =>
                        participant.user_id
                )
                .filter(Boolean);


        await loadProfiles(
            ids
        );


        callState.participantProfiles =
            new Map();


        (data || []).forEach(
            participant => {

                const profile =
                    state.profileCache.get(
                        String(
                            participant.user_id
                        )
                    ) || {};


                callState.participantProfiles.set(
                    String(
                        participant.user_id
                    ),
                    {

                        participant,

                        profile

                    }
                );

            }
        );


        renderCallParticipants(
            data || []
        );


        /*
         * Only users marked joined should receive
         * WebRTC connections.
         */

        for (
            const participant of
            data || []
        ) {

            if (
                String(
                    participant.user_id
                ) ===
                String(
                    state.user.id
                )
            ) {
                continue;
            }


            if (
                participant.status !==
                "joined"
            ) {
                continue;
            }


            await ensurePeerConnection(
                participant.user_id
            );

        }

    }


    /* =====================================================
       RENDER CALL PARTICIPANTS
       ===================================================== */

    function renderCallParticipants(
        participants
    ) {

        const container =
            byId(
                "callParticipants"
            );


        if (!container) {
            return;
        }


        container.innerHTML =
            participants
                .map(
                    participant => {

                        const profile =
                            state.profileCache.get(
                                String(
                                    participant.user_id
                                )
                            ) || {};


                        const name =
                            getProfileName(
                                profile
                            );


                        return `

                            <div
                                class="
                                    call-participant-label
                                "
                            >
                                ${escapeHTML(
                                    name
                                )}

                                ${
                                    participant.status ===
                                    "joined"
                                        ? " 🟢"
                                        : " ⏳"
                                }

                            </div>

                        `;

                    }
                )
                .join("");

    }


    /* =====================================================
       WEBRTC CONFIGURATION
       ===================================================== */

    function createPeerConnection(
        remoteUserId
    ) {

        const pc =
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

                        pc.addTrack(
                            track,
                            callState.localStream
                        );

                    }
                );

        }


        pc.onicecandidate =
            async event => {

                if (
                    !event.candidate
                ) {
                    return;
                }


                await sendCallSignal({

                    receiver_id:
                        remoteUserId,

                    signal_type:
                        "ice-candidate",

                    payload:
                        event.candidate

                });

            };


        pc.ontrack =
            event => {

                const stream =
                    event.streams?.[0];

                if (!stream) {
                    return;
                }


                renderRemoteStream(
                    remoteUserId,
                    stream
                );

            };


        pc.onconnectionstatechange =
            () => {

                console.log(
                    "Peer state:",
                    remoteUserId,
                    pc.connectionState
                );


                if (
                    [
                        "failed",
                        "closed",
                        "disconnected"
                    ].includes(
                        pc.connectionState
                    )
                ) {

                    if (
                        pc.connectionState ===
                        "failed"
                    ) {

                        try {

                            pc.restartIce();

                        } catch (_) {}

                    }

                }

            };


        return pc;

    }


    /* =====================================================
       ENSURE PEER CONNECTION
       ===================================================== */

    async function ensurePeerConnection(
        remoteUserId
    ) {

        if (
            !callState.active ||
            !remoteUserId ||
            String(
                remoteUserId
            ) ===
            String(
                state.user.id
            )
        ) {
            return;
        }


        const remoteId =
            String(
                remoteUserId
            );


        let entry =
            callState.peers.get(
                remoteId
            );


        if (!entry) {

            const pc =
                createPeerConnection(
                    remoteId
                );


            entry = {

                pc,

                offerStarted:
                    false

            };


            callState.peers.set(
                remoteId,
                entry
            );

        }


        /*
         * Deterministic initiator.
         *
         * Only the lexicographically smaller
         * user ID creates the offer.
         */

        const localId =
            String(
                state.user.id
            );


        const shouldInitiate =
            localId <
            remoteId;


        if (
            shouldInitiate &&
            !entry.offerStarted
        ) {

            entry.offerStarted =
                true;


            try {

                const offer =
                    await entry.pc
                        .createOffer();


                await entry.pc
                    .setLocalDescription(
                        offer
                    );


                await sendCallSignal({

                    receiver_id:
                        remoteId,

                    signal_type:
                        "offer",

                    payload:
                        offer

                });

            } catch (error) {

                entry.offerStarted =
                    false;


                console.error(
                    "Offer creation failed:",
                    error
                );

            }

        }

    }


    /* =====================================================
       SEND SIGNAL
       ===================================================== */

    async function sendCallSignal({

        receiver_id,

        signal_type,

        payload

    }) {

        if (
            !callState.room?.id ||
            !state.user?.id
        ) {
            return;
        }


        const {
            error
        } =
            await supabase
                .from(
                    "chat_call_signals"
                )
                .insert({

                    room_id:
                        callState.room.id,

                    sender_id:
                        state.user.id,

                    receiver_id:
                        receiver_id,

                    signal_type:
                        signal_type,

                    payload:
                        payload

                });


        if (error) {

            console.error(
                "❌ Call signal failed:",
                error
            );

        }

    }


    /* =====================================================
       PROCESS CALL SIGNAL
       ===================================================== */

    async function processCallSignal(
        signal
    ) {

        if (!signal) {
            return;
        }


        if (
            callState.processingSignalIds
                .has(
                    signal.id
                )
        ) {
            return;
        }


        callState.processingSignalIds
            .add(
                signal.id
            );


        const remoteId =
            String(
                signal.sender_id
            );


        if (
            remoteId ===
            String(
                state.user.id
            )
        ) {
            return;
        }


        await ensurePeerConnection(
            remoteId
        );


        const entry =
            callState.peers.get(
                remoteId
            );


        if (!entry) {
            return;
        }


        const pc =
            entry.pc;


        try {

            if (
                signal.signal_type ===
                "offer"
            ) {

                await pc
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            signal.payload
                        )
                    );


                const answer =
                    await pc
                        .createAnswer();


                await pc
                    .setLocalDescription(
                        answer
                    );


                await sendCallSignal({

                    receiver_id:
                        remoteId,

                    signal_type:
                        "answer",

                    payload:
                        answer

                });


                await flushPendingIce(
                    remoteId
                );

            }


            else if (
                signal.signal_type ===
                "answer"
            ) {

                await pc
                    .setRemoteDescription(
                        new RTCSessionDescription(
                            signal.payload
                        )
                    );


                await flushPendingIce(
                    remoteId
                );

            }


            else if (
                signal.signal_type ===
                "ice-candidate"
            ) {

                const candidate =
                    new RTCIceCandidate(
                        signal.payload
                    );


                if (
                    pc.remoteDescription
                ) {

                    await pc
                        .addIceCandidate(
                            candidate
                        );

                } else {

                    const queue =
                        callState.pendingIce
                            .get(
                                remoteId
                            ) ||
                        [];


                    queue.push(
                        candidate
                    );


                    callState.pendingIce
                        .set(
                            remoteId,
                            queue
                        );

                }

            }


            else if (
                signal.signal_type ===
                "leave"
            ) {

                closePeer(
                    remoteId
                );

            }

        } catch (error) {

            console.error(
                "Signal processing failed:",
                error
            );

        }

    }


    /* =====================================================
       PENDING SIGNALS
       ===================================================== */

    async function loadPendingSignals() {

        if (
            !callState.room?.id
        ) {
            return;
        }


        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_call_signals"
                )
                .select("*")
                .eq(
                    "room_id",
                    callState.room.id
                )
                .eq(
                    "receiver_id",
                    state.user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.warn(
                "Could not load pending call signals:",
                error
            );

            return;

        }


        for (
            const signal of
            data || []
        ) {

            await processCallSignal(
                signal
            );

        }

    }


    /* =====================================================
       FLUSH ICE
       ===================================================== */

    async function flushPendingIce(
        remoteId
    ) {

        const queue =
            callState.pendingIce
                .get(
                    String(remoteId)
                );


        if (!queue?.length) {
            return;
        }


        const entry =
            callState.peers.get(
                String(remoteId)
            );


        if (!entry) {
            return;
        }


        for (
            const candidate of
            queue
        ) {

            try {

                await entry.pc
                    .addIceCandidate(
                        candidate
                    );

            } catch (error) {

                console.warn(
                    "ICE candidate failed:",
                    error
                );

            }

        }


        callState.pendingIce
            .delete(
                String(remoteId)
            );

    }


    /* =====================================================
       RENDER REMOTE STREAM
       ===================================================== */

    function renderRemoteStream(
        remoteUserId,
        stream
    ) {

        const grid =
            byId(
                "callVideoGrid"
            );


        if (!grid) {
            return;
        }


        const id =
            `remote-video-${remoteUserId}`
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_"
                );


        let tile =
            byId(id);


        if (!tile) {

            tile =
                document.createElement(
                    "div"
                );

            tile.className =
                "call-video-tile";

            tile.id =
                id;


            const video =
                document.createElement(
                    "video"
                );

            video.autoplay =
                true;

            video.playsInline =
                true;

            video.dataset.userId =
                remoteUserId;


            const label =
                document.createElement(
                    "div"
                );

            label.className =
                "call-video-label";


            const profile =
                state.profileCache.get(
                    String(
                        remoteUserId
                    )
                );


            label.textContent =
                getProfileName(
                    profile
                );


            tile.appendChild(
                video
            );

            tile.appendChild(
                label
            );


            grid.appendChild(
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

            video.play()
                .catch(
                    () => {}
                );

        }

    }


    /* =====================================================
       CLOSE PEER
       ===================================================== */

    function closePeer(
        remoteUserId
    ) {

        const id =
            String(
                remoteUserId
            );


        const entry =
            callState.peers.get(
                id
            );


        if (entry) {

            try {

                entry.pc.close();

            } catch (_) {}

        }


        callState.peers.delete(
            id
        );


        callState.pendingIce
            .delete(id);


        const tile =
            byId(
                `remote-video-${id}`
                    .replace(
                        /[^a-zA-Z0-9_-]/g,
                        "_"
                    )
            );


        if (tile) {
            tile.remove();
        }

    }


    /* =====================================================
       TOGGLE MICROPHONE
       ===================================================== */

    function toggleMicrophone() {

        if (
            !callState.localStream
        ) {
            return;
        }


        const tracks =
            callState.localStream
                .getAudioTracks();


        if (!tracks.length) {
            return;
        }


        callState.microphoneEnabled =
            !callState.microphoneEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    callState
                        .microphoneEnabled;

            }
        );


        const button =
            byId(
                "toggleMicrophoneButton"
            );


        setText(
            button,
            callState.microphoneEnabled
                ? "🎙️"
                : "🔇"
        );

    }


    /* =====================================================
       TOGGLE CAMERA
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
            return;
        }


        callState.cameraEnabled =
            !callState.cameraEnabled;


        tracks.forEach(
            track => {

                track.enabled =
                    callState
                        .cameraEnabled;

            }
        );


        const button =
            byId(
                "toggleCameraButton"
            );


        setText(
            button,
            callState.cameraEnabled
                ? "📹"
                : "🚫"
        );

    }


    /* =====================================================
       SCREEN SHARING
       ===================================================== */

    async function toggleScreenShare() {

        if (
            !callState.active
        ) {
            return;
        }


        if (
            !navigator.mediaDevices
                ?.getDisplayMedia
        ) {

            showToast(
                "Screen sharing is not supported."
            );

            return;

        }


        try {

            if (
                !callState.screenSharing
            ) {

                callState.screenStream =
                    await navigator
                        .mediaDevices
                        .getDisplayMedia({

                            video: true

                        });


                const screenTrack =
                    callState
                        .screenStream
                        .getVideoTracks()[0];


                const senderUpdates =
                    [];


                callState.peers.forEach(
                    entry => {

                        const sender =
                            entry.pc
                                .getSenders()
                                .find(
                                    item =>
                                        item.track
                                            ?.kind ===
                                        "video"
                                );


                        if (sender) {

                            senderUpdates.push(
                                sender
                                    .replaceTrack(
                                        screenTrack
                                    )
                            );

                        }

                    }
                );


                await Promise.all(
                    senderUpdates
                );


                callState
                    .screenSharing =
                    true;


                screenTrack.onended =
                    () => {

                        stopScreenShare();

                    };


                showToast(
                    "Screen sharing started."
                );

            } else {

                await stopScreenShare();

            }

        } catch (error) {

            console.error(
                "Screen share failed:",
                error
            );

            showToast(
                error.message ||
                    "Screen sharing failed."
            );

        }

    }


    async function stopScreenShare() {

        if (
            !callState.screenStream
        ) {
            return;
        }


        const cameraTrack =
            callState.localStream
                ?.getVideoTracks()[0];


        if (cameraTrack) {

            const updates = [];


            callState.peers.forEach(
                entry => {

                    const sender =
                        entry.pc
                            .getSenders()
                            .find(
                                item =>
                                    item.track
                                        ?.kind ===
                                    "video"
                            );


                    if (sender) {

                        updates.push(
                            sender
                                .replaceTrack(
                                    cameraTrack
                                )
                        );

                    }

                }
            );


            await Promise.all(
                updates
            );

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

    }


    /* =====================================================
       LEAVE CALL
       ===================================================== */

    async function leaveCall() {

        await cleanupCall(
            true
        );

    }


    /* =====================================================
       CLEANUP CALL
       ===================================================== */

    async function cleanupCall(
        updateDatabase = true
    ) {

        if (
            updateDatabase &&
            callState.room?.id &&
            state.user?.id
        ) {

            try {

                await supabase
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
                        callState.room.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            } catch (error) {

                console.warn(
                    "Participant cleanup failed:",
                    error
                );

            }


            try {

                await sendCallSignalToAll(
                    "leave",
                    {}
                );

            } catch (_) {}

        }


        clearInterval(
            callState.timerInterval
        );

        clearInterval(
            callState.syncInterval
        );


        if (
            callState.realtimeChannel
        ) {

            try {

                await supabase.removeChannel(
                    callState.realtimeChannel
                );

            } catch (_) {}

        }


        callState.realtimeChannel =
            null;


        callState.peers.forEach(
            entry => {

                try {

                    entry.pc.close();

                } catch (_) {}

            }
        );


        callState.peers.clear();


        callState.pendingIce.clear();


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
            callState.localStream
        ) {

            callState.localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        callState.localStream =
            null;

        callState.screenStream =
            null;

        callState.room =
            null;

        callState.active =
            false;

        callState.startedAt =
            null;

        callState.screenSharing =
            false;

        callState.processingSignalIds
            .clear();


        const localVideo =
            byId(
                "localVideo"
            );


        if (localVideo) {

            localVideo.srcObject =
                null;

        }


        const grid =
            byId(
                "callVideoGrid"
            );


        if (grid) {

            grid.innerHTML = "";

        }


        hideCallOverlay();

    }


    /* =====================================================
       SEND LEAVE TO ALL PARTICIPANTS
       ===================================================== */

    async function sendCallSignalToAll(
        signalType,
        payload
    ) {

        if (
            !callState.room?.id
        ) {
            return;
        }


        const {
            data: participants,
            error
        } =
            await supabase
                .from(
                    "chat_call_participants"
                )
                .select(
                    "user_id"
                )
                .eq(
                    "room_id",
                    callState.room.id
                );


        if (error) {
            return;
        }


        for (
            const participant of
            participants || []
        ) {

            if (
                String(
                    participant.user_id
                ) ===
                String(
                    state.user.id
                )
            ) {
                continue;
            }


            await sendCallSignal({

                receiver_id:
                    participant.user_id,

                signal_type:
                    signalType,

                payload:
                    payload

            });

        }

    }


    /* =====================================================
       INCOMING CALL REALTIME
       ===================================================== */

    function setupIncomingCallListener() {

        if (
            !state.user?.id
        ) {
            return;
        }


        const channel =
            supabase
                .channel(
                    `mwaniki-incoming-calls-${
                        state.user.id
                    }`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table:
                            "chat_call_participants",
                        filter:
                            `user_id=eq.${state.user.id}`
                    },
                    async payload => {

                        const participant =
                            payload.new;


                        if (
                            participant.status !==
                            "invited"
                        ) {
                            return;
                        }


                        if (
                            callState.active
                        ) {
                            return;
                        }


                        await showIncomingCall(
                            participant.room_id
                        );

                    }
                )
                .subscribe();


        state.realtimeChannels.push(
            channel
        );

    }


    /* =====================================================
       SHOW INCOMING CALL
       ===================================================== */

    async function showIncomingCall(
        roomId
    ) {

        const {
            data: room,
            error
        } =
            await supabase
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
            return;
        }


        const {
            data: creator
        } =
            await supabase
                .from(
                    "students"
                )
                .select("*")
                .eq(
                    "id",
                    room.created_by
                )
                .maybeSingle();


        const callerName =
            getProfileName(
                creator
            );


        setText(
            byId(
                "incomingCallTitle"
            ),
            room.call_type ===
                "voice"
                ? "Incoming voice call"
                : "Incoming video call"
        );


        setText(
            byId(
                "incomingCallText"
            ),
            `${callerName} is calling you.`
        );


        const toast =
            byId(
                "incomingCallToast"
            );


        if (!toast) {
            return;
        }


        toast.dataset.roomId =
            room.id;


        toast.dataset.callType =
            room.call_type;


        toast.dataset.scope =
            room.call_scope;


        showElement(
            toast
        );

    }


    /* =====================================================
       ACCEPT INCOMING CALL
       ===================================================== */

    async function acceptIncomingCall() {

        const toast =
            byId(
                "incomingCallToast"
            );


        if (!toast) {
            return;
        }


        const roomId =
            toast.dataset.roomId;


        const callType =
            toast.dataset.callType ||
            "video";


        const scope =
            toast.dataset.scope ||
            "general";


        if (!roomId) {
            return;
        }


        hideElement(
            toast
        );


        try {

            const {
                data: room,
                error
            } =
                await supabase
                    .from(
                        "chat_call_rooms"
                    )
                    .select("*")
                    .eq(
                        "id",
                        roomId
                    )
                    .single();


            if (error) {
                throw error;
            }


            callState.active =
                true;

            callState.room =
                room;

            callState.callType =
                callType;

            callState.scope =
                scope;

            callState.startedAt =
                Date.now();


            await supabase
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
                        callType ===
                        "video"

                })
                .eq(
                    "room_id",
                    roomId
                )
                .eq(
                    "user_id",
                    state.user.id
                );


            await openLocalMedia(
                callType
            );


            renderCallOverlay();

            showCallOverlay();

            startCallTimer();

            await subscribeToCallRoom();

            await syncCallParticipants();

            startCallParticipantSync();

            await loadPendingSignals();


        } catch (error) {

            console.error(
                "Could not accept call:",
                error
            );

            showToast(
                error.message ||
                    "Could not join call."
            );

            await cleanupCall(
                false
            );

        }

    }


    /* =====================================================
       DECLINE INCOMING CALL
       ===================================================== */

    async function declineIncomingCall() {

        const toast =
            byId(
                "incomingCallToast"
            );


        if (!toast) {
            return;
        }


        const roomId =
            toast.dataset.roomId;


        hideElement(
            toast
        );


        if (
            roomId &&
            state.user?.id
        ) {

            await supabase
                .from(
                    "chat_call_participants"
                )
                .update({

                    status:
                        "declined",

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
                    state.user.id
                );

        }

    }


    /* =====================================================
       CALL BUTTON EVENTS
       ===================================================== */

    function setupCallEvents() {

        const generalCallButton =
            byId(
                "generalCallButton"
            );


        if (generalCallButton) {

            generalCallButton.addEventListener(
                "click",
                () =>
                    openGeneralCallPicker(
                        "video"
                    )
            );

        }


        const generalVoice =
            byId(
                "generalVoiceCallButton"
            );


        if (generalVoice) {

            generalVoice.addEventListener(
                "click",
                () =>
                    openGeneralCallPicker(
                        "voice"
                    )
            );

        }


        const generalVideo =
            byId(
                "generalVideoCallButton"
            );


        if (generalVideo) {

            generalVideo.addEventListener(
                "click",
                () =>
                    openGeneralCallPicker(
                        "video"
                    )
            );

        }


        const startGeneral =
            byId(
                "startGeneralCallButton"
            );


        if (startGeneral) {

            startGeneral.addEventListener(
                "click",
                startSelectedCall
            );

        }


        const cancelGeneral =
            byId(
                "cancelGeneralCallButton"
            );


        if (cancelGeneral) {

            cancelGeneral.addEventListener(
                "click",
                closeGeneralCallPicker
            );

        }


        const closeGeneral =
            byId(
                "closeGeneralCallModalButton"
            );


        if (closeGeneral) {

            closeGeneral.addEventListener(
                "click",
                closeGeneralCallPicker
            );

        }


        const voiceButton =
            byId(
                "voiceCallButton"
            );


        if (voiceButton) {

            voiceButton.addEventListener(
                "click",
                () =>
                    openCommunityCallPicker(
                        "voice"
                    )
            );

        }


        const videoButton =
            byId(
                "videoCallButton"
            );


        if (videoButton) {

            videoButton.addEventListener(
                "click",
                () =>
                    openCommunityCallPicker(
                        "video"
                    )
            );

        }


        const mute =
            byId(
                "toggleMicrophoneButton"
            );


        if (mute) {

            mute.addEventListener(
                "click",
                toggleMicrophone
            );

        }


        const camera =
            byId(
                "toggleCameraButton"
            );


        if (camera) {

            camera.addEventListener(
                "click",
                toggleCamera
            );

        }


        const screen =
            byId(
                "shareScreenButton"
            );


        if (screen) {

            screen.addEventListener(
                "click",
                toggleScreenShare
            );

        }


        const leave =
            byId(
                "leaveCallButton"
            );


        if (leave) {

            leave.addEventListener(
                "click",
                leaveCall
            );

        }


        const minimize =
            byId(
                "minimizeCallButton"
            );


        if (minimize) {

            minimize.addEventListener(
                "click",
                () => {

                    callState.minimized =
                        !callState.minimized;


                    const overlay =
                        byId(
                            "callOverlay"
                        );


                    if (overlay) {

                        overlay.classList.toggle(
                            "minimized",
                            callState.minimized
                        );

                    }

                }
            );

        }


        const accept =
            byId(
                "acceptCallButton"
            );


        if (accept) {

            accept.addEventListener(
                "click",
                acceptIncomingCall
            );

        }


        const decline =
            byId(
                "declineCallButton"
            );


        if (decline) {

            decline.addEventListener(
                "click",
                declineIncomingCall
            );

        }

    }


    /* =====================================================
       START SELECTED CALL
       ===================================================== */

    async function startSelectedCall() {

        const selected =
            [
                ...callPickerState
                    .selectedUserIds
            ];


        if (!selected.length) {

            showToast(
                "Select at least one online user."
            );

            return;

        }


        closeGeneralCallPicker();


        await startCall({

            callType:
                callPickerState.callType,

            scope:
                callPickerState.scope,

            communityId:
                callPickerState.communityId,

            participantIds:
                selected

        });

    }


    /* =====================================================
       DIRECT CALL
       ===================================================== */

    async function startDirectCall(
        userId,
        callType = "video"
    ) {

        if (!userId) {
            return;
        }


        await startCall({

            callType,

            scope:
                "direct",

            communityId:
                state.currentCommunity
                    ?.id ||
                null,

            participantIds:
                [
                    String(userId)
                ]

        });

    }


    function bindDirectCallButtons() {

        queryAll(
            "[data-direct-call]"
        )
            .forEach(
                button => {

                    /*
                     * Prevent duplicate listeners.
                     */

                    if (
                        button.dataset
                            .callBound ===
                        "true"
                    ) {
                        return;
                    }


                    button.dataset
                        .callBound =
                        "true";


                    button.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();


                            const userId =
                                button.dataset
                                    .userId;


                            const callType =
                                button.dataset
                                    .callType ||
                                "video";


                            startDirectCall(
                                userId,
                                callType
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       STARTUP
       ===================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {
            return;
        }


        try {

            await loadAuthenticatedUser();

            await loadCurrentProfile();

            await loadCourses();

            await loadCommunities();

            setupCommunityEvents();

            setupCallEvents();

            setupIncomingCallListener();

            await setOnlinePresence();

            startPresenceHeartbeat();


            /*
             * Select saved community,
             * otherwise first available community.
             */

            const savedCommunityId =
                localStorage.getItem(
                    STORAGE.communityId
                );


            const selectedCommunity =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        String(
                            savedCommunityId
                        )
                ) ||
                state.communities[0];


            if (
                selectedCommunity
            ) {

                await selectCommunity(
                    selectedCommunity.id
                );

            } else {

                const rail =
                    byId(
                        "communityRail"
                    );


                if (rail) {

                    rail.innerHTML = `
                        <div class="community-empty">
                            No communities available.
                        </div>
                    `;

                }

            }


            state.initialized =
                true;


            console.log(
                "Mwaniki Community fully initialized."
            );


            console.log(
                "📞 Mwaniki Universal Call Engine loading..."
            );


            console.log(
                "✅ Mwaniki Universal Call Engine ready"
            );


        } catch (error) {

            console.error(
                "❌ Mwaniki Community initialization failed:",
                error
            );


            showToast(
                error.message ||
                    "Community could not initialize."
            );

        }

    }


    /* =====================================================
       GLOBAL PAGE EVENTS
       ===================================================== */

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

                setOnlinePresence();

            }

        }
    );


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.mwanikiCommunity = {

        state,

        refresh:
            async () => {

                await loadCommunities();

                if (
                    state.currentCommunity
                ) {

                    await selectCommunity(
                        state.currentCommunity.id
                    );

                }

            },

        selectCommunity,

        selectChannel,

        sendMessage,

        cancelReply,

        openMembers:
            openMemberDrawer,

        closeMembers:
            closeMemberDrawer,

        openGeneralCallPicker,

        openCommunityCallPicker,

        startDirectCall,

        loadOnlineCallUsers

    };


    window.mwanikiCallEngine = {

        state:
            callState,

        startCall,

        leaveCall,

        toggleMicrophone,

        toggleCamera,

        toggleScreenShare,

        openGeneralCallPicker,

        openCommunityCallPicker,

        loadOnlineCallUsers

    };


    /* =====================================================
       BOOT
       ===================================================== */

    initialize();

}
