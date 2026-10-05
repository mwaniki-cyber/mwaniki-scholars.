/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   community.js
   ============================================================

   IMPORTANT
   ----------
   1. DO NOT import { supabase } from "./supabase.js".
   2. supabase.js exposes the client globally.
   3. community-calls.js remains the separate call engine.
   4. Presence is timestamp/activity based.
   5. Messages support replies and deletion.
   6. Composer remains inside the chat viewport.
   ============================================================ */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting");

    /* =========================================================
       SUPABASE
       ========================================================= */

    let db = null;

    function getSupabaseClient() {
        return (
            window.supabaseClient ||
            window.mwanikiSupabase ||
            window.sb ||
            window.supabase ||
            null
        );
    }

    async function waitForSupabase(timeout = 15000) {
        const started = Date.now();

        while (Date.now() - started < timeout) {
            const client = getSupabaseClient();

            if (
                client &&
                typeof client.from === "function" &&
                client.auth
            ) {
                db = client;

                console.log(
                    "✅ Community: Supabase client ready"
                );

                return db;
            }

            await new Promise(resolve =>
                setTimeout(resolve, 100)
            );
        }

        throw new Error(
            "Mwaniki Scholars Supabase client was not found."
        );
    }


    /* =========================================================
       DOM
       ========================================================= */

    const $ = id =>
        document.getElementById(id);

    const dom = {};

    const DOM_IDS = [
        "communityHomeButton",
        "communityRailList",
        "communityCallButton",
        "generalCallButton",

        "profileButton",
        "headerProfileAvatar",
        "headerProfileName",
        "headerPresenceDot",

        "memberList",
        "memberCount",
        "memberSearchInput",

        "informationChannels",
        "courseChannels",
        "communityChannels",
        "contestChannelButton",

        "messageList",
        "messageInput",
        "sendMessageButton",
        "messageForm",

        "emojiPanel",
        "emojiButton",
        "closeEmojiButton",
        "emojiSearch",
        "emojiGrid",

        "stickerPanel",
        "stickerButton",
        "closeStickerButton",

        "gifPanel",
        "gifButton",
        "closeGifButton",

        "attachmentPreview",
        "attachmentButton",
        "voiceNoteButton",

        "channelSearchInput",
        "channelList",

        "communityRail",
        "channelSidebar",
        "memberSidebar",

        "communityModal",
        "communityChoiceList",
        "communityModalSearch",
        "closeCommunityModal",

        "communitySelectorButton",

        "selectedCommunityIcon",
        "selectedCommunityName",
        "selectedCommunityDescription",

        "activeCommunityIcon",
        "activeCommunityName",
        "activeCommunityDescription",

        "mainChannelTitle",
        "mainChannelDescription",

        "activeChannelName",
        "activeChannelDescription",
        "activeRoleBadge",

        "channelToggleButton",
        "memberToggleButton",

        "closeMemberSidebarButton",

        "chatSearchButton",
        "messageSearch",
        "messageSearchInput",
        "closeMessageSearchButton",

        "communityStatus",
        "toast",

        "createChannelButton",
        "channelForm",
        "channelNameInput",
        "channelDescriptionInput",
        "channelVisibilitySelect",
        "closeChannelModalButton",
        "channelModal",

        "generalCallModal",
        "closeGeneralCallModalButton",
        "generalVoiceCallButton",
        "generalVideoCallButton",
        "generalCallUserList",
        "generalCallUserStatus",
        "generalCallSelectionCount",
        "cancelGeneralCallButton",
        "startGeneralCallButton",

        "friendsButton",
        "friendsModal",
        "closeFriendsButton",
        "friendsContent",

        "rulesButton",
        "rulesModal",
        "closeRulesButton",

        "profileModal",
        "closeProfileButton",

        "contestModal",
        "closeContestButton",
        "contestCourseSelector",
        "contestQuestionArea"
    ];

    function cacheDom() {
        DOM_IDS.forEach(id => {
            dom[id] = $(id);
        });
    }


    /* =========================================================
       STATE
       ========================================================= */

    const state = {
        user: null,
        profile: null,

        communities: [],
        channels: [],
        members: [],
        messages: [],

        currentCommunity: null,
        currentChannel: null,

        currentRole: "student",

        currentReply: null,

        channelSearch: "",
        memberSearch: "",
        messageSearch: "",

        realtimeChannels: [],

        initialized: false,

        presenceTimer: null,
        presenceWriteInFlight: false,

        lastUserActivityAt: Date.now(),

        activityHandlers: [],

        visibilityHandler: null,

        messageSubscription: null,
        presenceSubscription: null,

        sendingMessage: false,

        emojiOpen: false,
        stickerOpen: false,
        gifOpen: false,

        selectedGeneralCallUsers: new Set(),

        attachmentFile: null,

        voiceRecorder: null,
        voiceChunks: [],
        voiceStartedAt: null,
        voiceTimer: null,

        messageLimit: 500
    };


    /* =========================================================
       CONFIG
       ========================================================= */

    const PRESENCE = {
        ONLINE_WINDOW: 60 * 1000,
        AWAY_WINDOW: 3 * 60 * 1000,
        HEARTBEAT: 15 * 1000,
        IDLE_AFTER: 2 * 60 * 1000
    };

    const STORAGE = {
        communityId: "mwanikiCommunityId",
        communityName: "communityCourseName",
        courseId: "communityCourseId",
        courseName: "communityCourseName"
    };


 /* =========================================================
   HELPERS
   ========================================================= */

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


/* =========================================================
   INITIALS
   ========================================================= */

function initials(name) {
    const cleanName = String(name || "Student")
        .trim()
        .replace(/\s+/g, " ");

    if (!cleanName) {
        return "S";
    }

    const parts = cleanName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 1) {
        return (
            parts[0]
                .substring(0, 2)
                .toUpperCase() || "S"
        );
    }

    return (
        parts
            .map(part =>
                part.charAt(0).toUpperCase()
            )
            .join("") || "S"
    );
}


/* =========================================================
   AVATAR FALLBACK
   ========================================================= */

function avatarFallback(name) {
    const text = escapeHTML(
        initials(name)
    );

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="96"
            height="96"
            viewBox="0 0 96 96"
            role="img"
            aria-label="${text}"
        >
            <rect
                x="0"
                y="0"
                width="96"
                height="96"
                rx="48"
                fill="#087f73"
            />

            <text
                x="48"
                y="58"
                text-anchor="middle"
                dominant-baseline="middle"
                font-family="Arial, Helvetica, sans-serif"
                font-size="30"
                font-weight="700"
                fill="#ffffff"
            >${text}</text>
        </svg>
    `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}


/* =========================================================
   SAFE URL
   ========================================================= */

function safeURL(url) {
    const value = String(url || "")
        .trim();

    if (!value) {
        return "";
    }

    /*
     * Allow normal HTTPS/HTTP URLs.
     * Supabase Storage photo URLs normally arrive here.
     */
    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    /*
     * Allow local project paths.
     */
    if (
        value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../")
    ) {
        return value;
    }

    /*
     * Allow image data URLs for generated
     * initials/avatar fallbacks.
     */
    if (
        /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(
            value
        )
    ) {
        return value;
    }

    return "";
}


/* =========================================================
   PROFILE NAME
   ========================================================= */

function profileName(profile) {
    if (!profile) {
        return "Student";
    }

    const name =
        profile.full_name ||
        profile.display_name ||
        profile.nickname ||
        profile.name ||
        profile.username ||
        "";

    const cleanName = String(name)
        .trim()
        .replace(/\s+/g, " ");

    return cleanName || "Student";
}


/* =========================================================
   PROFILE PHOTO
   ========================================================= */

function profilePhoto(profile) {
    if (!profile) {
        return avatarFallback("Student");
    }

    /*
     * Support the different profile structures used
     * throughout the Mwaniki Scholars community.
     */
    const possiblePhotos = [
        profile.photo_url,
        profile.avatar_url,
        profile.profile_photo,
        profile.profile_photo_url,
        profile.image_url,
        profile.photo,
        profile.avatar
    ];

    for (const photo of possiblePhotos) {
        const url = safeURL(photo);

        if (url) {
            return url;
        }
    }

    return avatarFallback(
        profileName(profile)
    );
}


/* =========================================================
   AVATAR ERROR HANDLER
   ========================================================= */

function avatarError(image, name) {
    if (!image) {
        return;
    }

    /*
     * Prevent an invalid photo URL from repeatedly
     * triggering the error handler.
     */
    image.onerror = null;

    image.src = avatarFallback(
        name || "Student"
    );
}


/* =========================================================
   SHOW TOAST
   ========================================================= */

function showToast(message) {
    const element =
        dom.toast ||
        $("communityToast");

    if (!element) {
        console.log(
            "[Mwaniki Scholars]",
            message
        );
        return;
    }

    element.textContent =
        String(message || "");

    element.classList.remove(
        "hidden"
    );

    if ("hidden" in element) {
        element.hidden = false;
    }

    clearTimeout(
        showToast.timer
    );

    showToast.timer = setTimeout(() => {
        element.classList.add(
            "hidden"
        );

        if ("hidden" in element) {
            element.hidden = true;
        }
    }, 3000);
}


/* =========================================================
   COMMUNITY STATUS
   ========================================================= */

function setStatus(message) {
    if (!dom.communityStatus) {
        return;
    }

    dom.communityStatus.textContent =
        String(message || "");
}


/* =========================================================
   OPEN ELEMENT
   ========================================================= */

function openElement(element) {
    if (!element) {
        return;
    }

    element.classList.remove(
        "hidden"
    );

    if ("hidden" in element) {
        element.hidden = false;
    }

    /*
     * Support elements that may have been
     * hidden through inline display styles.
     */
    if (
        element.style.display === "none"
    ) {
        element.style.removeProperty(
            "display"
        );
    }

    element.setAttribute(
        "aria-hidden",
        "false"
    );
}


/* =========================================================
   CLOSE ELEMENT
   ========================================================= */

function closeElement(element) {
    if (!element) {
        return;
    }

    element.classList.add(
        "hidden"
    );

    if ("hidden" in element) {
        element.hidden = true;
    }

    element.setAttribute(
        "aria-hidden",
        "true"
    );
}

    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {
        if (!state.user?.id) return null;

        try {
            const { data, error } =
                await db
                    .from("students")
                    .select(
                        "id, full_name, email, phone, course, level, photo_url"
                    )
                    .eq("id", state.user.id)
                    .maybeSingle();

            if (error) {
                console.warn(
                    "Student profile lookup failed:",
                    error
                );
            }

            state.profile = data || {
                id: state.user.id,
                full_name:
                    state.user.user_metadata?.full_name ||
                    state.user.email ||
                    "Student",
                photo_url:
                    state.user.user_metadata?.photo_url ||
                    state.user.user_metadata?.avatar_url ||
                    ""
            };

            renderHeaderProfile();

            return state.profile;
        } catch (error) {
            console.warn(
                "Profile loading failed:",
                error
            );

            state.profile = {
                id: state.user.id,
                full_name:
                    state.user.user_metadata?.full_name ||
                    state.user.email ||
                    "Student",
                photo_url:
                    state.user.user_metadata?.photo_url ||
                    state.user.user_metadata?.avatar_url ||
                    ""
            };

            renderHeaderProfile();

            return state.profile;
        }
    }

    function renderHeaderProfile() {
        const name =
            profileName(state.profile);

        const photo =
            profilePhoto(state.profile);

        if (dom.headerProfileName) {
            dom.headerProfileName.textContent =
                name;
        }

        if (dom.headerProfileAvatar) {
            dom.headerProfileAvatar.src =
                photo;

            dom.headerProfileAvatar.alt =
                `${name} profile photo`;

            dom.headerProfileAvatar.onerror =
                () => {
                    dom.headerProfileAvatar.onerror =
                        null;

                    dom.headerProfileAvatar.src =
                        avatarFallback(name);
                };
        }
    }


    /* =========================================================
       AUTH
       ========================================================= */

    async function loadAuthenticatedUser() {
        const {
            data,
            error
        } = await db.auth.getUser();

        if (error) {
            throw error;
        }

        return data?.user || null;
    }

    async function requireAuthentication() {
        state.user =
            await loadAuthenticatedUser();

        if (!state.user) {
            console.warn(
                "⚠️ Community: no authenticated user"
            );

            window.location.href =
                "./index.html";

            return false;
        }

        console.log(
            "✅ Community authenticated:",
            state.user.id
        );

        return true;
    }

    function setupAuthListener() {
        const result =
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
                        stopPresence();
                        cleanupRealtime();

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

                        startPresence();
                    }
                }
            );

        state.authSubscription =
            result?.data?.subscription ||
            null;
    }


    /* =========================================================
       PRESENCE
       ========================================================= */

    function calculatePresence(
        presence,
        lastSeen
    ) {
        const status =
            presence?.status;

        const timestamp =
            Date.parse(
                lastSeen ||
                presence?.last_seen_at ||
                presence?.updated_at ||
                ""
            );

        if (!Number.isFinite(timestamp)) {
            return "offline";
        }

        const age =
            Math.max(
                0,
                Date.now() - timestamp
            );

        /*
         * Timestamp wins over stale status.
         *
         * This prevents an active account from
         * remaining stuck on Away.
         */
        if (
            age <=
            PRESENCE.ONLINE_WINDOW
        ) {
            if (status === "dnd") {
                return "dnd";
            }

            return "online";
        }

        if (
            age <=
            PRESENCE.AWAY_WINDOW
        ) {
            return "away";
        }

        return "offline";
    }

    function presenceLabel(status) {
        return {
            online: "Online",
            away: "Away / Idle",
            dnd: "Do Not Disturb",
            offline: "Offline"
        }[status] || "Offline";
    }

    function updateHeaderPresence(status) {
        const dot =
            dom.headerPresenceDot;

        if (!dot) return;

        dot.classList.remove(
            "online",
            "away",
            "dnd",
            "offline"
        );

        dot.classList.add(
            status || "offline"
        );

        dot.title =
            presenceLabel(status);

        dot.setAttribute(
            "aria-label",
            presenceLabel(status)
        );
    }

    function getDesiredPresenceStatus() {
        if (document.hidden) {
            return "away";
        }

        const idleFor =
            Date.now() -
            state.lastUserActivityAt;

        if (
            idleFor >=
            PRESENCE.IDLE_AFTER
        ) {
            return "away";
        }

        return "online";
    }

    function recordPresenceActivity() {
        state.lastUserActivityAt =
            Date.now();
    }

    async function writePresence(status) {
        if (
            !state.user?.id ||
            !db ||
            state.presenceWriteInFlight
        ) {
            return;
        }

        state.presenceWriteInFlight =
            true;

        const now =
            new Date().toISOString();

        try {
            const payload = {
                user_id:
                    state.user.id,
                status:
                    status === "dnd"
                        ? "dnd"
                        : status === "away"
                        ? "away"
                        : "online",
                last_seen_at:
                    now,
                updated_at:
                    now
            };

            const { error } =
                await db
                    .from("chat_presence")
                    .upsert(
                        payload,
                        {
                            onConflict:
                                "user_id"
                        }
                    );

            if (error) {
                console.warn(
                    "Presence write failed:",
                    error
                );

                return;
            }

            if (
                state.currentCommunity
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
                            status:
                                payload.status,
                            last_seen_at:
                                now,
                            last_active_at:
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
                        "Community member presence update failed:",
                        memberError
                    );
                }
            }

            updateHeaderPresence(
                payload.status
            );
        } finally {
            state.presenceWriteInFlight =
                false;
        }
    }

    function startPresence() {
        stopPresence();

        state.lastUserActivityAt =
            Date.now();

        writePresence("online");

        const events = [
            "mousemove",
            "mousedown",
            "keydown",
            "touchstart",
            "scroll"
        ];

        events.forEach(eventName => {
            const handler =
                recordPresenceActivity;

            window.addEventListener(
                eventName,
                handler,
                {
                    passive: true
                }
            );

            state.activityHandlers.push({
                eventName,
                handler
            });
        });

        state.visibilityHandler =
            () => {
                if (!document.hidden) {
                    recordPresenceActivity();
                }

                writePresence(
                    document.hidden
                        ? "away"
                        : "online"
                );
            };

        document.addEventListener(
            "visibilitychange",
            state.visibilityHandler
        );

        state.presenceTimer =
            setInterval(() => {
                const status =
                    getDesiredPresenceStatus();

                writePresence(status);

                if (
                    state.currentCommunity
                ) {
                    refreshMemberPresence();
                }
            }, PRESENCE.HEARTBEAT);
    }

    function stopPresence() {
        if (state.presenceTimer) {
            clearInterval(
                state.presenceTimer
            );

            state.presenceTimer =
                null;
        }

        if (
            state.visibilityHandler
        ) {
            document.removeEventListener(
                "visibilitychange",
                state.visibilityHandler
            );

            state.visibilityHandler =
                null;
        }

        state.activityHandlers
            .forEach(item => {
                window.removeEventListener(
                    item.eventName,
                    item.handler
                );
            });

        state.activityHandlers =
            [];
    }


    /* =========================================================
       COMMUNITIES
       ========================================================= */

    async function loadCommunities() {
        const {
            data,
            error
        } = await db
            .from("chat_communities")
            .select(`
                id,
                name,
                slug,
                description,
                icon_url,
                is_public,
                is_active
            `)
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

        if (error) {
            throw error;
        }

        state.communities =
            data || [];

        /*
         * Mwaniki Scholars must be preferred
         * over Gaming/Memes on first load.
         */
        const storedId =
            localStorage.getItem(
                STORAGE.communityId
            );

        let selected =
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(
                        storedId
                    )
            );

        if (!selected) {
            selected =
                state.communities.find(
                    community =>
                        String(
                            community.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                "mwaniki scholars"
                            )
                );
        }

        if (!selected) {
            selected =
                state.communities[0] ||
                null;
        }

        renderCommunityRail();

        if (selected) {
            await selectCommunity(
                selected.id
            );
        }
    }

    function communityIcon(community) {
        if (community?.icon_url) {
            return `
                <img
                    src="${escapeAttribute(
                        safeURL(
                            community.icon_url
                        )
                    )}"
                    alt=""
                    aria-hidden="true"
                >
            `;
        }

        return escapeHTML(
            initials(
                community?.name
            )
        );
    }

    function renderCommunityRail() {
        const container =
            dom.communityRailList;

        if (!container) return;

        container.innerHTML = "";

        state.communities
            .forEach(community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "community-rail-item";

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name ||
                    "Community";

                if (
                    state.currentCommunity &&
                    String(
                        state.currentCommunity.id
                    ) ===
                    String(
                        community.id
                    )
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.innerHTML = `
                    <span
                        class="community-rail-icon"
                    >
                        ${communityIcon(
                            community
                        )}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community.id
                        )
                );

                container.appendChild(
                    button
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

        cleanupMessageRealtime();

        state.currentCommunity =
            community;

        state.currentChannel =
            null;

        state.currentRole =
            "student";

        localStorage.setItem(
            STORAGE.communityId,
            String(community.id)
        );

        localStorage.setItem(
            STORAGE.communityName,
            community.name || ""
        );

        renderCommunityRail();
        renderSelectedCommunity();

        await loadChannels(
            community.id
        );

        await loadMembers(
            community.id
        );

        await subscribePresence();

        /*
         * Prefer a normal discussion channel.
         */
        const channel =
            chooseDefaultChannel(
                state.channels
            );

        if (channel) {
            await selectChannel(
                channel.id
            );
        } else {
            renderMessages();
        }
    }

    function renderSelectedCommunity() {
        const community =
            state.currentCommunity;

        if (!community) return;

        const icon =
            communityIcon(
                community
            );

        if (dom.selectedCommunityIcon) {
            dom.selectedCommunityIcon.innerHTML =
                icon;
        }

        if (dom.activeCommunityIcon) {
            dom.activeCommunityIcon.innerHTML =
                icon;
        }

        if (dom.selectedCommunityName) {
            dom.selectedCommunityName.textContent =
                community.name || "";
        }

        if (dom.activeCommunityName) {
            dom.activeCommunityName.textContent =
                community.name || "";
        }

        if (
            dom.selectedCommunityDescription
        ) {
            dom.selectedCommunityDescription
                .textContent =
                community.description ||
                "";
        }

        if (
            dom.activeCommunityDescription
        ) {
            dom.activeCommunityDescription
                .textContent =
                community.description ||
                "";
        }
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels(
        communityId
    ) {
        const {
            data,
            error
        } = await db
            .from("chat_channels")
            .select(`
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
            `)
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
    }

    function chooseDefaultChannel(
        channels
    ) {
        if (!channels.length) {
            return null;
        }

        const discussion =
            channels.find(channel => {
                const name =
                    String(
                        channel.name ||
                        ""
                    ).toLowerCase();

                const slug =
                    String(
                        channel.slug ||
                        ""
                    ).toLowerCase();

                return (
                    !channel.is_private &&
                    channel.channel_type !==
                        "voice" &&
                    (
                        name.includes(
                            "general"
                        ) ||
                        name.includes(
                            "discussion"
                        ) ||
                        slug.includes(
                            "general"
                        ) ||
                        slug.includes(
                            "discussion"
                        )
                    )
                );
            });

        if (discussion) {
            return discussion;
        }

        return (
            channels.find(
                channel =>
                    channel.channel_type !==
                    "voice" &&
                    !channel.is_private
            ) ||
            channels[0]
        );
    }

    function renderChannels() {
        const container =
            dom.channelList;

        if (!container) return;

        const term =
            String(
                state.channelSearch ||
                ""
            )
                .trim()
                .toLowerCase();

        container.innerHTML = "";

        const visible =
            state.channels.filter(
                channel => {
                    if (!term) {
                        return true;
                    }

                    return (
                        String(
                            channel.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(term) ||
                        String(
                            channel.description ||
                            ""
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        const groups = new Map();

        visible.forEach(channel => {
            let group = "DISCUSSION";

            if (
                channel.course_id
            ) {
                group =
                    "COURSE DISCUSSIONS";
            } else if (
                channel.channel_type ===
                "announcement"
            ) {
                group =
                    "INFORMATION";
            } else if (
                channel.channel_type ===
                "study"
            ) {
                group =
                    "STUDY";
            }

            if (!groups.has(group)) {
                groups.set(
                    group,
                    []
                );
            }

            groups
                .get(group)
                .push(channel);
        });

        groups.forEach(
            (channels, groupName) => {
                const heading =
                    document.createElement(
                        "div"
                    );

                heading.className =
                    "channel-group-title";

                heading.textContent =
                    groupName;

                container.appendChild(
                    heading
                );

                channels.forEach(
                    channel => {
                        const button =
                            document.createElement(
                                "button"
                            );

                        button.type =
                            "button";

                        button.className =
                            "channel-item";

                        if (
                            state.currentChannel &&
                            String(
                                state.currentChannel.id
                            ) ===
                            String(
                                channel.id
                            )
                        ) {
                            button.classList.add(
                                "active"
                            );
                        }

                        button.innerHTML = `
                            <span
                                class="channel-icon"
                            >
                                ${escapeHTML(
                                    channel.icon ||
                                    "#"
                                )}
                            </span>

                            <span
                                class="channel-name"
                            >
                                ${escapeHTML(
                                    channel.name ||
                                    "channel"
                                )}
                            </span>
                        `;

                        button.addEventListener(
                            "click",
                            () =>
                                selectChannel(
                                    channel.id
                                )
                        );

                        container.appendChild(
                            button
                        );
                    }
                );
            }
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

        if (!channel) return;

        cleanupMessageRealtime();

        state.currentChannel =
            channel;

        localStorage.setItem(
            "mwanikiCommunityChannelId",
            String(channel.id)
        );

        if (dom.activeChannelName) {
            dom.activeChannelName.textContent =
                channel.name || "";
        }

        if (dom.mainChannelTitle) {
            dom.mainChannelTitle.textContent =
                channel.name || "";
        }

        if (
            dom.activeChannelDescription
        ) {
            dom.activeChannelDescription
                .textContent =
                channel.description ||
                "";
        }

        if (
            dom.mainChannelDescription
        ) {
            dom.mainChannelDescription
                .textContent =
                channel.description ||
                "";
        }

        if (dom.messageInput) {
            dom.messageInput.placeholder =
                `Message #${
                    channel.name ||
                    "channel"
                }`;
        }

        renderChannels();

        await loadMessages(
            channel.id
        );

        await subscribeMessages(
            channel.id
        );

        await markChannelRead(
            channel.id
        );

        focusComposer();
    }


    /* =========================================================
       MEMBERS
       ========================================================= */

    async function loadMembers(
        communityId
    ) {
        const {
            data,
            error
        } = await db
            .from(
                "chat_community_members"
            )
            .select(`
                id,
                community_id,
                user_id,
                role,
                nickname,
                display_name,
                is_muted,
                is_banned,
                joined_at,
                last_seen_at,
                membership_status,
                badge,
                last_active_at,
                status
            `)
            .eq(
                "community_id",
                communityId
            )
            .neq(
                "is_banned",
                true
            );

        if (error) {
            console.error(
                "Member loading failed:",
                error
            );

            state.members = [];

            renderMembers();

            return;
        }

        state.members =
            await enrichMembers(
                data || []
            );

        renderMembers();
    }

    async function enrichMembers(
        members
    ) {
        const ids = [
            ...new Set(
                members
                    .map(
                        member =>
                            member.user_id
                    )
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return members;
        }

        const {
            data: students,
            error
        } = await db
            .from("students")
            .select(
                "id, full_name, photo_url, email"
            )
            .in(
                "id",
                ids
            );

        const profileMap =
            new Map();

        if (!error) {
            (
                students || []
            ).forEach(student => {
                profileMap.set(
                    String(
                        student.id
                    ),
                    student
                );
            });
        }

        return members.map(
            member => ({
                ...member,
                profile:
                    profileMap.get(
                        String(
                            member.user_id
                        )
                    ) || null
            })
        );
    }

    function renderMembers() {
        const container =
            dom.memberList;

        if (!container) {
            return;
        }

        const term =
            String(
                state.memberSearch ||
                ""
            )
                .trim()
                .toLowerCase();

        const filtered =
            state.members.filter(
                member => {
                    const name =
                        profileName(
                            member.profile
                        );

                    const display =
                        member.display_name ||
                        member.nickname ||
                        name;

                    if (!term) {
                        return true;
                    }

                    return (
                        String(
                            display
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        if (dom.memberCount) {
            dom.memberCount.textContent =
                state.members.length;
        }

        container.innerHTML = "";

        filtered
            .sort(
                (a, b) =>
                    presenceRank(
                        getMemberPresence(a)
                    ) -
                    presenceRank(
                        getMemberPresence(b)
                    )
            )
            .forEach(member => {
                const name =
                    member.display_name ||
                    member.nickname ||
                    profileName(
                        member.profile
                    );

                const photo =
                    profilePhoto(
                        member.profile
                    );

                const status =
                    getMemberPresence(
                        member
                    );

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "member-item";

                row.dataset.userId =
                    member.user_id;

                row.innerHTML = `
                    <div class="member-avatar-wrap">
                        <img
                            class="member-avatar"
                            src="${escapeAttribute(
                                photo
                            )}"
                            alt="${escapeAttribute(
                                name
                            )}"
                        >

                        <span
                            class="presence-dot ${escapeAttribute(
                                status
                            )}"
                            aria-hidden="true"
                        ></span>
                    </div>

                    <div class="member-info">
                        <div
                            class="member-name"
                        >
                            ${escapeHTML(
                                name
                            )}
                        </div>

                        <div
                            class="member-status-line"
                        >
                            <span
                                class="member-status-text"
                            >
                                ${escapeHTML(
                                    presenceLabel(
                                        status
                                    )
                                )}
                            </span>
                        </div>

                        ${
                            member.badge
                                ? `
                                    <div
                                        class="member-badge"
                                    >
                                        ${escapeHTML(
                                            member.badge
                                        )}
                                    </div>
                                `
                                : ""
                        }
                    </div>

                    <div
                        class="member-actions"
                    >
                        <button
                            type="button"
                            class="member-dm-button"
                            data-user-id="${escapeAttribute(
                                member.user_id
                            )}"
                            title="Personal message"
                        >
                            💬
                        </button>

                        <button
                            type="button"
                            class="member-call-button"
                            data-user-id="${escapeAttribute(
                                member.user_id
                            )}"
                            title="Call"
                        >
                            📞
                        </button>
                    </div>
                `;

                const avatar =
                    row.querySelector(
                        ".member-avatar"
                    );

                if (avatar) {
                    avatar.onerror =
                        () => {
                            avatar.onerror =
                                null;

                            avatar.src =
                                avatarFallback(
                                    name
                                );
                        };
                }

                const dmButton =
                    row.querySelector(
                        ".member-dm-button"
                    );

                dmButton?.addEventListener(
                    "click",
                    event => {
                        event.stopPropagation();

                        openDirectMessage(
                            member
                        );
                    }
                );

                const callButton =
                    row.querySelector(
                        ".member-call-button"
                    );

                callButton?.addEventListener(
                    "click",
                    event => {
                        event.stopPropagation();

                        callMember(
                            member.user_id,
                            name
                        );
                    }
                );

                container.appendChild(
                    row
                );
            });
    }

    function presenceRank(status) {
        return {
            online: 0,
            dnd: 1,
            away: 2,
            offline: 3
        }[status] ?? 4;
    }

    function getMemberPresence(
        member
    ) {
        return calculatePresence(
            member.presence,
            member.last_seen_at ||
                member.last_active_at
        );
    }

    async function refreshMemberPresence() {
        if (
            !state.members.length
        ) {
            return;
        }

        const ids =
            state.members
                .map(
                    member =>
                        member.user_id
                )
                .filter(Boolean);

        if (!ids.length) {
            return;
        }

        const {
            data,
            error
        } = await db
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
                "Presence refresh failed:",
                error
            );

            return;
        }

        const presenceMap =
            new Map();

        (
            data || []
        ).forEach(row => {
            presenceMap.set(
                String(
                    row.user_id
                ),
                row
            );
        });

        state.members =
            state.members.map(
                member => {
                    const presence =
                        presenceMap.get(
                            String(
                                member.user_id
                            )
                        );

                    return {
                        ...member,
                        presence:
                            presence ||
                            null
                    };
                }
            );

        renderMembers();
    }

    async function subscribePresence() {
        if (
            state.presenceSubscription
        ) {
            try {
                await db.removeChannel(
                    state.presenceSubscription
                );
            } catch (_) {}
        }

        state.presenceSubscription =
            db
                .channel(
                    "mwaniki-community-presence"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_presence"
                    },
                    () => {
                        refreshMemberPresence();
                    }
                )
                .subscribe(
                    status => {
                        console.log(
                            "Community presence realtime:",
                            status
                        );
                    }
                );
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages(
        channelId
    ) {
        if (!channelId) {
            state.messages = [];

            renderMessages();

            return;
        }

        const {
            data,
            error
        } = await db
            .from("chat_messages")
            .select(`
                id,
                channel_id,
                user_id,
                parent_message_id,
                reply_to_user_id,
                content,
                message_type,
                is_edited,
                is_deleted,
                is_pinned,
                edited_at,
                deleted_at,
                deleted_by,
                created_at,
                updated_at
            `)
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
                state.messageLimit
            );

        if (error) {
            console.error(
                "Message loading failed:",
                error
            );

            state.messages = [];

            renderMessages();

            return;
        }

        state.messages =
            await enrichMessages(
                data || []
            );

        await loadMessageReactions();

        renderMessages();

        scrollMessagesToBottom();
    }

    async function enrichMessages(
        messages
    ) {
        const ids = [
            ...new Set(
                messages
                    .map(
                        message =>
                            message.user_id
                    )
                    .filter(Boolean)
            )
        ];

        const profileMap =
            new Map();

        if (
            state.profile &&
            state.user?.id
        ) {
            profileMap.set(
                String(
                    state.user.id
                ),
                state.profile
            );
        }

        const missing =
            ids.filter(
                id =>
                    !profileMap.has(
                        String(id)
                    )
            );

        if (missing.length) {
            const {
                data,
                error
            } = await db
                .from("students")
                .select(
                    "id,full_name,photo_url,email"
                )
                .in(
                    "id",
                    missing
                );

            if (!error) {
                (
                    data || []
                ).forEach(profile => {
                    profileMap.set(
                        String(
                            profile.id
                        ),
                        profile
                    );
                });
            }
        }

        return messages.map(
            message => ({
                ...message,
                profile:
                    profileMap.get(
                        String(
                            message.user_id
                        )
                    ) || null
            })
        );
    }

    function renderMessages() {
        const container =
            dom.messageList;

        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (
            !state.currentChannel
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    Select a discussion channel.
                </div>
            `;

            return;
        }

        if (!state.messages.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <strong>
                        Welcome to #${escapeHTML(
                            state.currentChannel.name ||
                            "discussion"
                        )}
                    </strong>
                    <p>
                        Start the discussion.
                    </p>
                </div>
            `;

            return;
        }

        state.messages.forEach(
            message => {
                container.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );
    }

    function createMessageElement(
        message
    ) {
        const article =
            document.createElement(
                "article"
            );

        article.className =
            "message-item";

        article.dataset.messageId =
            message.id;

        const name =
            profileName(
                message.profile
            );

        const photo =
            profilePhoto(
                message.profile
            );

        const mine =
            String(
                message.user_id
            ) ===
            String(
                state.user?.id
            );

        const deleted =
            Boolean(
                message.is_deleted
            );

        const time =
            formatMessageTime(
                message.created_at
            );

        const reply =
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

        const replyName =
            reply
                ? profileName(
                      reply.profile
                  )
                : "";

        const replyText =
            reply
                ? String(
                      reply.content ||
                      ""
                  ).slice(
                      0,
                      100
                  )
                : "";

        const reactions =
            message.reactions || [];

        const grouped =
            groupReactions(
                reactions
            );

        article.innerHTML = `
            <div class="message-avatar-wrap">
                <img
                    class="message-avatar"
                    src="${escapeAttribute(
                        photo
                    )}"
                    alt="${escapeAttribute(
                        name
                    )}"
                >
            </div>

            <div class="message-content-wrap">

                <div class="message-topline">

                    <strong
                        class="message-author"
                    >
                        ${escapeHTML(
                            name
                        )}
                    </strong>

                    <span
                        class="message-time"
                    >
                        ${escapeHTML(
                            time
                        )}
                    </span>

                    ${
                        message.is_edited
                            ? `
                                <span
                                    class="message-edited"
                                >
                                    edited
                                </span>
                            `
                            : ""
                    }

                </div>

                ${
                    reply
                        ? `
                            <button
                                type="button"
                                class="message-reply-preview"
                                data-jump-message="${escapeAttribute(
                                    reply.id
                                )}"
                            >
                                <strong>
                                    Replying to
                                    ${escapeHTML(
                                        replyName
                                    )}
                                </strong>
                                <span>
                                    ${escapeHTML(
                                        replyText
                                    )}
                                </span>
                            </button>
                        `
                        : ""
                }

                <div
                    class="message-body ${
                        deleted
                            ? "message-deleted"
                            : ""
                    }"
                >
                    ${
                        deleted
                            ? "This message was deleted."
                            : formatMessageContent(
                                  message.content
                              )
                    }
                </div>

                ${
                    grouped.length
                        ? `
                            <div
                                class="message-reactions"
                            >
                                ${grouped
                                    .map(
                                        reaction => `
                                            <button
                                                type="button"
                                                class="message-reaction ${
                                                    reaction.mine
                                                        ? "active"
                                                        : ""
                                                }"
                                                data-reaction-message="${escapeAttribute(
                                                    message.id
                                                )}"
                                                data-reaction="${escapeAttribute(
                                                    reaction.emoji
                                                )}"
                                            >
                                                ${escapeHTML(
                                                    reaction.emoji
                                                )}
                                                <span>
                                                    ${reaction.count}
                                                </span>
                                            </button>
                                        `
                                    )
                                    .join("")}
                            </div>
                        `
                        : ""
                }

                ${
                    !deleted
                        ? `
                            <div
                                class="message-actions"
                            >

                                <button
                                    type="button"
                                    data-message-action="reply"
                                    data-message-id="${escapeAttribute(
                                        message.id
                                    )}"
                                    title="Reply"
                                >
                                    ↩
                                </button>

                                <button
                                    type="button"
                                    data-message-action="react"
                                    data-message-id="${escapeAttribute(
                                        message.id
                                    )}"
                                    title="React"
                                >
                                    😊
                                </button>

                                ${
                                    mine
                                        ? `
                                            <button
                                                type="button"
                                                class="delete-message"
                                                data-message-action="delete"
                                                data-message-id="${escapeAttribute(
                                                    message.id
                                                )}"
                                                title="Delete"
                                            >
                                                🗑
                                            </button>
                                        `
                                        : ""
                                }

                            </div>
                        `
                        : ""
                }

            </div>
        `;

        const avatar =
            article.querySelector(
                ".message-avatar"
            );

        if (avatar) {
            avatar.onerror =
                () => {
                    avatar.onerror =
                        null;

                    avatar.src =
                        avatarFallback(
                            name
                        );
                };
        }

        return article;
    }

    function formatMessageContent(
        content
    ) {
        return escapeHTML(
            content || ""
        )
            .replace(
                /\n/g,
                "<br>"
            )
            .replace(
                /(^|\s)@([A-Za-z0-9._-]+)/g,
                '$1<span class="mention">@$2</span>'
            );
    }

    function formatMessageTime(
        timestamp
    ) {
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

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function scrollMessagesToBottom() {
        const list =
            dom.messageList;

        if (!list) return;

        requestAnimationFrame(
            () => {
                list.scrollTop =
                    list.scrollHeight;
            }
        );
    }


    /* =========================================================
       REPLIES
       ========================================================= */

    function startReply(
        message
    ) {
        if (!message) return;

        state.currentReply =
            message;

        renderReplyBar();

        if (dom.messageInput) {
            dom.messageInput.focus();
        }

        scrollComposerIntoView();
    }

    function cancelReply() {
        state.currentReply =
            null;

        renderReplyBar();
    }

    function renderReplyBar() {
        let bar =
            document.getElementById(
                "mwanikiReplyBar"
            );

        if (
            !state.currentReply
        ) {
            bar?.remove();

            return;
        }

        if (!bar) {
            bar =
                document.createElement(
                    "div"
                );

            bar.id =
                "mwanikiReplyBar";

            bar.className =
                "reply-bar";

            const composer =
                document.querySelector(
                    "#messageComposer, .message-composer"
                );

            if (composer) {
                composer.prepend(
                    bar
                );
            } else if (
                dom.messageInput
            ) {
                dom.messageInput
                    .parentElement
                    ?.prepend(bar);
            }
        }

        const name =
            profileName(
                state.currentReply.profile
            );

        bar.innerHTML = `
            <div class="reply-bar-content">
                <strong>
                    Replying to
                    ${escapeHTML(
                        name
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        String(
                            state.currentReply.content ||
                            ""
                        ).slice(
                            0,
                            120
                        )
                    )}
                </span>
            </div>

            <button
                type="button"
                id="cancelReplyButton"
                title="Cancel reply"
            >
                ✕
            </button>
        `;

        bar.querySelector(
            "#cancelReplyButton"
        )?.addEventListener(
            "click",
            cancelReply
        );
    }


    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage(
        event
    ) {
        event?.preventDefault();

        if (
            state.sendingMessage
        ) {
            return;
        }

        if (
            !state.user?.id
        ) {
            showToast(
                "You must be signed in."
            );

            return;
        }

        if (
            !state.currentChannel?.id
        ) {
            showToast(
                "Select a channel first."
            );

            return;
        }

        const content =
            String(
                dom.messageInput?.value ||
                ""
            ).trim();

        if (!content) {
            return;
        }

        state.sendingMessage =
            true;

        if (
            dom.sendMessageButton
        ) {
            dom.sendMessageButton.disabled =
                true;
        }

        const payload = {
            channel_id:
                state.currentChannel.id,

            user_id:
                state.user.id,

            content,

            message_type:
                "text"
        };

        if (
            state.currentReply?.id
        ) {
            payload.parent_message_id =
                state.currentReply.id;

            payload.reply_to_user_id =
                state.currentReply.user_id;
        }

        try {
            const {
                data,
                error
            } = await db
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

            if (dom.messageInput) {
                dom.messageInput.value =
                    "";

                autoResizeInput();
            }

            state.currentReply =
                null;

            renderReplyBar();

            /*
             * Realtime normally adds the message.
             * Add immediately if realtime has
             * not arrived yet.
             */
            if (
                data &&
                !state.messages.some(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            data.id
                        )
                )
            ) {
                const enriched =
                    await enrichMessages(
                        [data]
                    );

                state.messages.push(
                    enriched[0]
                );

                renderMessages();

                scrollMessagesToBottom();
            }

            recordPresenceActivity();
        } catch (error) {
            console.error(
                "Message send failed:",
                error
            );

            showToast(
                "Message could not be sent."
            );
        } finally {
            state.sendingMessage =
                false;

            if (
                dom.sendMessageButton
            ) {
                dom.sendMessageButton.disabled =
                    false;
            }
        }
    }


    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(
        message
    ) {
        if (
            !message ||
            !state.user?.id
        ) {
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
            showToast(
                "You can only delete your own messages."
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

        const now =
            new Date().toISOString();

        try {
            const {
                error
            } = await db
                .from(
                    "chat_messages"
                )
                .update({
                    is_deleted:
                        true,
                    deleted_at:
                        now,
                    deleted_by:
                        state.user.id,
                    content:
                        "[deleted]"
                })
                .eq(
                    "id",
                    message.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

            if (error) {
                throw error;
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

                local.deleted_by =
                    state.user.id;

                local.content =
                    "[deleted]";
            }

            renderMessages();

            showToast(
                "Message deleted."
            );
        } catch (error) {
            console.error(
                "Delete message failed:",
                error
            );

            showToast(
                "Message could not be deleted."
            );
        }
    }


    /* =========================================================
       REACTIONS
       ========================================================= */

    const REACTION_EMOJIS = [
        "👍",
        "❤️",
        "😂",
        "😮",
        "😢",
        "🔥",
        "👏",
        "🎉"
    ];

    let reactionColumnCache =
        null;

    async function detectReactionColumns() {
        if (
            reactionColumnCache
        ) {
            return reactionColumnCache;
        }

        /*
         * The project schema has chat_message_reactions,
         * but versions of the table may use reaction,
         * emoji, or reaction_type for the emoji field.
         */
        const {
            data,
            error
        } = await db
            .from(
                "chat_message_reactions"
            )
            .select("*")
            .limit(1);

        if (
            !error &&
            data?.length
        ) {
            const row =
                data[0];

            const keys =
                Object.keys(row);

            const emojiKey =
                [
                    "emoji",
                    "reaction",
                    "reaction_type",
                    "type"
                ].find(
                    key =>
                        keys.includes(
                            key
                        )
                );

            const messageKey =
                [
                    "message_id",
                    "chat_message_id"
                ].find(
                    key =>
                        keys.includes(
                            key
                        )
                );

            const userKey =
                [
                    "user_id",
                    "profile_id"
                ].find(
                    key =>
                        keys.includes(
                            key
                        )
                );

            if (
                emojiKey &&
                messageKey &&
                userKey
            ) {
                reactionColumnCache = {
                    emojiKey,
                    messageKey,
                    userKey
                };

                return reactionColumnCache;
            }
        }

        /*
         * Current Mwaniki schema is expected
         * to use these conventional fields.
         */
        reactionColumnCache = {
            emojiKey: "emoji",
            messageKey: "message_id",
            userKey: "user_id"
        };

        return reactionColumnCache;
    }

    async function loadMessageReactions() {
        if (
            !state.messages.length
        ) {
            return;
        }

        const ids =
            state.messages.map(
                message =>
                    message.id
            );

        try {
            const {
                data,
                error
            } = await db
                .from(
                    "chat_message_reactions"
                )
                .select("*")
                .in(
                    "message_id",
                    ids
                );

            if (error) {
                /*
                 * Do not break chat if reactions
                 * are restricted by RLS.
                 */
                console.warn(
                    "Reaction loading unavailable:",
                    error.message
                );

                return;
            }

            const rows =
                data || [];

            state.messages.forEach(
                message => {
                    message.reactions =
                        rows.filter(
                            row =>
                                String(
                                    row.message_id
                                ) ===
                                String(
                                    message.id
                                )
                        );
                }
            );
        } catch (error) {
            console.warn(
                "Reaction loading failed:",
                error
            );
        }
    }

    function groupReactions(
        reactions
    ) {
        const groups =
            new Map();

        (
            reactions || []
        ).forEach(row => {
            const emoji =
                row.emoji ||
                row.reaction ||
                row.reaction_type ||
                row.type ||
                "👍";

            if (!groups.has(emoji)) {
                groups.set(
                    emoji,
                    {
                        emoji,
                        count: 0,
                        mine: false
                    }
                );
            }

            const group =
                groups.get(
                    emoji
                );

            group.count++;

            if (
                String(
                    row.user_id
                ) ===
                String(
                    state.user?.id
                )
            ) {
                group.mine = true;
            }
        });

        return Array.from(
            groups.values()
        );
    }

    async function toggleReaction(
        messageId,
        emoji
    ) {
        if (
            !state.user?.id
        ) {
            return;
        }

        try {
            const columns =
                await detectReactionColumns();

            const {
                data: existing,
                error:
                    existingError
            } = await db
                .from(
                    "chat_message_reactions"
                )
                .select("*")
                .eq(
                    columns.messageKey,
                    messageId
                )
                .eq(
                    columns.userKey,
                    state.user.id
                );

            if (existingError) {
                throw existingError;
            }

            const found =
                (
                    existing || []
                ).find(row => {
                    const value =
                        row[
                            columns.emojiKey
                        ];

                    return (
                        String(
                            value
                        ) ===
                        String(
                            emoji
                        )
                    );
                });

            if (found) {
                const {
                    error
                } = await db
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        found.id
                    );

                if (error) {
                    throw error;
                }
            } else {
                const payload = {};

                payload[
                    columns.messageKey
                ] = messageId;

                payload[
                    columns.userKey
                ] = state.user.id;

                payload[
                    columns.emojiKey
                ] = emoji;

                const {
                    error
                } = await db
                    .from(
                        "chat_message_reactions"
                    )
                    .insert(
                        payload
                    );

                if (error) {
                    throw error;
                }
            }

            await loadMessages(
                state.currentChannel.id
            );
        } catch (error) {
            console.error(
                "Reaction failed:",
                error
            );

            showToast(
                "Reaction could not be updated."
            );
        }
    }

    function openReactionPicker(
        messageId
    ) {
        let picker =
            document.getElementById(
                "mwanikiReactionPicker"
            );

        if (picker) {
            picker.remove();
            return;
        }

        picker =
            document.createElement(
                "div"
            );

        picker.id =
            "mwanikiReactionPicker";

        picker.className =
            "reaction-picker";

        picker.innerHTML =
            REACTION_EMOJIS.map(
                emoji => `
                    <button
                        type="button"
                        data-reaction-picker-emoji="${escapeAttribute(
                            emoji
                        )}"
                    >
                        ${emoji}
                    </button>
                `
            ).join("");

        document.body.appendChild(
            picker
        );

        const buttons =
            document.querySelectorAll(
                "[data-reaction-picker-emoji]"
            );

        buttons.forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const emoji =
                        button.dataset
                            .reactionPickerEmoji;

                    picker.remove();

                    await toggleReaction(
                        messageId,
                        emoji
                    );
                }
            );
        });
    }


    /* =========================================================
       MESSAGE REALTIME
       ========================================================= */

    async function subscribeMessages(
        channelId
    ) {
        cleanupMessageRealtime();

        if (!channelId) {
            return;
        }

        state.messageSubscription =
            db
                .channel(
                    `mwaniki-messages-${channelId}`
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
                    async payload => {
                        const incoming =
                            payload.new;

                        if (
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        incoming.id
                                    )
                            )
                        ) {
                            return;
                        }

                        const enriched =
                            await enrichMessages(
                                [incoming]
                            );

                        state.messages.push(
                            enriched[0]
                        );

                        await loadMessageReactions();

                        renderMessages();

                        scrollMessagesToBottom();
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

                        const enriched =
                            await enrichMessages(
                                [payload.new]
                            );

                        if (
                            index >= 0
                        ) {
                            state.messages[
                                index
                            ] =
                                enriched[0];
                        } else {
                            state.messages.push(
                                enriched[0]
                            );
                        }

                        renderMessages();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_message_reactions"
                    },
                    async payload => {
                        await loadMessageReactions();

                        renderMessages();
                    }
                )
                .subscribe(
                    status => {
                        console.log(
                            "Community realtime:",
                            status
                        );
                    }
                );
    }

    function cleanupMessageRealtime() {
        if (
            state.messageSubscription
        ) {
            try {
                db.removeChannel(
                    state.messageSubscription
                );
            } catch (_) {}

            state.messageSubscription =
                null;
        }
    }

    function cleanupRealtime() {
        cleanupMessageRealtime();

        if (
            state.presenceSubscription
        ) {
            try {
                db.removeChannel(
                    state.presenceSubscription
                );
            } catch (_) {}

            state.presenceSubscription =
                null;
        }

        state.realtimeChannels
            .forEach(channel => {
                try {
                    db.removeChannel(
                        channel
                    );
                } catch (_) {}
            });

        state.realtimeChannels =
            [];
    }


    /* =========================================================
       MESSAGE READ STATUS
       ========================================================= */

    async function markChannelRead(
        channelId
    ) {
        if (
            !channelId ||
            !state.user?.id
        ) {
            return;
        }

        try {
            await db
                .from(
                    "chat_read_status"
                )
                .upsert(
                    {
                        user_id:
                            state.user.id,
                        channel_id:
                            channelId,
                        last_read_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "user_id,channel_id"
                    }
                );
        } catch (error) {
            /*
             * Read receipts should never
             * break the chat.
             */
            console.debug(
                "Read status unavailable:",
                error
            );
        }
    }


    /* =========================================================
       MESSAGE EVENTS
       ========================================================= */

    function bindMessageEvents() {
        if (dom.messageForm) {
            dom.messageForm.addEventListener(
                "submit",
                sendMessage
            );
        }

        if (
            dom.sendMessageButton &&
            !dom.messageForm
        ) {
            dom.sendMessageButton.addEventListener(
                "click",
                sendMessage
            );
        }

        if (dom.messageInput) {
            dom.messageInput.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key ===
                            "Enter" &&
                        !event.shiftKey
                    ) {
                        event.preventDefault();

                        sendMessage(event);
                    }
                }
            );

            dom.messageInput.addEventListener(
                "input",
                autoResizeInput
            );

            dom.messageInput.addEventListener(
                "focus",
                scrollComposerIntoView
            );
        }

        if (
            dom.channelSearchInput
        ) {
            dom.channelSearchInput.addEventListener(
                "input",
                event => {
                    state.channelSearch =
                        event.target.value;

                    renderChannels();
                }
            );
        }

        if (
            dom.memberSearchInput
        ) {
            dom.memberSearchInput.addEventListener(
                "input",
                event => {
                    state.memberSearch =
                        event.target.value;

                    renderMembers();
                }
            );
        }

        if (
            dom.emojiButton
        ) {
            dom.emojiButton.addEventListener(
                "click",
                toggleEmojiPanel
            );
        }

        if (
            dom.closeEmojiButton
        ) {
            dom.closeEmojiButton.addEventListener(
                "click",
                closeAllPickers
            );
        }

        if (
            dom.stickerButton
        ) {
            dom.stickerButton.addEventListener(
                "click",
                toggleStickerPanel
            );
        }

        if (
            dom.closeStickerButton
        ) {
            dom.closeStickerButton.addEventListener(
                "click",
                closeAllPickers
            );
        }

        if (
            dom.gifButton
        ) {
            dom.gifButton.addEventListener(
                "click",
                toggleGifPanel
            );
        }

        if (
            dom.closeGifButton
        ) {
            dom.closeGifButton.addEventListener(
                "click",
                closeAllPickers
            );
        }

        if (
            dom.attachmentButton
        ) {
            dom.attachmentButton.addEventListener(
                "click",
                openAttachmentPicker
            );
        }

        if (
            dom.voiceNoteButton
        ) {
            dom.voiceNoteButton.addEventListener(
                "click",
                toggleVoiceRecording
            );
        }

        if (
            dom.messageList
        ) {
            dom.messageList.addEventListener(
                "click",
                handleMessageListClick
            );
        }
    }

    function handleMessageListClick(
        event
    ) {
        const actionButton =
            event.target.closest(
                "[data-message-action]"
            );

        if (actionButton) {
            const action =
                actionButton.dataset
                    .messageAction;

            const messageId =
                actionButton.dataset
                    .messageId;

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

            if (
                action ===
                "reply"
            ) {
                startReply(message);
                return;
            }

            if (
                action ===
                "delete"
            ) {
                deleteMessage(message);
                return;
            }

            if (
                action ===
                "react"
            ) {
                openReactionPicker(
                    message.id
                );

                return;
            }
        }

        const reactionButton =
            event.target.closest(
                "[data-reaction-message]"
            );

        if (reactionButton) {
            toggleReaction(
                reactionButton.dataset
                    .reactionMessage,
                reactionButton.dataset
                    .reaction
            );

            return;
        }

        const replyPreview =
            event.target.closest(
                "[data-jump-message]"
            );

        if (replyPreview) {
            const target =
                document.querySelector(
                    `[data-message-id="${CSS.escape(
                        replyPreview.dataset
                            .jumpMessage
                    )}"]`
                );

            target?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }


    /* =========================================================
       EMOJI
       ========================================================= */

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅",
        "😂","🤣","😊","🙂","🙃","😉",
        "😍","🥰","😘","😎","🤩","🥳",
        "😏","😔","😢","😭","😤","😠",
        "😡","🤬","🤯","😳","🥺","🤔",
        "🤗","🤫","😶","😐","😑","🙄",
        "😴","🤒","🤕","🤢","🤮","🤧",
        "❤️","🧡","💛","💚","💙","💜",
        "🖤","🤍","🤎","💔","💕","💖",
        "✨","⭐","🌟","🔥","👍","👎",
        "👌","✌️","🤞","👏","🙌","🙏",
        "💪","👀","👋","🤝","💯","🎉",
        "🎊","🧠","🫀","🫁","🩸","🦠",
        "🧬","🔬","🧪","💊","💉","🩺",
        "📚","📖","📝","🎓","🏥"
    ];

    function createEmojiPanel() {
        if (!dom.emojiPanel) {
            return;
        }

        let grid =
            dom.emojiGrid;

        if (!grid) {
            grid =
                dom.emojiPanel.querySelector(
                    ".emoji-grid"
                );
        }

        if (!grid) {
            return;
        }

        grid.innerHTML = "";

        EMOJIS.forEach(
            emoji => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.textContent =
                    emoji;

                button.title =
                    `Insert ${emoji}`;

                button.addEventListener(
                    "click",
                    () => {
                        insertEmoji(
                            emoji
                        );
                    }
                );

                grid.appendChild(
                    button
                );
            }
        );
    }

    function insertEmoji(
        emoji
    ) {
        if (
            !dom.messageInput
        ) {
            return;
        }

        const input =
            dom.messageInput;

        const start =
            input.selectionStart ??
            input.value.length;

        const end =
            input.selectionEnd ??
            input.value.length;

        input.value =
            input.value.slice(
                0,
                start
            ) +
            emoji +
            input.value.slice(
                end
            );

        const position =
            start +
            emoji.length;

        input.focus();

        input.setSelectionRange(
            position,
            position
        );

        autoResizeInput();
    }

    function toggleEmojiPanel() {
        closeOtherPickers(
            "emoji"
        );

        if (!dom.emojiPanel) {
            return;
        }

        state.emojiOpen =
            !state.emojiOpen;

        if (state.emojiOpen) {
            openElement(
                dom.emojiPanel
            );
        } else {
            closeElement(
                dom.emojiPanel
            );
        }
    }

    function toggleStickerPanel() {
        closeOtherPickers(
            "sticker"
        );

        if (!dom.stickerPanel) {
            return;
        }

        state.stickerOpen =
            !state.stickerOpen;

        if (state.stickerOpen) {
            openElement(
                dom.stickerPanel
            );
        } else {
            closeElement(
                dom.stickerPanel
            );
        }
    }

    function toggleGifPanel() {
        closeOtherPickers(
            "gif"
        );

        if (!dom.gifPanel) {
            return;
        }

        state.gifOpen =
            !state.gifOpen;

        if (state.gifOpen) {
            openElement(
                dom.gifPanel
            );
        } else {
            closeElement(
                dom.gifPanel
            );
        }
    }

    function closeOtherPickers(
        except
    ) {
        if (
            except !== "emoji"
        ) {
            state.emojiOpen =
                false;

            closeElement(
                dom.emojiPanel
            );
        }

        if (
            except !== "sticker"
        ) {
            state.stickerOpen =
                false;

            closeElement(
                dom.stickerPanel
            );
        }

        if (
            except !== "gif"
        ) {
            state.gifOpen =
                false;

            closeElement(
                dom.gifPanel
            );
        }
    }

    function closeAllPickers() {
        closeOtherPickers("");
    }


    /* =========================================================
       ATTACHMENTS
       ========================================================= */

    function openAttachmentPicker() {
        let input =
            document.getElementById(
                "mwanikiAttachmentInput"
            );

        if (!input) {
            input =
                document.createElement(
                    "input"
                );

            input.type =
                "file";

            input.id =
                "mwanikiAttachmentInput";

            input.accept =
                "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";

            input.hidden =
                true;

            document.body.appendChild(
                input
            );

            input.addEventListener(
                "change",
                handleAttachment
            );
        }

        input.click();
    }

    function handleAttachment(
        event
    ) {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        state.attachmentFile =
            file;

        if (
            dom.attachmentPreview
        ) {
            dom.attachmentPreview.classList.remove(
                "hidden"
            );

            dom.attachmentPreview.innerHTML = `
                <div class="attachment-preview-item">
                    <span>
                        📎
                        ${escapeHTML(
                            file.name
                        )}
                    </span>

                    <button
                        type="button"
                        id="removeAttachmentButton"
                    >
                        ✕
                    </button>
                </div>
            `;

            dom.attachmentPreview
                .querySelector(
                    "#removeAttachmentButton"
                )
                ?.addEventListener(
                    "click",
                    clearAttachment
                );
        }

        showToast(
            `${file.name} attached.`
        );
    }

    function clearAttachment() {
        state.attachmentFile =
            null;

        if (
            dom.attachmentPreview
        ) {
            dom.attachmentPreview.innerHTML =
                "";

            dom.attachmentPreview.classList.add(
                "hidden"
            );
        }

        const input =
            document.getElementById(
                "mwanikiAttachmentInput"
            );

        if (input) {
            input.value = "";
        }
    }


    /* =========================================================
       VOICE NOTES
       ========================================================= */

    async function toggleVoiceRecording() {
        if (
            state.voiceRecorder &&
            state.voiceRecorder.state ===
                "recording"
        ) {
            stopVoiceRecording();
            return;
        }

        try {
            const stream =
                await navigator.mediaDevices
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

            recorder.ondataavailable =
                event => {
                    if (
                        event.data &&
                        event.data.size
                    ) {
                        state.voiceChunks.push(
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

                    clearVoiceTimer();

                    state.voiceRecorder =
                        null;

                    /*
                     * Keep voice-note recording real.
                     * Upload/storage can use the existing
                     * chat attachment pipeline when configured.
                     */
                    await handleRecordedVoice(
                        blob
                    );
                };

            recorder.start();

            startVoiceTimer();

            if (
                dom.voiceNoteButton
            ) {
                dom.voiceNoteButton.classList.add(
                    "recording-active"
                );

                dom.voiceNoteButton.title =
                    "Stop recording";
            }

            showToast(
                "Recording voice note..."
            );
        } catch (error) {
            console.error(
                "Voice recording failed:",
                error
            );

            showToast(
                "Microphone permission is required."
            );
        }
    }

    function stopVoiceRecording() {
        if (
            state.voiceRecorder &&
            state.voiceRecorder.state ===
                "recording"
        ) {
            state.voiceRecorder.stop();
        }

        if (
            dom.voiceNoteButton
        ) {
            dom.voiceNoteButton.classList.remove(
                "recording-active"
            );

            dom.voiceNoteButton.title =
                "Record voice note";
        }
    }

    function startVoiceTimer() {
        clearVoiceTimer();

        state.voiceTimer =
            setInterval(
                () => {
                    const elapsed =
                        Math.floor(
                            (
                                Date.now() -
                                state.voiceStartedAt
                            ) /
                                1000
                        );

                    if (
                        dom.voiceNoteButton
                    ) {
                        dom.voiceNoteButton
                            .setAttribute(
                                "data-recording-seconds",
                                elapsed
                            );
                    }
                },
                1000
            );
    }

    function clearVoiceTimer() {
        if (
            state.voiceTimer
        ) {
            clearInterval(
                state.voiceTimer
            );

            state.voiceTimer =
                null;
        }
    }

    async function handleRecordedVoice(
        blob
    ) {
        if (!blob?.size) {
            return;
        }

        /*
         * The current chat attachment schema/bucket is kept
         * separate from the message engine. We don't invent
         * storage columns here.
         */
        showToast(
            "Voice note recorded."
        );

        /*
         * Make the recording available locally for playback.
         * It can then be connected to the configured
         * chat_attachments storage pipeline.
         */
        const url =
            URL.createObjectURL(
                blob
            );

        let preview =
            document.getElementById(
                "mwanikiVoicePreview"
            );

        if (!preview) {
            preview =
                document.createElement(
                    "div"
                );

            preview.id =
                "mwanikiVoicePreview";

            preview.className =
                "voice-note-preview";

            const composer =
                document.querySelector(
                    "#messageComposer, .message-composer"
                );

            composer?.prepend(
                preview
            );
        }

        preview.innerHTML = `
            <div class="voice-note-preview-inner">
                <audio
                    controls
                    src="${escapeAttribute(
                        url
                    )}"
                ></audio>

                <button
                    type="button"
                    id="discardVoicePreview"
                >
                    ✕
                </button>
            </div>
        `;

        preview.querySelector(
            "#discardVoicePreview"
        )?.addEventListener(
            "click",
            () => {
                URL.revokeObjectURL(
                    url
                );

                preview.remove();
            }
        );
    }


    /* =========================================================
       DIRECT MESSAGES / CALLS
       ========================================================= */

    function openDirectMessage(
        member
    ) {
        /*
         * Use the existing one-to-one handler when
         * another part of the community page provides it.
         */
        const name =
            member.display_name ||
            member.nickname ||
            profileName(
                member.profile
            );

        if (
            typeof window.openDirectMessage ===
            "function" &&
            window.openDirectMessage !==
                openDirectMessage
        ) {
            window.openDirectMessage(
                member
            );

            return;
        }

        showToast(
            `Personal chat with ${name} is ready to open.`
        );
    }

    function getCallEngine() {
        return (
            window.MwanikiCalls ||
            window.mwanikiCalls ||
            window.CommunityCalls ||
            window.communityCalls ||
            window.MwanikiCallEngine ||
            null
        );
    }

    async function callMember(
        userId,
        name
    ) {
        if (
            !userId ||
            String(userId) ===
                String(state.user?.id)
        ) {
            return;
        }

        const calls =
            getCallEngine();

        if (
            calls &&
            typeof calls.callUser ===
                "function"
        ) {
            try {
                await calls.callUser(
                    userId
                );

                return;
            } catch (error) {
                console.error(
                    "Call engine failed:",
                    error
                );
            }
        }

        showToast(
            `Unable to start a call with ${name}.`
        );
    }

    function communityCall() {
        const calls =
            getCallEngine();

        if (
            calls &&
            typeof calls.callCommunity ===
                "function"
        ) {
            calls.callCommunity(
                state.currentCommunity?.id
            );

            return;
        }

        if (
            calls &&
            typeof calls.startCommunityCall ===
                "function"
        ) {
            calls.startCommunityCall(
                state.currentCommunity?.id
            );

            return;
        }

        showToast(
            "Community call engine is not available."
        );
    }

    function generalCall() {
        openGeneralCallModal();
    }


    /* =========================================================
       GENERAL CALL PICKER
       ========================================================= */

    function openGeneralCallModal() {
        if (
            !dom.generalCallModal
        ) {
            /*
             * Fall back to the existing global
             * call engine if the modal isn't present.
             */
            const calls =
                getCallEngine();

            if (
                calls &&
                typeof calls.generalCall ===
                    "function"
            ) {
                calls.generalCall();

                return;
            }

            showToast(
                "General call interface is unavailable."
            );

            return;
        }

        state.selectedGeneralCallUsers =
            new Set();

        openElement(
            dom.generalCallModal
        );

        loadOnlineCallUsers();
    }

    function closeGeneralCallModal() {
        closeElement(
            dom.generalCallModal
        );

        state.selectedGeneralCallUsers =
            new Set();
    }

    async function loadOnlineCallUsers() {
        if (
            !dom.generalCallUserList
        ) {
            return;
        }

        dom.generalCallUserList.innerHTML = `
            <div class="call-user-loading">
                Loading online students...
            </div>
        `;

        try {
            await writePresence(
                getDesiredPresenceStatus()
            );

            const {
                data: presence,
                error
            } = await db
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at,custom_status"
                );

            if (error) {
                throw error;
            }

            const onlineIds =
                (
                    presence || []
                )
                    .filter(row => {
                        if (
                            !row.user_id ||
                            String(
                                row.user_id
                            ) ===
                                String(
                                    state.user.id
                                )
                        ) {
                            return false;
                        }

                        return (
                            calculatePresence(
                                row,
                                row.last_seen_at
                            ) ===
                            "online"
                        );
                    })
                    .map(
                        row =>
                            row.user_id
                    );

            const uniqueIds = [
                ...new Set(
                    onlineIds
                )
            ];

            if (!uniqueIds.length) {
                dom.generalCallUserList.innerHTML = `
                    <div class="call-user-empty">
                        No other students are currently online.
                    </div>
                `;

                updateGeneralCallSelectionCount();

                return;
            }

            const {
                data: students,
                error:
                    studentsError
            } = await db
                .from("students")
                .select(
                    "id,full_name,photo_url"
                )
                .in(
                    "id",
                    uniqueIds
                );

            if (studentsError) {
                throw studentsError;
            }

            dom.generalCallUserList.innerHTML =
                "";

            (
                students || []
            ).forEach(
                student => {
                    const row =
                        document.createElement(
                            "label"
                        );

                    row.className =
                        "general-call-user";

                    row.innerHTML = `
                        <input
                            type="checkbox"
                            value="${escapeAttribute(
                                student.id
                            )}"
                        >

                        <img
                            src="${escapeAttribute(
                                profilePhoto(
                                    student
                                )
                            )}"
                            alt=""
                        >

                        <span>
                            <strong>
                                ${escapeHTML(
                                    profileName(
                                        student
                                    )
                                )}
                            </strong>

                            <small>
                                ● Online
                            </small>
                        </span>
                    `;

                    const checkbox =
                        row.querySelector(
                            "input"
                        );

                    checkbox.addEventListener(
                        "change",
                        () => {
                            if (
                                checkbox.checked
                            ) {
                                state.selectedGeneralCallUsers.add(
                                    checkbox.value
                                );
                            } else {
                                state.selectedGeneralCallUsers.delete(
                                    checkbox.value
                                );
                            }

                            updateGeneralCallSelectionCount();
                        }
                    );

                    dom.generalCallUserList.appendChild(
                        row
                    );
                }
            );

            updateGeneralCallSelectionCount();
        } catch (error) {
            console.error(
                "Online call users failed:",
                error
            );

            dom.generalCallUserList.innerHTML = `
                <div class="call-user-empty">
                    Could not load online users.
                </div>
            `;
        }
    }

    function updateGeneralCallSelectionCount() {
        const count =
            state.selectedGeneralCallUsers.size;

        if (
            dom.generalCallSelectionCount
        ) {
            dom.generalCallSelectionCount.textContent =
                `${count} selected`;
        }

        if (
            dom.generalCallUserStatus
        ) {
            dom.generalCallUserStatus.textContent =
                count
                    ? `${count} online user${
                          count === 1
                              ? ""
                              : "s"
                      } selected`
                    : "Select online users or choose everyone online.";
        }
    }

    async function startGeneralCall(
        video
    ) {
        const calls =
            getCallEngine();

        if (!calls) {
            showToast(
                "Call engine is unavailable."
            );

            return;
        }

        const selected =
            Array.from(
                state.selectedGeneralCallUsers
            );

        if (!selected.length) {
            showToast(
                "Select at least one online user."
            );

            return;
        }

        try {
            if (
                typeof calls.callUsers ===
                "function"
            ) {
                await calls.callUsers(
                    selected,
                    {
                        video:
                            Boolean(
                                video
                            )
                    }
                );
            } else if (
                typeof calls.generalCall ===
                "function"
            ) {
                await calls.generalCall(
                    selected,
                    {
                        video:
                            Boolean(
                                video
                            )
                    }
                );
            } else {
                showToast(
                    "The call engine does not expose a general-call method."
                );

                return;
            }

            closeGeneralCallModal();
        } catch (error) {
            console.error(
                "General call failed:",
                error
            );

            showToast(
                "Unable to start the general call."
            );
        }
    }


    /* =========================================================
       COMPOSER / MOBILE KEYBOARD
       ========================================================= */

    function autoResizeInput() {
        const input =
            dom.messageInput;

        if (!input) return;

        input.style.height =
            "auto";

        input.style.height =
            `${Math.min(
                input.scrollHeight,
                150
            )}px`;
    }

    function focusComposer() {
        if (!dom.messageInput) {
            return;
        }

        /*
         * Do not automatically force focus on mobile,
         * because that opens the keyboard unexpectedly.
         */
    }

    function scrollComposerIntoView() {
        const composer =
            document.querySelector(
                "#messageComposer, .message-composer"
            );

        if (!composer) {
            return;
        }

        setTimeout(() => {
            composer.scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }, 50);
    }

    function setupVisualViewport() {
        if (!window.visualViewport) {
            return;
        }

        const update =
            () => {
                const height =
                    window.visualViewport
                        .height;

                document.documentElement
                    .style
                    .setProperty(
                        "--mwaniki-visual-height",
                        `${height}px`
                    );
            };

        window.visualViewport.addEventListener(
            "resize",
            update
        );

        window.visualViewport.addEventListener(
            "scroll",
            update
        );

        update();
    }


    /* =========================================================
       NAVIGATION / DRAWERS
       ========================================================= */

    function setupNavigation() {
        if (
            dom.channelToggleButton
        ) {
            dom.channelToggleButton.addEventListener(
                "click",
                () => {
                    dom.channelSidebar
                        ?.classList.toggle(
                            "open"
                        );
                }
            );
        }

        if (
            dom.memberToggleButton
        ) {
            dom.memberToggleButton.addEventListener(
                "click",
                () => {
                    dom.memberSidebar
                        ?.classList.toggle(
                            "open"
                        );
                }
            );
        }

        if (
            dom.closeMemberSidebarButton
        ) {
            dom.closeMemberSidebarButton.addEventListener(
                "click",
                () => {
                    dom.memberSidebar
                        ?.classList.remove(
                            "open"
                        );
                }
            );
        }

        if (
            dom.communitySelectorButton
        ) {
            dom.communitySelectorButton.addEventListener(
                "click",
                openCommunityModal
            );
        }

        if (
            dom.closeCommunityModal
        ) {
            dom.closeCommunityModal.addEventListener(
                "click",
                closeCommunityModal
            );
        }

        if (
            dom.communityModal
        ) {
            dom.communityModal.addEventListener(
                "click",
                event => {
                    if (
                        event.target ===
                        dom.communityModal
                    ) {
                        closeCommunityModal();
                    }
                }
            );
        }

        if (
            dom.communityModalSearch
        ) {
            dom.communityModalSearch.addEventListener(
                "input",
                event => {
                    renderCommunityChoices(
                        event.target.value
                    );
                }
            );
        }

        if (
            dom.communityCallButton
        ) {
            dom.communityCallButton.addEventListener(
                "click",
                communityCall
            );
        }

        if (
            dom.generalCallButton
        ) {
            dom.generalCallButton.addEventListener(
                "click",
                generalCall
            );
        }

        if (
            dom.generalVoiceCallButton
        ) {
            dom.generalVoiceCallButton.addEventListener(
                "click",
                () =>
                    startGeneralCall(
                        false
                    )
            );
        }

        if (
            dom.generalVideoCallButton
        ) {
            dom.generalVideoCallButton.addEventListener(
                "click",
                () =>
                    startGeneralCall(
                        true
                    )
            );
        }

        if (
            dom.closeGeneralCallModalButton
        ) {
            dom.closeGeneralCallModalButton.addEventListener(
                "click",
                closeGeneralCallModal
            );
        }

        if (
            dom.cancelGeneralCallButton
        ) {
            dom.cancelGeneralCallButton.addEventListener(
                "click",
                closeGeneralCallModal
            );
        }

        if (
            dom.profileButton
        ) {
            dom.profileButton.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./profile.html";
                }
            );
        }

        if (
            dom.communityHomeButton
        ) {
            dom.communityHomeButton.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./dashboard.html";
                }
            );
        }
    }


    /* =========================================================
       COMMUNITY MODAL
       ========================================================= */

    function openCommunityModal() {
        if (
            !dom.communityModal
        ) {
            return;
        }

        openElement(
            dom.communityModal
        );

        renderCommunityChoices(
            dom.communityModalSearch
                ?.value || ""
        );
    }

    function closeCommunityModal() {
        closeElement(
            dom.communityModal
        );
    }

    function renderCommunityChoices(
        search
    ) {
        const container =
            dom.communityChoiceList;

        if (!container) {
            return;
        }

        const term =
            String(
                search || ""
            )
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(
                community => {
                    if (!term) {
                        return true;
                    }

                    return (
                        String(
                            community.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(term) ||
                        String(
                            community.description ||
                            ""
                        )
                            .toLowerCase()
                            .includes(term)
                    );
                }
            );

        container.innerHTML = "";

        communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-choice";

                button.innerHTML = `
                    <span
                        class="community-choice-icon"
                    >
                        ${communityIcon(
                            community
                        )}
                    </span>

                    <span
                        class="community-choice-content"
                    >
                        <strong>
                            ${escapeHTML(
                                community.name
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                community.description ||
                                ""
                            )}
                        </small>
                    </span>
                `;

                button.addEventListener(
                    "click",
                    async () => {
                        closeCommunityModal();

                        await selectCommunity(
                            community.id
                        );
                    }
                );

                container.appendChild(
                    button
                );
            }
        );
    }


    /* =========================================================
       SEARCH
       ========================================================= */

    function setupMessageSearch() {
        if (
            dom.chatSearchButton
        ) {
            dom.chatSearchButton.addEventListener(
                "click",
                openMessageSearch
            );
        }

        if (
            dom.closeMessageSearchButton
        ) {
            dom.closeMessageSearchButton.addEventListener(
                "click",
                closeMessageSearch
            );
        }

        if (
            dom.messageSearchInput
        ) {
            dom.messageSearchInput.addEventListener(
                "input",
                event => {
                    state.messageSearch =
                        event.target.value;

                    renderMessagesFiltered();
                }
            );
        }
    }

    function openMessageSearch() {
        const element =
            dom.messageSearch ||
            dom.messageSearchInput;

        if (element) {
            openElement(
                element
            );
        }
    }

    function closeMessageSearch() {
        if (
            dom.messageSearch
        ) {
            closeElement(
                dom.messageSearch
            );
        }
    }

    function renderMessagesFiltered() {
        if (
            !state.messageSearch
                .trim()
        ) {
            renderMessages();
            return;
        }

        const term =
            state.messageSearch
                .trim()
                .toLowerCase();

        const original =
            state.messages;

        state.messages =
            original.filter(
                message =>
                    String(
                        message.content ||
                        ""
                    )
                        .toLowerCase()
                        .includes(term)
            );

        renderMessages();

        state.messages =
            original;
    }


    /* =========================================================
       ESC / OUTSIDE PICKERS
       ========================================================= */

    function setupAccessibility() {
        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeAllPickers();

                    closeCommunityModal();

                    closeGeneralCallModal();

                    cancelReply();

                    document
                        .getElementById(
                            "mwanikiReactionPicker"
                        )
                        ?.remove();
                }
            }
        );

        document.addEventListener(
            "click",
            event => {
                const target =
                    event.target;

                if (
                    state.emojiOpen &&
                    dom.emojiPanel &&
                    !dom.emojiPanel.contains(
                        target
                    ) &&
                    !dom.emojiButton?.contains(
                        target
                    )
                ) {
                    state.emojiOpen =
                        false;

                    closeElement(
                        dom.emojiPanel
                    );
                }

                if (
                    state.stickerOpen &&
                    dom.stickerPanel &&
                    !dom.stickerPanel.contains(
                        target
                    ) &&
                    !dom.stickerButton?.contains(
                        target
                    )
                ) {
                    state.stickerOpen =
                        false;

                    closeElement(
                        dom.stickerPanel
                    );
                }

                if (
                    state.gifOpen &&
                    dom.gifPanel &&
                    !dom.gifPanel.contains(
                        target
                    ) &&
                    !dom.gifButton?.contains(
                        target
                    )
                ) {
                    state.gifOpen =
                        false;

                    closeElement(
                        dom.gifPanel
                    );
                }
            }
        );
    }


    /* =========================================================
       CREATE EMOJI / PICKERS
       ========================================================= */

    function setupPickers() {
        createEmojiPanel();
    }


    /* =========================================================
       CONTEST
       ========================================================= */

    function setupContest() {
        if (
            dom.contestChannelButton
        ) {
            dom.contestChannelButton.addEventListener(
                "click",
                () => {
                    if (
                        dom.contestModal
                    ) {
                        openElement(
                            dom.contestModal
                        );
                    } else {
                        showToast(
                            "Contest area is not available."
                        );
                    }
                }
            );
        }

        if (
            dom.closeContestButton
        ) {
            dom.closeContestButton.addEventListener(
                "click",
                () => {
                    closeElement(
                        dom.contestModal
                    );
                }
            );
        }
    }
/* ============================================================
   MESSAGE EVENTS
   ============================================================ */

function setupMessageEvents() {
    console.log("💬 Community: Setting up message events...");

    const messageInput = document.getElementById("messageInput");
    const sendMessageButton = document.getElementById("sendMessageButton");
    const messageList = document.getElementById("messageList");

    /* --------------------------------------------------------
       SEND MESSAGE BUTTON
       -------------------------------------------------------- */

    if (sendMessageButton) {
        sendMessageButton.addEventListener("click", async (event) => {
            event.preventDefault();

            if (typeof sendMessage === "function") {
                await sendMessage();
            } else {
                console.error("❌ sendMessage() is not defined");
            }
        });
    }

    /* --------------------------------------------------------
       ENTER TO SEND
       Shift + Enter = new line
       -------------------------------------------------------- */

    if (messageInput) {
        messageInput.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter") {
                return;
            }

            if (event.shiftKey) {
                return;
            }

            event.preventDefault();

            if (typeof sendMessage === "function") {
                await sendMessage();
            } else {
                console.error("❌ sendMessage() is not defined");
            }
        });

        /* Prevent mobile keyboards from causing the entire page
           to jump when the user starts typing. */
        messageInput.addEventListener("focus", () => {
            requestAnimationFrame(() => {
                keepMessageComposerVisible();
            });
        });

        messageInput.addEventListener("input", () => {
            if (typeof updateTypingState === "function") {
                try {
                    updateTypingState();
                } catch (error) {
                    console.warn(
                        "⚠️ Typing-state update failed:",
                        error
                    );
                }
            }
        });
    }

    /* --------------------------------------------------------
       MESSAGE LIST
       -------------------------------------------------------- */

    if (messageList) {
        messageList.addEventListener("click", async (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            /* ----------------------------------------------
               REPLY BUTTON
               ---------------------------------------------- */

            const replyButton = target.closest(
                "[data-action='reply'], .reply-message-button, .message-reply-button"
            );

            if (replyButton) {
                event.preventDefault();
                event.stopPropagation();

                const messageId =
                    replyButton.dataset.messageId ||
                    replyButton.closest("[data-message-id]")?.dataset.messageId;

                if (!messageId) {
                    console.warn("⚠️ Reply button has no message ID");
                    return;
                }

                if (typeof startReply === "function") {
                    startReply(messageId);
                } else if (typeof replyToMessage === "function") {
                    replyToMessage(messageId);
                } else if (typeof setReplyMessage === "function") {
                    setReplyMessage(messageId);
                } else {
                    console.warn(
                        "⚠️ No reply handler found for message:",
                        messageId
                    );
                }

                return;
            }

            /* ----------------------------------------------
               DELETE BUTTON
               ---------------------------------------------- */

            const deleteButton = target.closest(
                "[data-action='delete'], .delete-message-button, .message-delete-button"
            );

            if (deleteButton) {
                event.preventDefault();
                event.stopPropagation();

                const messageId =
                    deleteButton.dataset.messageId ||
                    deleteButton.closest("[data-message-id]")?.dataset.messageId;

                if (!messageId) {
                    console.warn("⚠️ Delete button has no message ID");
                    return;
                }

                let message = null;

                if (Array.isArray(state.messages)) {
                    message =
                        state.messages.find(
                            item => String(item.id) === String(messageId)
                        ) || null;
                }

                if (!message && typeof getMessageById === "function") {
                    try {
                        message = getMessageById(messageId);
                    } catch (_) {}
                }

                if (typeof deleteMessage === "function") {
                    await deleteMessage(message || { id: messageId });
                } else {
                    console.error("❌ deleteMessage() is not defined");
                }

                return;
            }

            /* ----------------------------------------------
               REACTION BUTTON
               ---------------------------------------------- */

            const reactionButton = target.closest(
                "[data-action='reaction'], .reaction-button, .message-reaction-button"
            );

            if (reactionButton) {
                event.preventDefault();
                event.stopPropagation();

                const messageId =
                    reactionButton.dataset.messageId ||
                    reactionButton.closest("[data-message-id]")?.dataset.messageId;

                const reaction =
                    reactionButton.dataset.reaction ||
                    reactionButton.dataset.emoji ||
                    reactionButton.textContent.trim();

                if (!messageId || !reaction) {
                    return;
                }

                if (typeof toggleMessageReaction === "function") {
                    await toggleMessageReaction(messageId, reaction);
                } else if (typeof reactToMessage === "function") {
                    await reactToMessage(messageId, reaction);
                } else if (typeof addReaction === "function") {
                    await addReaction(messageId, reaction);
                } else {
                    console.warn(
                        "⚠️ No reaction handler found."
                    );
                }

                return;
            }

            /* ----------------------------------------------
               EMOJI REACTION
               ---------------------------------------------- */

            const emojiReaction = target.closest(
                "[data-message-reaction]"
            );

            if (emojiReaction) {
                event.preventDefault();
                event.stopPropagation();

                const messageId =
                    emojiReaction.dataset.messageId ||
                    emojiReaction.closest("[data-message-id]")?.dataset.messageId;

                const reaction =
                    emojiReaction.dataset.messageReaction;

                if (
                    messageId &&
                    reaction &&
                    typeof toggleMessageReaction === "function"
                ) {
                    await toggleMessageReaction(
                        messageId,
                        reaction
                    );
                }

                return;
            }
        });

        /* ----------------------------------------------------
           RIGHT CLICK MESSAGE MENU
           ---------------------------------------------------- */

        messageList.addEventListener("contextmenu", event => {
            const messageElement =
                event.target.closest("[data-message-id]");

            if (!messageElement) {
                return;
            }

            event.preventDefault();

            const messageId =
                messageElement.dataset.messageId;

            if (typeof showMessageContextMenu === "function") {
                showMessageContextMenu(
                    event,
                    messageId
                );
            }
        });
    }

    /* --------------------------------------------------------
       CANCEL REPLY
       -------------------------------------------------------- */

    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const cancelReplyButton = target.closest(
            "#cancelReplyButton, .cancel-reply-button, [data-action='cancel-reply']"
        );

        if (!cancelReplyButton) {
            return;
        }

        event.preventDefault();

        if (typeof cancelReply === "function") {
            cancelReply();
        } else if (typeof clearReply === "function") {
            clearReply();
        } else {
            clearReplyFallback();
        }
    });

    /* --------------------------------------------------------
       ESCAPE = CANCEL REPLY / CLOSE MESSAGE MENUS
       -------------------------------------------------------- */

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") {
            return;
        }

        if (typeof cancelReply === "function") {
            try {
                cancelReply();
            } catch (_) {}
        } else {
            clearReplyFallback();
        }

        if (typeof closeMessageContextMenu === "function") {
            try {
                closeMessageContextMenu();
            } catch (_) {}
        }
    });

    /* --------------------------------------------------------
       MOBILE KEYBOARD / VIEWPORT
       -------------------------------------------------------- */

    if (window.visualViewport) {
        const viewportHandler = () => {
            keepMessageComposerVisible();
        };

        window.visualViewport.addEventListener(
            "resize",
            viewportHandler
        );

        window.visualViewport.addEventListener(
            "scroll",
            viewportHandler
        );
    }

    console.log("✅ Community: Message events ready.");
}


/* ============================================================
   KEEP CHAT COMPOSER VISIBLE
   ============================================================ */

function keepMessageComposerVisible() {
    const input = document.getElementById("messageInput");

    if (!input) {
        return;
    }

    const composer =
        input.closest(
            "#messageComposer, .message-composer, .chat-composer"
        );

    if (!composer) {
        return;
    }

    if (window.visualViewport) {
        const viewport = window.visualViewport;

        const rect = composer.getBoundingClientRect();

        const visibleBottom =
            viewport.offsetTop + viewport.height;

        if (rect.bottom > visibleBottom) {
            const amount =
                rect.bottom - visibleBottom + 16;

            window.scrollBy({
                top: amount,
                behavior: "smooth"
            });
        }
    }
}


/* ============================================================
   FALLBACK REPLY CLEAR
   ============================================================ */

function clearReplyFallback() {
    const replyPreview = document.getElementById(
        "replyPreview"
    );

    if (replyPreview) {
        replyPreview.classList.add("hidden");
        replyPreview.innerHTML = "";
    }

    if (typeof state !== "undefined" && state) {
        state.replyingTo = null;
        state.replyToMessage = null;
        state.replyMessage = null;
    }

    const input =
        document.getElementById("messageInput");

    if (input) {
        input.removeAttribute("data-reply-id");
        input.focus();
    }
}

    /* =========================================================
       GENERAL UI
       ========================================================= */

    function setupGeneralUI() {
        setupNavigation();
        setupMessageEvents();
        setupMessageSearch();
        setupAccessibility();
        setupPickers();
        setupContest();
        setupVisualViewport();

        /*
         * Keep the composer in the chat flex layout.
         * These inline properties complement the CSS and
         * prevent the composer from becoming page-bottom content.
         */
        const communityMain =
            document.querySelector(
                "#communityMain, .community-main"
            );

        const messageArea =
            document.querySelector(
                "#chatPanel, .chat-panel, .community-chat"
            );

        if (communityMain) {
            communityMain.style.minHeight =
                "0";
        }

        if (messageArea) {
            messageArea.style.minHeight =
                "0";

            messageArea.style.display =
                "flex";

            messageArea.style.flexDirection =
                "column";
        }

        if (dom.messageList) {
            dom.messageList.style.minHeight =
                "0";

            dom.messageList.style.flex =
                "1 1 auto";

            dom.messageList.style.overflowY =
                "auto";
        }

        const composer =
            document.querySelector(
                "#messageComposer, .message-composer"
            );

        if (composer) {
            composer.style.flex =
                "0 0 auto";

            composer.style.position =
                "relative";

            composer.style.bottom =
                "auto";
        }
    }


    /* =========================================================
       INIT
       ========================================================= */

    async function init() {
        if (
            state.initialized
        ) {
            return;
        }

        state.initialized =
            true;

        try {
            cacheDom();

            await waitForSupabase();

            console.log(
                "✅ Community: Supabase ready"
            );

            const authenticated =
                await requireAuthentication();

            if (!authenticated) {
                return;
            }

            await loadProfile();

            setupAuthListener();

            setupGeneralUI();

            startPresence();

            await loadCommunities();

            console.log(
                "✅ Community loaded"
            );

            setStatus(
                "Community ready"
            );
        } catch (error) {
            console.error(
                "❌ Community initialization failed:",
                error
            );

            setStatus(
                "Community could not be loaded."
            );

            showToast(
                "Community failed to load. Check the browser console."
            );
        }
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.MwanikiCommunity = {
        state,

        selectCommunity,
        selectChannel,

        sendMessage,

        startReply,
        cancelReply,

        deleteMessage,

        toggleReaction,

        refreshMemberPresence,

        startPresence,
        stopPresence,

        openGeneralCallModal,
        closeGeneralCallModal,

        callMember,
        communityCall
    };


    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );
    } else {
        init();
    }

})();
