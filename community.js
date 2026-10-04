/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY.JS — CLEAN COMMUNITY ENGINE
   ============================================================

   RESPONSIBILITIES
   ------------------------------------------------------------
   • Authentication
   • Student profile
   • Communities
   • Community rail
   • Channels
   • Course channels
   • Members
   • Presence
   • Messages
   • Reactions
   • Attachments
   • Voice notes
   • Message deletion
   • Message search
   • Friends/member interactions
   • Missed-call notifications
   • Call launcher events

   IMPORTANT
   ------------------------------------------------------------
   WebRTC is NOT implemented here.

   ALL REAL CALLING IS OWNED BY:
       community-calls.js

   ACTUAL CALL PAGE:
       community-calls.html

   community.js only decides:
       WHO is being called
       WHICH community is being called
       WHO is online/offline

   ============================================================ */

import { supabase } from "./supabase.js";

(() => {

    "use strict";

    console.log("🚀 Mwaniki Scholars Community Engine starting...");


    /* ========================================================
       1. DATABASE
       ======================================================== */

    const db = supabase;

    if (!db) {
        console.error(
            "❌ Mwaniki Community: Supabase client unavailable."
        );
        return;
    }


    /* ========================================================
       2. APPLICATION STATE
       ======================================================== */

    const state = {

        user: null,

        profile: null,

        courses: [],

        communities: [],

        channels: [],

        members: [],

        messages: [],

        reactions: {},

        currentCommunity: null,

        currentChannel: null,

        currentCourse: null,

        currentReply: null,

        currentAttachment: null,

        channelSearch: "",

        messageSearch: "",

        memberSearch: "",

        realtimeChannels: [],

        presenceChannel: null,

        presenceTimer: null,

        voiceRecorder: null,

        voiceChunks: [],

        voiceStartedAt: null,

        isRecordingVoice: false,

        loadingMessages: false,

        sendingMessage: false,

        initialized: false,

        lastMessageId: null

    };


    /* ========================================================
       3. DOM HELPERS
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


    function setText(id, value) {

        const element = byId(id);

        if (!element) {
            return;
        }

        element.textContent =
            value === null ||
            value === undefined
                ? ""
                : String(value);
    }


    function show(idOrElement) {

        const element =
            typeof idOrElement === "string"
                ? byId(idOrElement)
                : idOrElement;

        if (!element) {
            return;
        }

        element.classList.remove("hidden");

        element.removeAttribute("hidden");

        element.style.display = "";
    }


    function hide(idOrElement) {

        const element =
            typeof idOrElement === "string"
                ? byId(idOrElement)
                : idOrElement;

        if (!element) {
            return;
        }

        element.classList.add("hidden");

        element.setAttribute(
            "hidden",
            "hidden"
        );
    }


    function toggleElement(
        idOrElement,
        visible
    ) {

        if (visible) {
            show(idOrElement);
        } else {
            hide(idOrElement);
        }
    }


    /* ========================================================
       4. SECURITY HELPERS
       ======================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function escapeAttribute(value) {
        return escapeHTML(value);
    }


    function safeURL(value) {

        const url =
            String(value || "").trim();

        if (!url) {
            return "";
        }

        if (
            /^https?:\/\//i.test(url) ||
            /^blob:/i.test(url) ||
            /^data:image\//i.test(url)
        ) {
            return url;
        }

        return "";
    }


    /* ========================================================
       5. TEXT / NAME HELPERS
       ======================================================== */

    function initials(name) {

        const clean =
            String(name || "Student")
                .trim()
                .replace(/\s+/g, " ");

        if (!clean) {
            return "MS";
        }

        const parts =
            clean.split(" ");

        if (parts.length === 1) {

            return parts[0]
                .slice(0, 2)
                .toUpperCase();
        }

        return (
            parts[0].charAt(0) +
            parts[parts.length - 1].charAt(0)
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


    function getDisplayName(profile) {

        const p = profile || {};

        return (
            p.full_name ||
            p.display_name ||
            p.name ||
            p.student_name ||
            p.username ||
            "Student"
        );
    }


    function getProfileAvatar(profile) {

        const p = profile || {};

        return (
            p.avatar_url ||
            p.photo_url ||
            p.profile_image ||
            p.image ||
            ""
        );
    }


    /* ========================================================
       6. COMMUNITY ICONS
       ========================================================

       NEVER put 🎮 or 😂 into <img src="">.

       This is the reason for the previous:
           %F0%9F%8E%AE 404
           %F0%9F%98%82 404

       ======================================================== */

    function getCommunityIcon(community) {

        const name =
            String(
                community?.name || ""
            ).toLowerCase();

        const slug =
            String(
                community?.slug || ""
            ).toLowerCase();

        if (
            name.includes("gaming") ||
            slug.includes("gaming")
        ) {
            return "🎮";
        }

        if (
            name.includes("meme") ||
            slug.includes("meme")
        ) {
            return "😂";
        }

        if (
            name.includes("mwaniki") ||
            slug.includes("scholar")
        ) {
            return "🎓";
        }

        return "💬";
    }


    function renderCommunityIcon(
        community,
        className = "community-rail-icon"
    ) {

        const iconURL =
            String(
                community?.icon_url || ""
            ).trim();

        if (
            iconURL &&
            /^https?:\/\//i.test(iconURL)
        ) {

            return `
                <span class="${className}">
                    <img
                        src="${escapeAttribute(iconURL)}"
                        alt=""
                        loading="lazy"
                    >
                </span>
            `;
        }

        return `
            <span class="${className}">
                <span class="community-rail-icon-fallback">
                    ${escapeHTML(
                        getCommunityIcon(community)
                    )}
                </span>
            </span>
        `;
    }


    /* ========================================================
       7. TOAST
       ======================================================== */

    let toastTimer = null;

    function toast(
        message,
        type = "normal"
    ) {

        const element =
            byId("toast") ||
            byId("communityToast");

        if (!element) {

            console.log(
                `[Community ${type}]`,
                message
            );

            return;
        }

        element.textContent =
            String(message || "");

        element.classList.add("show");
        element.classList.add("visible");
        element.classList.add("active");

        clearTimeout(toastTimer);

        toastTimer =
            setTimeout(() => {

                element.classList.remove(
                    "show"
                );

                element.classList.remove(
                    "visible"
                );

                element.classList.remove(
                    "active"
                );

            }, 3200);
    }


    /* ========================================================
       8. AUTHENTICATION
       ======================================================== */

    async function loadUser() {

        try {

            const {
                data,
                error
            } = await db.auth.getUser();

            if (error) {
                throw error;
            }

            state.user =
                data?.user || null;

            return state.user;

        } catch (error) {

            console.error(
                "❌ Authentication error:",
                error
            );

            state.user = null;

            return null;
        }
    }


    async function requireUser() {

        const user =
            await loadUser();

        if (user) {
            return true;
        }

        console.warn(
            "⚠️ Community requires authentication."
        );

        window.location.href =
            "./index.html";

        return false;
    }


    function setupAuthListener() {

        db.auth.onAuthStateChange(
            (event, session) => {

                console.log(
                    "🔐 Community auth:",
                    event
                );

                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    state.user = null;

                    cleanupRealtime();

                    window.location.href =
                        "./index.html";

                    return;
                }

                if (session?.user) {

                    state.user =
                        session.user;
                }
            }
        );
    }


    /* ========================================================
       9. PROFILE
       ======================================================== */

    async function loadProfile() {

        if (!state.user?.id) {
            return null;
        }

        /*
         * The project already uses the students table
         * for student profile information.
         */

        try {

            const {
                data,
                error
            } = await db
                .from("students")
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();

            if (error) {

                console.warn(
                    "⚠️ Student profile query:",
                    error
                );

                state.profile = null;

                return null;
            }

            state.profile =
                data || null;

            renderHeaderProfile();

            return state.profile;

        } catch (error) {

            console.warn(
                "⚠️ Profile loading failed:",
                error
            );

            return null;
        }
    }


    function getCurrentName() {

        return (
            getDisplayName(
                state.profile
            ) ||
            state.user?.user_metadata
                ?.full_name ||
            state.user?.user_metadata
                ?.name ||
            state.user?.email?.split("@")[0] ||
            "Student"
        );
    }


    function getCurrentAvatar() {

        return (
            getProfileAvatar(
                state.profile
            ) ||
            state.user?.user_metadata
                ?.avatar_url ||
            state.user?.user_metadata
                ?.picture ||
            ""
        );
    }


    function createInitialAvatar(name) {

        const text =
            initials(name);

        const svg = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="160"
                height="160"
                viewBox="0 0 160 160"
            >
                <rect
                    width="160"
                    height="160"
                    rx="80"
                    fill="#087f73"
                />
                <text
                    x="80"
                    y="98"
                    text-anchor="middle"
                    font-size="52"
                    font-family="Arial,sans-serif"
                    font-weight="700"
                    fill="#ffffff"
                >
                    ${escapeHTML(text)}
                </text>
            </svg>
        `;

        return (
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(svg)
        );
    }


    function renderHeaderProfile() {

        const name =
            getCurrentName();

        const avatar =
            safeURL(
                getCurrentAvatar()
            ) ||
            createInitialAvatar(name);

        setText(
            "headerProfileName",
            name
        );

        const image =
            byId("headerProfileAvatar");

        if (image) {

            image.onerror =
                function () {

                    this.onerror = null;

                    this.src =
                        createInitialAvatar(
                            name
                        );
                };

            image.src = avatar;

            image.alt =
                `${name} profile photo`;
        }
    }


    /* ========================================================
       10. COURSES
       ======================================================== */

    async function loadCourses() {

        try {

            const {
                data,
                error
            } = await db
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
                throw error;
            }

            state.courses =
                data || [];

            return state.courses;

        } catch (error) {

            console.error(
                "❌ Courses failed:",
                error
            );

            state.courses = [];

            return [];
        }
    }


    function getCourse(courseId) {

        return (
            state.courses.find(
                course =>
                    String(course.id) ===
                    String(courseId)
            ) || null
        );
    }


    /* ========================================================
       11. COMMUNITIES
       ======================================================== */

    async function loadCommunities() {

        try {

            const {
                data,
                error
            } = await db
                .from(
                    "chat_communities"
                )
                .select(`
                    id,
                    name,
                    slug,
                    description,
                    icon_url,
                    is_public,
                    is_active,
                    created_by,
                    created_at,
                    updated_at
                `)
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

            renderCommunities();

            return state.communities;

        } catch (error) {

            console.error(
                "❌ Communities failed:",
                error
            );

            state.communities = [];

            renderCommunities();

            return [];
        }
    }


    function renderCommunities() {

        const rail =
            byId("communityRailList") ||
            byId("communityRail");

        if (!rail) {
            return;
        }

        if (
            !state.communities.length
        ) {

            rail.innerHTML = `
                <div class="empty-state">
                    No communities available.
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

                        return `
                            <button
                                type="button"
                                class="community-rail-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-community-id="${
                                    escapeAttribute(
                                        community.id
                                    )
                                }"
                                title="${
                                    escapeAttribute(
                                        community.name
                                    )
                                }"
                            >
                                ${renderCommunityIcon(
                                    community
                                )}
                            </button>
                        `;
                    }
                )
                .join("");

        queryAll(
            "[data-community-id]",
            rail
        ).forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const id =
                        button.dataset
                            .communityId;

                    await selectCommunity(
                        id
                    );
                }
            );
        });
    }


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
            return;
        }

        state.currentCommunity =
            community;

        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );

        localStorage.setItem(
            "mwanikiCommunityName",
            community.name || ""
        );

        setText(
            "selectedCommunityName",
            community.name ||
            "Community"
        );

        setText(
            "selectedCommunityDescription",
            community.description ||
            "Mwaniki Scholars community"
        );

        const selectedIcon =
            byId(
                "selectedCommunityIcon"
            );

        if (selectedIcon) {

            selectedIcon.innerHTML =
                renderCommunityIcon(
                    community,
                    "selected-community-icon"
                );
        }

        renderCommunities();

        await loadChannels();

        await loadCommunityMembers();

        await subscribeCommunityRealtime();

        startPresence();

        /*
         * General call is separate.
         * Community call belongs to selected community.
         */
    }


    /* ========================================================
       12. CHANNELS
       ======================================================== */

    function channelCategory(channel) {

        if (
            channel.course_id !== null &&
            channel.course_id !== undefined
        ) {
            return "Courses";
        }

        const type =
            String(
                channel.channel_type || ""
            ).toLowerCase();

        if (
            type === "announcement" ||
            type === "information"
        ) {
            return "Information";
        }

        if (
            type === "discussion"
        ) {
            return "Discussion";
        }

        if (
            type === "voice"
        ) {
            return "Voice";
        }

        if (
            type === "contest"
        ) {
            return "Contests";
        }

        return "Community";
    }


    async function loadChannels() {

        if (
            !state.currentCommunity?.id
        ) {
            return [];
        }

        try {

            const {
                data,
                error
            } = await db
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .order(
                    "position",
                    {
                        ascending: true,
                        nullsFirst: false
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

            renderChannels();

            selectInitialChannel();

            return state.channels;

        } catch (error) {

            console.error(
                "❌ Channels failed:",
                error
            );

            state.channels = [];

            renderChannels();

            return [];
        }
    }


    function renderChannels() {

        const list =
            byId("channelList");

        if (!list) {
            return;
        }

        if (
            !state.channels.length
        ) {

            list.innerHTML = `
                <div class="empty-state">
                    No channels available.
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
                            channel.category,
                            channel.channel_type
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

        const groups =
            new Map();

        filtered.forEach(
            channel => {

                const category =
                    channel.category ||
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
                                data-channel-id="${
                                    escapeAttribute(
                                        channel.id
                                    )
                                }"
                                title="${
                                    escapeAttribute(
                                        channel.description ||
                                        channel.name ||
                                        ""
                                    )
                                }"
                            >

                                <span class="channel-icon">
                                    ${escapeHTML(
                                        icon
                                    )}
                                </span>

                                <span class="channel-name">
                                    ${escapeHTML(
                                        channel.name ||
                                        "channel"
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

        queryAll(
            "[data-channel-id]",
            list
        ).forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await selectChannel(
                        button.dataset
                            .channelId
                    );
                }
            );
        });
    }


    function selectInitialChannel() {

        if (
            !state.channels.length
        ) {
            return;
        }

        const stored =
            localStorage.getItem(
                "mwanikiChannelId"
            );

        let channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(stored)
            );

        if (!channel) {

            channel =
                state.channels.find(
                    item =>
                        !item.course_id
                ) ||
                state.channels[0];
        }

        selectChannel(
            channel.id
        );
    }


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

        localStorage.setItem(
            "mwanikiChannelId",
            String(channel.id)
        );

        setText(
            "currentChannelName",
            channel.name ||
            "channel"
        );

        setText(
            "currentChannelDescription",
            channel.description ||
            ""
        );

        setText(
            "currentChannelIcon",
            channel.icon ||
            "#"
        );

        renderChannels();

        await loadMessages();

        await subscribeChannelRealtime();

        markChannelRead();
    }


    /* ========================================================
       13. MESSAGES
       ======================================================== */

    async function loadMessages() {

        const messageList =
            byId("messageList");

        const loading =
            byId("messageLoading");

        if (!messageList) {
            console.warn(
                "⚠️ #messageList not found."
            );
            return;
        }

        if (
            !state.currentChannel?.id
        ) {
            return;
        }

        state.loadingMessages =
            true;

        if (loading) {
            loading.textContent =
                "Loading messages...";
        }

        try {

            const {
                data,
                error
            } = await db
                .from("chat_messages")
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    message_type,
                    is_deleted,
                    created_at,
                    updated_at
                `)
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

            await enrichMessages();

            renderMessages();

        } catch (error) {

            console.error(
                "❌ Message loading failed:",
                error
            );

            messageList.innerHTML = `
                <div class="empty-state">
                    Unable to load messages.
                </div>
            `;

        } finally {

            state.loadingMessages =
                false;

            if (loading) {
                loading.textContent = "";
            }
        }
    }


    async function enrichMessages() {

        if (!state.messages.length) {
            return;
        }

        const ids = [
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

        /*
         * Try the project's public chat profile table.
         */

        try {

            const {
                data,
                error
            } = await db
                .from("chat_public_profiles")
                .select("*")
                .in(
                    "id",
                    ids
                );

            if (error) {
                throw error;
            }

            const map =
                new Map(
                    (data || []).map(
                        profile => [
                            String(
                                profile.id
                            ),
                            profile
                        ]
                    )
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

        } catch (error) {

            /*
             * Do not break the chat just because
             * profile enrichment is unavailable.
             */

            console.warn(
                "⚠️ Public profile enrichment unavailable:",
                error
            );
        }
    }


    function renderMessages() {

        const list =
            byId("messageList");

        if (!list) {
            return;
        }

        if (!state.messages.length) {

            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
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
                            .includes(search)
                )
                : state.messages;

        list.innerHTML =
            messages
                .map(
                    message =>
                        renderMessage(
                            message
                        )
                )
                .join("");

        attachMessageActions();

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

        const deleted =
            Boolean(
                message.is_deleted
            );

        const mine =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );

        const profile =
            message.profile || {};

        const name =
            getDisplayName(
                profile
            );

        const avatar =
            safeURL(
                getProfileAvatar(
                    profile
                )
            );

        const messageType =
            message.message_type ||
            "text";

        let body = "";

        if (deleted) {

            body = `
                <div class="message-deleted">
                    This message was deleted.
                </div>
            `;

        } else if (
            messageType ===
            "voice"
        ) {

            body = `
                <div class="voice-message">
                    <span class="voice-message-icon">
                        🎙️
                    </span>

                    <audio
                        controls
                        preload="metadata"
                        data-voice-message="${
                            escapeAttribute(
                                message.id
                            )
                        }"
                    ></audio>
                </div>
            `;

        } else {

            body = `
                <div class="message-content">
                    ${escapeHTML(
                        message.content ||
                        ""
                    ).replace(
                        /\n/g,
                        "<br>"
                    )}
                </div>
            `;
        }

        return `
            <article
                class="chat-message ${
                    mine
                        ? "own-message"
                        : ""
                }"
                data-message-id="${
                    escapeAttribute(
                        message.id
                    )
                }"
            >

                <div class="message-avatar">

                    ${
                        avatar
                            ? `
                                <img
                                    src="${
                                        escapeAttribute(
                                            avatar
                                        )
                                    }"
                                    alt=""
                                    onerror="this.style.display='none'"
                                >
                              `
                            : `
                                <span>
                                    ${escapeHTML(
                                        initials(
                                            name
                                        )
                                    )}
                                </span>
                              `
                    }

                </div>

                <div class="message-main">

                    <div class="message-header">

                        <strong class="message-author">
                            ${escapeHTML(
                                name
                            )}
                        </strong>

                        <time class="message-time">
                            ${escapeHTML(
                                formatTime(
                                    message.created_at
                                )
                            )}
                        </time>

                    </div>

                    ${body}

                    <div class="message-actions">

                        <button
                            type="button"
                            class="message-action"
                            data-react-message="${
                                escapeAttribute(
                                    message.id
                                )
                            }"
                            title="React"
                        >
                            ❤️
                        </button>

                        ${
                            mine && !deleted
                                ? `
                                    <button
                                        type="button"
                                        class="message-action danger"
                                        data-delete-message="${
                                            escapeAttribute(
                                                message.id
                                            )
                                        }"
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


    function formatTime(value) {

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


    /* ========================================================
       14. MESSAGE ACTIONS
       ======================================================== */

    function attachMessageActions() {

        queryAll(
            "[data-delete-message]"
        ).forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await deleteMessage(
                        button.dataset
                            .deleteMessage
                    );
                }
            );
        });


        queryAll(
            "[data-react-message]"
        ).forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await reactToMessage(
                        button.dataset
                            .reactMessage,
                        "❤️"
                    );
                }
            );
        });
    }


    /* ========================================================
       15. SAFE MESSAGE DELETION
       ========================================================

       IMPORTANT FIX:

       The old implementation attempted:
           query.delete().eq().catch()

       That is wrong.

       Supabase query builders are awaited.

       Also the database has:
           chat_messages_content_check

       Therefore we do NOT replace content with empty text.

       We soft-delete using:
           "[deleted]"

       ======================================================== */

    async function deleteMessage(
        messageId
    ) {

        if (!messageId) {
            return;
        }

        if (!state.user?.id) {
            toast(
                "Please sign in first.",
                "error"
            );
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

        if (
            String(
                message.user_id
            ) !==
            String(
                state.user.id
            )
        ) {

            toast(
                "You can only delete your own messages.",
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

            /*
             * STEP 1
             * Soft-delete parent message FIRST.
             */

            const {
                error
            } = await db
                .from(
                    "chat_messages"
                )
                .update({
                    content: "[deleted]",
                    is_deleted: true
                })
                .eq(
                    "id",
                    messageId
                )
                .eq(
                    "user_id",
                    state.user.id
                );

            if (error) {
                throw error;
            }


            /*
             * STEP 2
             * Remove attachment records/storage
             * as best-effort cleanup.
             *
             * Failure here must NOT undo
             * the successful message deletion.
             */

            try {

                const {
                    data: attachments
                } = await db
                    .from(
                        "chat_attachments"
                    )
                    .select("*")
                    .eq(
                        "message_id",
                        messageId
                    );

                for (
                    const attachment
                    of attachments || []
                ) {

                    const path =
                        attachment.storage_path ||
                        attachment.file_path ||
                        attachment.path ||
                        "";

                    if (path) {

                        try {

                            await db.storage
                                .from(
                                    "chat-attachments"
                                )
                                .remove([
                                    path
                                ]);

                        } catch (
                            storageError
                        ) {

                            console.warn(
                                "⚠️ Attachment storage cleanup failed:",
                                storageError
                            );
                        }
                    }


                    try {

                        if (
                            attachment.id
                        ) {

                            await db
                                .from(
                                    "chat_attachments"
                                )
                                .delete()
                                .eq(
                                    "id",
                                    attachment.id
                                );
                        }

                    } catch (
                        attachmentError
                    ) {

                        console.warn(
                            "⚠️ Attachment row cleanup failed:",
                            attachmentError
                        );
                    }
                }

            } catch (
                cleanupError
            ) {

                console.warn(
                    "⚠️ Attachment cleanup failed:",
                    cleanupError
                );
            }


            toast(
                "Message deleted.",
                "success"
            );

            await loadMessages();

        } catch (error) {

            console.error(
                "❌ Delete message failed:",
                error
            );

            toast(
                error?.message ||
                "Unable to delete message.",
                "error"
            );
        }
    }


    /* ========================================================
       16. REACTIONS
       ======================================================== */

    async function reactToMessage(
        messageId,
        reaction
    ) {

        if (
            !state.user?.id ||
            !messageId
        ) {
            return;
        }

        try {

            const {
                data: existing,
                error: existingError
            } = await db
                .from(
                    "chat_message_reactions"
                )
                .select(
                    "id,reaction"
                )
                .eq(
                    "message_id",
                    messageId
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();

            if (existingError) {
                throw existingError;
            }

            if (existing) {

                if (
                    existing.reaction ===
                    reaction
                ) {

                    const {
                        error
                    } = await db
                        .from(
                            "chat_message_reactions"
                        )
                        .delete()
                        .eq(
                            "id",
                            existing.id
                        );

                    if (error) {
                        throw error;
                    }

                } else {

                    const {
                        error
                    } = await db
                        .from(
                            "chat_message_reactions"
                        )
                        .update({
                            reaction
                        })
                        .eq(
                            "id",
                            existing.id
                        );

                    if (error) {
                        throw error;
                    }
                }

            } else {

                const {
                    error
                } = await db
                    .from(
                        "chat_message_reactions"
                    )
                    .insert({
                        message_id:
                            messageId,

                        user_id:
                            state.user.id,

                        reaction
                    });

                if (error) {
                    throw error;
                }
            }

        } catch (error) {

            console.error(
                "❌ Reaction failed:",
                error
            );

            toast(
                "Reaction could not be saved.",
                "error"
            );
        }
    }


    /* ========================================================
       17. SEND TEXT MESSAGE
       ======================================================== */

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

        if (!state.user?.id) {

            toast(
                "Please sign in before sending.",
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

        const sendButton =
            byId(
                "sendMessageButton"
            );

        if (sendButton) {
            sendButton.disabled =
                true;
        }

        try {

            const {
                data,
                error
            } = await db
                .from(
                    "chat_messages"
                )
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content,

                    message_type:
                        "text",

                    is_deleted:
                        false
                })
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    message_type,
                    is_deleted,
                    created_at
                `)
                .single();

            if (error) {
                throw error;
            }

            input.value = "";

            if (data) {

                state.messages.push({
                    ...data,

                    profile:
                        state.profile
                });

                renderMessages();
            }

        } catch (error) {

            console.error(
                "❌ Send message failed:",
                error
            );

            toast(
                error?.message ||
                "Message could not be sent.",
                "error"
            );

        } finally {

            state.sendingMessage =
                false;

            if (sendButton) {
                sendButton.disabled =
                    false;
            }
        }
    }


    /* ========================================================
       18. FILE ATTACHMENTS
       ======================================================== */

    async function uploadAttachment(
        file
    ) {

        if (!file) {
            return;
        }

        if (
            !state.user?.id ||
            !state.currentChannel?.id
        ) {

            toast(
                "Select a channel and sign in first.",
                "error"
            );

            return;
        }

        const maxSize =
            25 * 1024 * 1024;

        if (
            file.size >
            maxSize
        ) {

            toast(
                "Files must be 25 MB or smaller.",
                "error"
            );

            return;
        }

        let messageId =
            null;

        let storagePath =
            null;

        try {

            /*
             * Create parent message FIRST.
             */

            const {
                data: message,
                error: messageError
            } = await db
                .from(
                    "chat_messages"
                )
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        file.name ||
                        "Attachment",

                    message_type:
                        "file",

                    is_deleted:
                        false
                })
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    message_type,
                    is_deleted,
                    created_at
                `)
                .single();

            if (messageError) {
                throw messageError;
            }

            messageId =
                message.id;


            /*
             * Upload under the authenticated
             * user's folder.
             */

            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

            storagePath =
                `${state.user.id}/${Date.now()}-${safeName}`;


            const {
                error: uploadError
            } = await db.storage
                .from(
                    "chat-attachments"
                )
                .upload(
                    storagePath,
                    file,
                    {
                        upsert: false,
                        contentType:
                            file.type ||
                            "application/octet-stream"
                    }
                );

            if (uploadError) {
                throw uploadError;
            }


            const {
                data: publicData
            } = db.storage
                .from(
                    "chat-attachments"
                )
                .getPublicUrl(
                    storagePath
                );

            const fileURL =
                publicData?.publicUrl ||
                "";


            /*
             * Create attachment row.
             */

            const {
                error: attachmentError
            } = await db
                .from(
                    "chat_attachments"
                )
                .insert({
                    message_id:
                        messageId,

                    uploaded_by:
                        state.user.id,

                    file_url:
                        fileURL,

                    file_name:
                        file.name,

                    file_type:
                        file.type,

                    file_size:
                        file.size,

                    storage_path:
                        storagePath
                });

            if (attachmentError) {
                throw attachmentError;
            }

            toast(
                "Attachment sent.",
                "success"
            );

            await loadMessages();

        } catch (error) {

            console.error(
                "❌ Attachment upload failed:",
                error
            );


            /*
             * Cleanup storage.
             */

            if (storagePath) {

                try {

                    await db.storage
                        .from(
                            "chat-attachments"
                        )
                        .remove([
                            storagePath
                        ]);

                } catch (
                    cleanupError
                ) {

                    console.warn(
                        "Attachment storage cleanup:",
                        cleanupError
                    );
                }
            }


            /*
             * Soft-delete parent.
             */

            if (messageId) {

                try {

                    await db
                        .from(
                            "chat_messages"
                        )
                        .update({
                            content:
                                "[deleted]",
                            is_deleted:
                                true
                        })
                        .eq(
                            "id",
                            messageId
                        )
                        .eq(
                            "user_id",
                            state.user.id
                        );

                } catch (
                    cleanupError
                ) {

                    console.warn(
                        "Parent message cleanup:",
                        cleanupError
                    );
                }
            }

            toast(
                error?.message ||
                "File could not be uploaded.",
                "error"
            );
        }
    }


    /* ========================================================
       19. ATTACHMENT INPUT
       ======================================================== */

    function setupAttachmentInput() {

        const button =
            byId("attachButton");

        const input =
            byId("attachmentInput");

        if (
            !button ||
            !input
        ) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                input.value = "";

                input.click();
            }
        );

        input.addEventListener(
            "change",
            async event => {

                const file =
                    event.target
                        .files?.[0];

                if (!file) {
                    return;
                }

                await uploadAttachment(
                    file
                );
            }
        );
    }


    /* ========================================================
       20. VOICE NOTES
       ======================================================== */

    async function startVoiceRecording() {

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

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            toast(
                "Voice recording is not supported by this browser.",
                "error"
            );

            return;
        }

        try {

            const stream =
                await navigator
                    .mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            const recorder =
                new MediaRecorder(
                    stream
                );

            state.voiceRecorder =
                recorder;

            state.voiceChunks =
                [];

            state.voiceStartedAt =
                Date.now();

            state.isRecordingVoice =
                true;


            recorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size
                    ) {

                        state.voiceChunks
                            .push(
                                event.data
                            );
                    }
                };


            recorder.onstop =
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    const blob =
                        new Blob(
                            state.voiceChunks,
                            {
                                type:
                                    recorder.mimeType ||
                                    "audio/webm"
                            }
                        );

                    state.voiceRecorder =
                        null;

                    state.voiceChunks =
                        [];

                    state.isRecordingVoice =
                        false;

                    if (
                        blob.size > 0
                    ) {

                        await sendVoiceNote(
                            blob
                        );
                    }

                    updateVoiceButton();
                };


            recorder.start();

            updateVoiceButton();

            toast(
                "Recording voice note...",
                "success"
            );

        } catch (error) {

            console.error(
                "❌ Voice recording failed:",
                error
            );

            state.isRecordingVoice =
                false;

            toast(
                "Microphone permission was not granted.",
                "error"
            );
        }
    }


    function stopVoiceRecording() {

        if (
            state.voiceRecorder &&
            state.voiceRecorder.state !==
                "inactive"
        ) {

            state.voiceRecorder.stop();
        }
    }


    async function sendVoiceNote(
        blob
    ) {

        if (
            !state.user?.id ||
            !state.currentChannel?.id
        ) {
            return;
        }

        let messageId =
            null;

        let storagePath =
            null;

        try {

            /*
             * Parent message first.
             * Content remains valid for the
             * database check constraint.
             */

            const {
                data: message,
                error: messageError
            } = await db
                .from(
                    "chat_messages"
                )
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        "Voice note",

                    message_type:
                        "voice",

                    is_deleted:
                        false
                })
                .select(`
                    id,
                    channel_id,
                    user_id,
                    content,
                    message_type,
                    is_deleted,
                    created_at
                `)
                .single();

            if (messageError) {
                throw messageError;
            }

            messageId =
                message.id;


            const extension =
                blob.type.includes(
                    "ogg"
                )
                    ? "ogg"
                    : "webm";

            storagePath =
                `${state.user.id}/voice-${Date.now()}.${extension}`;


            const {
                error: uploadError
            } = await db.storage
                .from(
                    "chat-attachments"
                )
                .upload(
                    storagePath,
                    blob,
                    {
                        upsert: false,
                        contentType:
                            blob.type ||
                            "audio/webm"
                    }
                );

            if (uploadError) {
                throw uploadError;
            }


            const {
                data: publicData
            } = db.storage
                .from(
                    "chat-attachments"
                )
                .getPublicUrl(
                    storagePath
                );

            const fileURL =
                publicData?.publicUrl ||
                "";


            const {
                error: attachmentError
            } = await db
                .from(
                    "chat_attachments"
                )
                .insert({
                    message_id:
                        messageId,

                    uploaded_by:
                        state.user.id,

                    file_url:
                        fileURL,

                    file_name:
                        `voice-${Date.now()}.${extension}`,

                    file_type:
                        blob.type ||
                        "audio/webm",

                    file_size:
                        blob.size,

                    storage_path:
                        storagePath
                });

            if (attachmentError) {
                throw attachmentError;
            }

            toast(
                "Voice note sent.",
                "success"
            );

            await loadMessages();

        } catch (error) {

            console.error(
                "❌ Voice note failed:",
                error
            );


            if (storagePath) {

                try {

                    await db.storage
                        .from(
                            "chat-attachments"
                        )
                        .remove([
                            storagePath
                        ]);

                } catch (
                    cleanupError
                ) {

                    console.warn(
                        cleanupError
                    );
                }
            }


            if (messageId) {

                try {

                    await db
                        .from(
                            "chat_messages"
                        )
                        .update({
                            content:
                                "[deleted]",
                            is_deleted:
                                true
                        })
                        .eq(
                            "id",
                            messageId
                        )
                        .eq(
                            "user_id",
                            state.user.id
                        );

                } catch (
                    cleanupError
                ) {

                    console.warn(
                        cleanupError
                    );
                }
            }

            toast(
                error?.message ||
                "Voice note could not be sent.",
                "error"
            );
        }
    }


    function updateVoiceButton() {

        const button =
            byId("voiceNoteButton");

        if (!button) {
            return;
        }

        if (
            state.isRecordingVoice
        ) {

            button.textContent =
                "⏹️";

            button.title =
                "Stop recording";

            button.classList.add(
                "recording"
            );

        } else {

            button.textContent =
                "🎙️";

            button.title =
                "Record voice note";

            button.classList.remove(
                "recording"
            );
        }
    }


    function setupVoiceNotes() {

        const button =
            byId(
                "voiceNoteButton"
            );

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                if (
                    state.isRecordingVoice
                ) {

                    stopVoiceRecording();

                } else {

                    startVoiceRecording();
                }
            }
        );
    }
