/* ============================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   community.js

   COMPLETE COMMUNITY VERSION

   FIXES:
   - Uses existing Supabase client
   - No invalid reply_to column
   - Messages load correctly
   - Messages send correctly
   - Realtime messages
   - Student profile loading
   - Supabase Storage profile photos
   - Real student photos in messages
   - Real student photo in sidebar/rail
   - Emoji community icons
   - Large Unicode emoji keyboard
   - Recent emojis
   - Apple-compatible Unicode emojis
   - Communities
   - Channels
   - Mwaniki Scholars General
   - Community General
   - Community search
   - Channel search
   - Presence
   - Accessibility
   - Keyboard navigation
   ============================================================ */

(() => {

    "use strict";

    /* ============================================================
       CONFIG
       ============================================================ */

    const CONFIG = {

        dashboardUrl: "./dashboard.html",

        profileUrl: "./profile.html",

        profileBucket: "student-profiles",

        defaultAvatar:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
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
                        fill="#dce9e7"
                    />

                    <circle
                        cx="80"
                        cy="62"
                        r="30"
                        fill="#087f73"
                    />

                    <path
                        d="M35 137c6-30 24-45 45-45s39 15 45 45"
                        fill="#087f73"
                    />
                </svg>
            `)

    };


    /* ============================================================
       STATE
       ============================================================ */

    const state = {

        supabase: null,

        user: null,

        profile: null,

        communities: [],

        channels: [],

        messages: [],

        selectedCommunity: null,

        selectedChannel: null,

        channelSearch: "",

        communitySearch: "",

        loadingCommunities: false,

        loadingChannels: false,

        loadingMessages: false,

        sendingMessage: false,

        realtimeChannel: null,

        presenceChannel: null,

        modalPreviousFocus: null,

        emojiPicker: null,

        emojiCategory: "Smileys",

        recentEmojis: [],

        selectedCallUsers: [],

        callRoom: null,

        localStream: null,

        peerConnections: new Map(),

        callStartedAt: null,

        callTimer: null

    };


    /* ============================================================
       DOM
       ============================================================ */

    const $ = id =>
        document.getElementById(id);

    const dom = {};


    function cacheDom() {

        const ids = [

            "communityApp",

            "homeButton",

            "railHomeButton",

            "railGeneralButton",

            "communityRailList",

            "railProfileButton",

            "railProfileAvatar",

            "openCommunityButton",

            "channelSearchInput",

            "channelList",

            "communitySelectorButton",

            "selectedCommunityIcon",

            "selectedCommunityName",

            "selectedCommunityDescription",

            "sidebarProfileButton",

            "sidebarProfileAvatar",

            "sidebarProfileName",

            "dashboardButton",

            "headerCommunityButton",

            "generalCallButton",

            "mainChannelTitle",

            "mainChannelDescription",

            "messageList",

            "messageForm",

            "messageInput",

            "sendMessageButton",

            "attachButton",

            "emojiButton",

            "startConversationButton",

            "welcomeStartButton",

            "communityModal",

            "closeCommunityModal",

            "communityModalSearch",

            "communityChoiceList",

            "generalCallModal",

            "closeGeneralCallModalButton",

            "generalCallUserList",

            "generalCallUserStatus",

            "generalCallSelectionCount",

            "generalCallMessage",

            "cancelGeneralCallButton",

            "startGeneralCallButton",

            "callOverlay",

            "callTitle",

            "callSubtitle",

            "callDuration",

            "callVideoGrid",

            "localVideoTile",

            "localVideo",

            "callParticipants",

            "toggleMicrophoneButton",

            "toggleCameraButton",

            "shareScreenButton",

            "minimizeCallButton",

            "leaveCallButton",

            "incomingCallToast",

            "incomingCallTitle",

            "incomingCallText",

            "acceptCallButton",

            "declineCallButton",

            "accessibilityAnnouncer",

            "communityStatus"

        ];

        ids.forEach(id => {

            dom[id] = $(id);

        });

    }


    /* ============================================================
       ACCESSIBILITY ANNOUNCER
       ============================================================ */

    function announce(message) {

        const text =
            String(message || "");

        const announcer =
            dom.accessibilityAnnouncer;

        const status =
            dom.communityStatus;

        if (announcer) {

            announcer.textContent = "";

            window.setTimeout(() => {

                announcer.textContent = text;

            }, 20);

        }

        if (status) {

            status.textContent = text;

        }

    }


    /* ============================================================
       SUPABASE
       ============================================================ */

    async function waitForSupabase() {

        const immediateClients = [

            window.supabaseClient,

            window.sb,

            window.mwanikiSupabase,

            window.supabase

        ];

        for (const client of immediateClients) {

            if (
                client &&
                typeof client.from === "function"
            ) {

                return client;

            }

        }


        /*
         * supabase.js is an ES module.
         * Module execution can happen after this classic script.
         * Therefore we wait instead of creating another client.
         */

        for (
            let attempt = 0;
            attempt < 150;
            attempt++
        ) {

            const clients = [

                window.supabaseClient,

                window.sb,

                window.mwanikiSupabase,

                window.supabase

            ];

            for (const client of clients) {

                if (
                    client &&
                    typeof client.from === "function"
                ) {

                    return client;

                }

            }

            await new Promise(resolve =>
                setTimeout(resolve, 100)
            );

        }

        throw new Error(
            "Supabase client did not become available."
        );

    }


    /* ============================================================
       INIT
       ============================================================ */

    async function init() {

        cacheDom();

        announce(
            "Loading Mwaniki Scholars Community."
        );

        try {

            state.supabase =
                await waitForSupabase();

        } catch (error) {

            console.error(
                "Supabase initialization failed:",
                error
            );

            showError(
                "Supabase could not be initialized. Check supabase.js."
            );

            return;

        }

        bindEvents();

        await loadAuthenticatedUser();

        await loadProfile();

        await updatePresence();

        await loadCommunities();

        renderCommunityRail();

        renderCommunitySelector();

        renderCommunityModal();

        await selectInitialCommunity();

        setupRealtime();

        setupAccessibility();

        setupPresenceHeartbeat();

        setupEmojiPicker();

        announce(
            "Mwaniki Scholars Community is ready."
        );

        console.log(
            "Mwaniki Community fully initialized."
        );

    }


    /* ============================================================
       AUTHENTICATION
       ============================================================ */

    async function loadAuthenticatedUser() {

        try {

            const {
                data,
                error
            } =
                await state.supabase
                    .auth
                    .getUser();

            if (error) {

                console.warn(
                    "Auth error:",
                    error
                );

                return;

            }

            state.user =
                data?.user ||
                null;

            if (state.user) {

                console.log(
                    "Authenticated user:",
                    state.user.id
                );

            }

        } catch (error) {

            console.error(
                "Authentication exception:",
                error
            );

        }

    }


    /* ============================================================
       PROFILE LOADING
       ============================================================ */

    async function loadProfile() {

        if (!state.user) {

            setProfileFallback();

            return;

        }

        try {

            let profile =
                await fetchStudentProfile(
                    state.user.id
                );

            if (!profile) {

                console.warn(
                    "No student profile found for authenticated user."
                );

            }

            state.profile =
                normalizeProfile(
                    profile
                );

            updateProfileUI();

            console.log(
                "Student profile loaded:",
                state.profile
            );

        } catch (error) {

            console.warn(
                "Student profile error:",
                error
            );

            state.profile = null;

            setProfileFallback();

        }

    }


    /*
     * The previous version requested several columns simultaneously.
     * If one column is different in the current students table,
     * Supabase returns HTTP 400.
     *
     * We therefore first request the complete row, then normalize it.
     *
     * If students.id is not the Auth UUID, we also try user_id.
     */

    async function fetchStudentProfile(
        userId
    ) {

        if (!userId) {
            return null;
        }


        /* --------------------------------------------------------
           Attempt 1: students.id
           -------------------------------------------------------- */

        try {

            const {
                data,
                error
            } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();

            if (!error && data) {

                return data;

            }

            if (error) {

                console.warn(
                    "students.id profile lookup:",
                    error.message || error
                );

            }

        } catch (error) {

            console.warn(
                "students.id lookup exception:",
                error
            );

        }


        /* --------------------------------------------------------
           Attempt 2: students.user_id
           -------------------------------------------------------- */

        try {

            const {
                data,
                error
            } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .eq(
                        "user_id",
                        userId
                    )
                    .maybeSingle();

            if (!error && data) {

                return data;

            }

            if (error) {

                console.warn(
                    "students.user_id profile lookup:",
                    error.message || error
                );

            }

        } catch (error) {

            console.warn(
                "students.user_id lookup exception:",
                error
            );

        }


        return null;

    }


    function normalizeProfile(
        profile
    ) {

        if (!profile) {
            return null;
        }

        const name =

            profile.full_name ||

            profile.name ||

            profile.student_name ||

            profile.display_name ||

            profile.username ||

            state.user?.email ||

            "Student";

        const rawPhoto =

            profile.photo_url ||

            profile.avatar_url ||

            profile.profile_photo ||

            profile.profile_image ||

            profile.photo ||

            profile.avatar ||

            "";

        return {

            ...profile,

            display_name: name,

            photo_url: rawPhoto

        };

    }


    function getProfileName(
        profile = state.profile
    ) {

        return (

            profile?.display_name ||

            profile?.full_name ||

            profile?.name ||

            profile?.student_name ||

            profile?.displayName ||

            profile?.username ||

            state.user?.email ||

            "Student"

        );

    }


    /*
     * Converts:
     *
     * 1. Full HTTPS URL
     * 2. data:image URL
     * 3. Supabase public URL
     * 4. student-profiles/file.jpg
     * 5. file.jpg
     *
     * into a usable browser image URL.
     */

    function resolveProfilePhoto(
        rawPhoto
    ) {

        const value =
            String(
                rawPhoto || ""
            ).trim();

        if (!value) {

            return CONFIG.defaultAvatar;

        }


        /* Data URI */

        if (
            /^data:image\//i.test(value)
        ) {

            return value;

        }


        /* Blob URL */

        if (
            /^blob:/i.test(value)
        ) {

            return value;

        }


        /* Normal external/public URL */

        if (
            /^https?:\/\//i.test(value)
        ) {

            return value;

        }


        /*
         * Supabase Storage path.
         *
         * The student-profiles bucket is expected to be public.
         */

        let path =
            value;


        path =
            path.replace(
                /^\/+/,
                ""
            );


        path =
            path.replace(
                /^student-profiles\//i,
                ""
            );


        /*
         * If the database accidentally stored the complete
         * Supabase storage path, extract the object path.
         */

        const marker =
            "/storage/v1/object/public/" +
            CONFIG.profileBucket +
            "/";

        const markerIndex =
            path.indexOf(marker);


        if (markerIndex >= 0) {

            path =
                path.slice(
                    markerIndex +
                    marker.length
                );

        }


        try {

            const result =
                state.supabase
                    .storage
                    .from(
                        CONFIG.profileBucket
                    )
                    .getPublicUrl(
                        path
                    );

            if (
                result?.data?.publicUrl
            ) {

                return result.data.publicUrl;

            }

        } catch (error) {

            console.warn(
                "Could not create profile photo URL:",
                error
            );

        }


        /*
         * Final manual fallback for a public bucket.
         */

        return (
            "https://bazixdwtysmkkdeloerx.supabase.co" +
            "/storage/v1/object/public/" +
            CONFIG.profileBucket +
            "/" +
            encodePath(path)
        );

    }


    function encodePath(
        path
    ) {

        return String(path)
            .split("/")
            .map(
                part =>
                    encodeURIComponent(part)
            )
            .join("/");

    }


    function getProfilePhoto(
        profile = state.profile
    ) {

        const raw =

            profile?.photo_url ||

            profile?.avatar_url ||

            profile?.profile_photo ||

            profile?.profile_image ||

            profile?.photo ||

            profile?.avatar ||

            "";

        return resolveProfilePhoto(raw);

    }


    function updateProfileUI() {

        const name =
            getProfileName();

        const photo =
            getProfilePhoto();

        if (
            dom.sidebarProfileName
        ) {

            dom.sidebarProfileName.textContent =
                name;

        }

        setImage(
            dom.sidebarProfileAvatar,
            photo,
            `${name} profile photo`
        );

        setImage(
            dom.railProfileAvatar,
            photo,
            `${name} profile photo`
        );

    }


    function setProfileFallback() {

        const name =
            state.user?.email ||
            "Student";

        if (
            dom.sidebarProfileName
        ) {

            dom.sidebarProfileName.textContent =
                name;

        }

        setImage(
            dom.sidebarProfileAvatar,
            CONFIG.defaultAvatar,
            `${name} profile photo`
        );

        setImage(
            dom.railProfileAvatar,
            CONFIG.defaultAvatar,
            `${name} profile photo`
        );

    }


    /* ============================================================
       SAFE IMAGE HANDLING
       ============================================================ */

    function setImage(
        image,
        source,
        alt
    ) {

        if (!image) {
            return;
        }

        image.loading =
            "lazy";

        image.decoding =
            "async";

        image.alt =
            alt ||
            "Profile photo";

        image.onerror =
            () => {

                image.onerror = null;

                image.src =
                    CONFIG.defaultAvatar;

            };

        image.src =
            source ||
            CONFIG.defaultAvatar;

    }


    /* ============================================================
       COMMUNITIES
       ============================================================ */

    async function loadCommunities() {

        if (
            state.loadingCommunities
        ) {
            return;
        }

        state.loadingCommunities =
            true;

        try {

            const {
                data,
                error
            } =
                await state.supabase
                    .from("chat_communities")
                    .select(`
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

                console.error(
                    "Community loading failed:",
                    error
                );

                state.communities =
                    [];

                showError(
                    "Unable to load communities."
                );

                return;

            }

            state.communities =
                Array.isArray(data)
                    ? data
                    : [];

            console.log(
                `Communities loaded: ${state.communities.length}`
            );

        } catch (error) {

            console.error(
                "Community loading exception:",
                error
            );

            state.communities =
                [];

        } finally {

            state.loadingCommunities =
                false;

        }

    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels(
        communityId
    ) {

        if (!communityId) {

            state.channels =
                [];

            renderChannels();

            return;

        }

        state.loadingChannels =
            true;

        renderChannelLoading();

        try {

            const {
                data,
                error
            } =
                await state.supabase
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

                console.error(
                    "CHANNEL QUERY FAILED:",
                    error
                );

                state.channels =
                    [];

                showChannelError(
                    error.message
                );

                return;

            }

            state.channels =
                Array.isArray(data)
                    ? data
                    : [];

            state.channels.sort(
                sortChannels
            );

            console.log(
                `Channels loaded: ${state.channels.length}`
            );

            renderChannels();

        } catch (error) {

            console.error(
                "Channel loading exception:",
                error
            );

            state.channels =
                [];

            showChannelError(
                error.message
            );

        } finally {

            state.loadingChannels =
                false;

        }

    }


    function sortChannels(
        a,
        b
    ) {

        const ag =
            isGeneralChannel(a);

        const bg =
            isGeneralChannel(b);

        if (ag && !bg) {
            return -1;
        }

        if (!ag && bg) {
            return 1;
        }

        const ap =
            Number(
                a.position ?? 999999
            );

        const bp =
            Number(
                b.position ?? 999999
            );

        if (ap !== bp) {
            return ap - bp;
        }

        return String(
            a.name || ""
        ).localeCompare(
            String(
                b.name || ""
            )
        );

    }


    function isGeneralChannel(
        channel
    ) {

        const name =
            String(
                channel?.name || ""
            )
            .trim()
            .toLowerCase();

        const slug =
            String(
                channel?.slug || ""
            )
            .trim()
            .toLowerCase();

        return (

            name === "general" ||

            name === "# general" ||

            slug === "general" ||

            slug === "#-general"

        );

    }


    /* ============================================================
       COMMUNITY SELECTION
       ============================================================ */

    async function selectInitialCommunity() {

        if (
            !state.communities.length
        ) {

            state.selectedCommunity =
                null;

            state.channels =
                [];

            renderCommunitySelector();

            renderChannels();

            renderGlobalGeneral();

            return;

        }

        const stored =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        let community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(stored)
            );

        if (!community) {

            community =
                state.communities[0];

        }

        await selectCommunity(
            community,
            false
        );

    }


    async function selectCommunity(
        community,
        announceSelection = true
    ) {

        if (!community) {
            return;
        }

        state.selectedCommunity =
            community;

        state.selectedChannel =
            null;

        state.messages =
            [];

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            String(community.id)
        );

        localStorage.removeItem(
            "mwanikiSelectedChannel"
        );

        renderCommunityRail();

        renderCommunitySelector();

        renderCommunityModal();

        await loadChannels(
            community.id
        );

        const general =
            state.channels.find(
                isGeneralChannel
            );

        const channel =
            general ||
            state.channels[0];

        if (channel) {

            await selectChannel(
                channel,
                announceSelection
            );

        } else {

            updateMainChannelHeader(
                null
            );

            renderEmptyChannels();

            renderWelcomeState();

            if (announceSelection) {

                announce(
                    `${community.name} has no channels available.`
                );

            }

        }

        closeCommunityModal();

    }


    async function selectChannel(
        channel,
        announceSelection = true
    ) {

        if (!channel) {
            return;
        }

        state.selectedChannel =
            channel;

        localStorage.setItem(
            "mwanikiSelectedChannel",
            String(channel.id)
        );

        updateMainChannelHeader(
            channel
        );

        renderChannels();

        await loadMessages(
            channel.id
        );

        if (announceSelection) {

            announce(
                `${getChannelLabel(channel)} selected.`
            );

        }

    }


    /* ============================================================
       COMMUNITY RAIL
       ============================================================ */

    function renderCommunityRail() {

        const container =
            dom.communityRailList;

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        state.communities.forEach(
            community => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "rail-community-icon";

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name ||
                    "Community";

                button.setAttribute(
                    "aria-label",
                    `Open ${community.name || "community"}`
                );

                if (
                    state.selectedCommunity &&
                    String(
                        state.selectedCommunity.id
                    ) ===
                    String(
                        community.id
                    )
                ) {

                    button.classList.add(
                        "active"
                    );

                    button.setAttribute(
                        "aria-current",
                        "page"
                    );

                }

                renderIconContent(
                    button,
                    community.icon_url,
                    community.name
                );

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community
                        )
                );

                container.appendChild(
                    button
                );

            }
        );

    }


    /* ============================================================
       COMMUNITY SELECTOR
       ============================================================ */

    function renderCommunitySelector() {

        const community =
            state.selectedCommunity;

        if (!community) {

            if (
                dom.selectedCommunityIcon
            ) {

                dom.selectedCommunityIcon.textContent =
                    "MS";

            }

            if (
                dom.selectedCommunityName
            ) {

                dom.selectedCommunityName.textContent =
                    "Mwaniki Scholars";

            }

            if (
                dom.selectedCommunityDescription
            ) {

                dom.selectedCommunityDescription.textContent =
                    "General";

            }

            return;

        }

        renderIcon(
            dom.selectedCommunityIcon,
            community.icon_url,
            community.name
        );

        if (
            dom.selectedCommunityName
        ) {

            dom.selectedCommunityName.textContent =
                community.name ||
                "Community";

        }

        if (
            dom.selectedCommunityDescription
        ) {

            dom.selectedCommunityDescription.textContent =
                community.description ||
                "Community";

        }

    }


    /* ============================================================
       COMMUNITY ICONS
       ============================================================ */

    function renderIcon(
        container,
        value,
        name
    ) {

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        renderIconContent(
            container,
            value,
            name
        );

    }


    function renderIconContent(
        container,
        value,
        name
    ) {

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        const icon =
            String(
                value || ""
            ).trim();

        /*
         * Emoji is text, not an image URL.
         */

        if (
            icon &&
            !looksLikeImageUrl(icon)
        ) {

            const span =
                document.createElement(
                    "span"
                );

            span.textContent =
                icon;

            span.setAttribute(
                "aria-hidden",
                "true"
            );

            container.appendChild(
                span
            );

            return;

        }

        if (icon) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                icon;

            image.alt =
                `${name || "Community"} icon`;

            image.loading =
                "lazy";

            image.onerror =
                () => {

                    image.remove();

                    const fallback =
                        document.createElement(
                            "span"
                        );

                    fallback.textContent =
                        getCommunityInitials(
                            name
                        );

                    container.appendChild(
                        fallback
                    );

                };

            container.appendChild(
                image
            );

            return;

        }

        const fallback =
            document.createElement(
                "span"
            );

        fallback.textContent =
            getCommunityInitials(
                name
            );

        container.appendChild(
            fallback
        );

    }


    function looksLikeImageUrl(
        value
    ) {

        return (

            /^https?:\/\//i.test(value) ||

            /^data:image\//i.test(value) ||

            /^blob:/i.test(value) ||

            value.startsWith("/") ||

            value.startsWith("./") ||

            value.startsWith("../")

        );

    }


    function getCommunityInitials(
        name
    ) {

        const text =
            String(
                name ||
                "MS"
            ).trim();

        if (!text) {
            return "MS";
        }

        const words =
            text.split(/\s+/);

        if (
            words.length === 1
        ) {

            return words[0]
                .slice(0, 2)
                .toUpperCase();

        }

        return (

            words[0][0] +

            words[1][0]

        ).toUpperCase();

    }


    /* ============================================================
       CHANNEL RENDERING
       ============================================================ */

    function renderChannels() {

        const container =
            dom.channelList;

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        const channels =
            filterChannels(
                state.channels,
                state.channelSearch
            );

        if (!channels.length) {

            renderEmptyChannels();

            return;

        }

        const groups =
            {};

        channels.forEach(
            channel => {

                let category =
                    String(
                        channel.channel_type ||
                        "Channels"
                    ).trim();

                if (!category) {
                    category =
                        "Channels";
                }

                const normalized =
                    category.toLowerCase();

                if (
                    normalized === "text"
                ) {

                    category =
                        "Text Channels";

                }

                if (
                    normalized === "voice"
                ) {

                    category =
                        "Voice";

                }

                if (
                    normalized === "announcement"
                ) {

                    category =
                        "Announcements";

                }

                if (!groups[category]) {

                    groups[category] =
                        [];

                }

                groups[category].push(
                    channel
                );

            }
        );

        Object.entries(
            groups
        ).forEach(
            ([category, list]) => {

                list.sort(
                    sortChannels
                );

                const section =
                    document.createElement(
                        "section"
                    );

                section.className =
                    "channel-section";

                const title =
                    document.createElement(
                        "div"
                    );

                title.className =
                    "channel-section-title";

                title.textContent =
                    category;

                section.appendChild(
                    title
                );

                list.forEach(
                    channel => {

                        section.appendChild(
                            createChannelButton(
                                channel
                            )
                        );

                    }
                );

                container.appendChild(
                    section
                );

            }
        );

    }


    function filterChannels(
        channels,
        query
    ) {

        const q =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();

        if (!q) {
            return [...channels];
        }

        return channels.filter(
            channel => {

                return (

                    String(
                        channel.name || ""
                    )
                    .toLowerCase()
                    .includes(q) ||

                    String(
                        channel.description || ""
                    )
                    .toLowerCase()
                    .includes(q) ||

                    String(
                        channel.channel_type || ""
                    )
                    .toLowerCase()
                    .includes(q)

                );

            }
        );

    }


    function createChannelButton(
        channel
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "channel-item";

        button.dataset.channelId =
            channel.id;

        if (
            state.selectedChannel &&
            String(
                state.selectedChannel.id
            ) ===
            String(channel.id)
        ) {

            button.classList.add(
                "active"
            );

            button.setAttribute(
                "aria-current",
                "page"
            );

        }

        const icon =
            document.createElement(
                "span"
            );

        icon.className =
            "channel-icon";

        icon.textContent =
            getChannelIcon(
                channel
            );

        const name =
            document.createElement(
                "span"
            );

        name.className =
            "channel-name";

        name.textContent =
            channel.name ||
            "General";

        button.appendChild(
            icon
        );

        button.appendChild(
            name
        );

        button.setAttribute(
            "aria-label",
            `Open ${getChannelLabel(channel)}`
        );

        button.addEventListener(
            "click",
            () =>
                selectChannel(
                    channel
                )
        );

        return button;

    }


    function getChannelIcon(
        channel
    ) {

        if (
            isGeneralChannel(channel)
        ) {

            return "💬";

        }

        const type =
            String(
                channel.channel_type ||
                ""
            )
            .toLowerCase();

        if (
            type.includes("voice")
        ) {

            return "🔊";

        }

        if (
            type.includes("announcement")
        ) {

            return "📢";

        }

        if (
            type.includes("study")
        ) {

            return "📚";

        }

        if (
            type.includes("course")
        ) {

            return "🎓";

        }

        return (
            channel.icon ||
            "#"
        );

    }


    function getChannelLabel(
        channel
    ) {

        return (

            "#" +

            String(
                channel?.name ||
                "general"
            )
            .replace(
                /^#\s*/,
                ""
            )

        );

    }


    /* ============================================================
       MAIN HEADER
       ============================================================ */

    function updateMainChannelHeader(
        channel
    ) {

        if (!channel) {

            if (dom.mainChannelTitle) {

                dom.mainChannelTitle.textContent =
                    "# General";

            }

            if (dom.mainChannelDescription) {

                dom.mainChannelDescription.textContent =
                    "Mwaniki Scholars General";

            }

            return;

        }

        if (dom.mainChannelTitle) {

            dom.mainChannelTitle.textContent =
                getChannelLabel(
                    channel
                );

        }

        if (dom.mainChannelDescription) {

            dom.mainChannelDescription.textContent =
                channel.description ||
                state.selectedCommunity?.name ||
                "Mwaniki Scholars";

        }

    }


    /* ============================================================
       MESSAGES
       ============================================================ */

    async function loadMessages(
        channelId
    ) {

        if (!channelId) {

            renderWelcomeState();

            return;

        }

        state.loadingMessages =
            true;

        renderMessageLoading();

        try {

            /*
             * IMPORTANT:
             *
             * chat_messages does NOT use reply_to
             * in the confirmed schema.
             *
             * Therefore it is deliberately NOT selected.
             */

            const {
                data,
                error
            } =
                await state.supabase
                    .from("chat_messages")
                    .select(`
                        id,
                        channel_id,
                        user_id,
                        content,
                        created_at
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
                    .limit(500);

            if (error) {

                console.error(
                    "Message loading failed:",
                    error
                );

                state.messages =
                    [];

                renderMessageError();

                return;

            }

            state.messages =
                Array.isArray(data)
                    ? data
                    : [];

            await attachMessageProfiles();

            renderMessages();

        } catch (error) {

            console.error(
                "Message loading exception:",
                error
            );

            state.messages =
                [];

            renderMessageError();

        } finally {

            state.loadingMessages =
                false;

        }

    }


    /* ============================================================
       MESSAGE PROFILE ATTACHMENT
       ============================================================ */

    async function attachMessageProfiles() {

        const ids =
            [
                ...new Set(
                    state.messages
                        .map(
                            message =>
                                message.user_id
                        )
                        .filter(Boolean)
                        .map(String)
                )
            ];

        if (!ids.length) {
            return;
        }


        const profiles =
            new Map();


        /*
         * Try one query first.
         * Using select("*") prevents the previous problem where
         * one missing column caused HTTP 400.
         */

        try {

            const {
                data,
                error
            } =
                await state.supabase
                    .from("students")
                    .select("*")
                    .in(
                        "id",
                        ids
                    );

            if (!error) {

                (data || []).forEach(
                    profile => {

                        profiles.set(
                            String(profile.id),
                            normalizeProfile(
                                profile
                            )
                        );

                    }
                );

            } else {

                console.warn(
                    "students.id batch profile lookup:",
                    error.message || error
                );

            }

        } catch (error) {

            console.warn(
                "students.id batch lookup exception:",
                error
            );

        }


        /*
         * If students.id isn't the Auth UUID, try user_id.
         */

        const missingIds =
            ids.filter(
                id =>
                    !profiles.has(id)
            );


        if (missingIds.length) {

            try {

                const {
                    data,
                    error
                } =
                    await state.supabase
                        .from("students")
                        .select("*")
                        .in(
                            "user_id",
                            missingIds
                        );

                if (!error) {

                    (data || []).forEach(
                        profile => {

                            const authId =
                                profile.user_id;

                            if (authId) {

                                profiles.set(
                                    String(authId),
                                    normalizeProfile(
                                        profile
                                    )
                                );

                            }

                        }
                    );

                }

            } catch (error) {

                console.warn(
                    "students.user_id batch lookup:",
                    error
                );

            }

        }


        state.messages =
            state.messages.map(
                message => ({

                    ...message,

                    profile:
                        profiles.get(
                            String(
                                message.user_id
                            )
                        ) ||
                        (
                            state.user &&
                            String(
                                message.user_id
                            ) ===
                            String(
                                state.user.id
                            )
                                ? state.profile
                                : null
                        )

                })
            );

    }


    /* ============================================================
       SINGLE MESSAGE PROFILE
       ============================================================ */

    async function attachSingleProfile(
        message
    ) {

        if (
            state.user &&
            String(
                message.user_id
            ) ===
            String(
                state.user.id
            )
        ) {

            message.profile =
                state.profile;

            return;

        }

        try {

            let profile =
                null;


            try {

                const {
                    data,
                    error
                } =
                    await state.supabase
                        .from("students")
                        .select("*")
                        .eq(
                            "id",
                            message.user_id
                        )
                        .maybeSingle();

                if (!error && data) {

                    profile =
                        normalizeProfile(
                            data
                        );

                }

            } catch (_) {}


            if (!profile) {

                try {

                    const {
                        data,
                        error
                    } =
                        await state.supabase
                            .from("students")
                            .select("*")
                            .eq(
                                "user_id",
                                message.user_id
                            )
                            .maybeSingle();

                    if (!error && data) {

                        profile =
                            normalizeProfile(
                                data
                            );

                    }

                } catch (_) {}

            }


            message.profile =
                profile;

        } catch (error) {

            console.warn(
                "Single profile loading failed:",
                error
            );

            message.profile =
                null;

        }

    }


    /* ============================================================
       MESSAGE RENDERING
       ============================================================ */

    function renderMessages() {

        const container =
            dom.messageList;

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        if (!state.messages.length) {

            renderWelcomeState();

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

        scrollMessagesToBottom();

    }


    function createMessageElement(
        message
    ) {

        const article =
            document.createElement(
                "article"
            );

        article.className =
            "message";

        article.dataset.messageId =
            message.id;


        /* --------------------------------------------------------
           AVATAR
           -------------------------------------------------------- */

        const avatar =
            document.createElement(
                "img"
            );

        avatar.className =
            "message-avatar";

        avatar.width =
            42;

        avatar.height =
            42;

        avatar.alt =
            "Student profile photo";


        const author =
            getProfileName(
                message.profile
            );


        const photo =
            getProfilePhoto(
                message.profile
            );


        setImage(
            avatar,
            photo,
            `${author} profile photo`
        );


        /* --------------------------------------------------------
           CONTENT
           -------------------------------------------------------- */

        const content =
            document.createElement(
                "div"
            );

        content.className =
            "message-content";


        const header =
            document.createElement(
                "div"
            );

        header.className =
            "message-header";


        const authorElement =
            document.createElement(
                "span"
            );

        authorElement.className =
            "message-author";

        authorElement.textContent =
            author;


        const time =
            document.createElement(
                "time"
            );

        time.className =
            "message-time";

        time.dateTime =
            message.created_at ||
            "";

        time.textContent =
            formatTime(
                message.created_at
            );


        header.appendChild(
            authorElement
        );

        header.appendChild(
            time
        );


        const text =
            document.createElement(
                "div"
            );

        text.className =
            "message-text";

        text.textContent =
            message.content ||
            "";


        content.appendChild(
            header
        );

        content.appendChild(
            text
        );


        article.appendChild(
            avatar
        );

        article.appendChild(
            content
        );


        return article;

    }


    function formatTime(
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

        return date.toLocaleString(
            [],
            {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
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

        if (state.sendingMessage) {
            return;
        }

        if (!state.user) {

            announce(
                "Please sign in before sending a message."
            );

            return;

        }

        if (!state.selectedChannel) {

            announce(
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

        if (dom.sendMessageButton) {

            dom.sendMessageButton.disabled =
                true;

        }

        try {

            /*
             * Confirmed safe insert schema:
             *
             * channel_id
             * user_id
             * content
             */

            const {
                data,
                error
            } =
                await state.supabase
                    .from("chat_messages")
                    .insert({

                        channel_id:
                            state.selectedChannel.id,

                        user_id:
                            state.user.id,

                        content

                    })
                    .select(`
                        id,
                        channel_id,
                        user_id,
                        content,
                        created_at
                    `)
                    .single();


            if (error) {

                console.error(
                    "Send message failed:",
                    error
                );

                announce(
                    "Message could not be sent."
                );

                return;

            }


            if (dom.messageInput) {

                dom.messageInput.value =
                    "";

            }

            autoResizeTextarea();


            if (data) {

                data.profile =
                    state.profile;


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
                        data
                    );

                    renderMessages();

                }

            }


            announce(
                "Message sent."
            );


        } catch (error) {

            console.error(
                "Send message exception:",
                error
            );

            announce(
                "Message could not be sent."
            );

        } finally {

            state.sendingMessage =
                false;

            if (dom.sendMessageButton) {

                dom.sendMessageButton.disabled =
                    false;

            }

            dom.messageInput?.focus();

        }

    }


    /* ============================================================
       REALTIME MESSAGES
       ============================================================ */

    function setupRealtime() {

        if (!state.supabase) {
            return;
        }

        if (
            state.realtimeChannel
        ) {

            try {

                state.supabase.removeChannel(
                    state.realtimeChannel
                );

            } catch (_) {}

        }

        state.realtimeChannel =
            state.supabase
                .channel(
                    "mwaniki-community-messages"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages"
                    },
                    async payload => {

                        const message =
                            payload.new;

                        if (!message) {
                            return;
                        }

                        if (
                            !state.selectedChannel ||
                            String(
                                message.channel_id
                            ) !==
                            String(
                                state.selectedChannel.id
                            )
                        ) {

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

                        if (exists) {
                            return;
                        }

                        await attachSingleProfile(
                            message
                        );

                        state.messages.push(
                            message
                        );

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

        setupPresence();

    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    async function updatePresence() {

        if (!state.user) {
            return;
        }

        const now =
            new Date().toISOString();

        try {

            const {
                error
            } =
                await state.supabase
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
                    "Presence update failed:",
                    error
                );

                return;

            }

            console.log(
                "Presence updated: online"
            );

        } catch (error) {

            console.warn(
                "Presence exception:",
                error
            );

        }

    }


    function setupPresence() {

        if (!state.user) {
            return;
        }

        if (
            state.presenceChannel
        ) {

            try {

                state.supabase.removeChannel(
                    state.presenceChannel
                );

            } catch (_) {}

        }

        state.presenceChannel =
            state.supabase
                .channel(
                    "mwaniki-presence"
                )
                .on(
                    "presence",
                    {
                        event: "sync"
                    },
                    () => {}
                )
                .subscribe(
                    async status => {

                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            try {

                                await
                                    state.presenceChannel.track(
                                        {
                                            user_id:
                                                state.user.id,

                                            online_at:
                                                new Date().toISOString()
                                        }
                                    );

                            } catch (_) {}

                        }

                    }
                );

    }


    function setupPresenceHeartbeat() {

        window.setInterval(
            () => {

                if (
                    !document.hidden &&
                    state.user
                ) {

                    updatePresence();

                }

            },
            60000
        );

    }


    /* ============================================================
       MWANIKI SCHOLARS GENERAL
       ============================================================ */

    async function showMwanikiGeneral() {

        state.selectedCommunity =
            null;

        state.selectedChannel =
            null;

        state.channels =
            [];

        state.messages =
            [];

        localStorage.removeItem(
            "mwanikiSelectedCommunity"
        );

        localStorage.removeItem(
            "mwanikiSelectedChannel"
        );

        renderCommunitySelector();

        renderCommunityRail();

        updateMainChannelHeader(
            null
        );

        renderChannels();

        renderGlobalGeneral();

        announce(
            "Mwaniki Scholars General opened."
        );

    }


    function renderGlobalGeneral() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML =
            "";

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "welcome-card";

        card.innerHTML = `
            <div
                class="welcome-icon"
                aria-hidden="true"
            >💬</div>

            <h2>Mwaniki Scholars General</h2>

            <p>
                This is the main Mwaniki Scholars
                General space. Choose a community
                to explore its channels.
            </p>
        `;

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "header-action primary";

        button.textContent =
            "Choose Community";

        button.addEventListener(
            "click",
            openCommunityModal
        );

        card.appendChild(
            button
        );

        dom.messageList.appendChild(
            card
        );

    }


    /* ============================================================
       WELCOME
       ============================================================ */

    function renderWelcomeState() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML =
            "";

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "welcome-card";

        const icon =
            document.createElement(
                "div"
            );

        icon.className =
            "welcome-icon";

        icon.textContent =
            "💬";

        const title =
            document.createElement(
                "h2"
            );

        title.textContent =
            state.selectedChannel
                ? `Welcome to ${getChannelLabel(state.selectedChannel)}`
                : "Welcome to Mwaniki Scholars";

        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "This channel has no messages yet. Start the conversation.";

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "header-action primary";

        button.textContent =
            "Start Conversation";

        button.addEventListener(
            "click",
            focusMessageInput
        );

        card.appendChild(
            icon
        );

        card.appendChild(
            title
        );

        card.appendChild(
            paragraph
        );

        card.appendChild(
            button
        );

        dom.messageList.appendChild(
            card
        );

    }


    /* ============================================================
       COMMUNITY MODAL
       ============================================================ */

    function openCommunityModal() {

        if (!dom.communityModal) {
            return;
        }

        state.modalPreviousFocus =
            document.activeElement;

        renderCommunityModal();

        dom.communityModal.classList.add(
            "open"
        );

        dom.communityModal.setAttribute(
            "aria-hidden",
            "false"
        );

        setModalExpanded(
            true
        );

        document.body.classList.add(
            "modal-open"
        );

        window.setTimeout(
            () => {

                dom.communityModalSearch?.focus();

            },
            20
        );

        announce(
            "Community selector opened."
        );

    }


    function closeCommunityModal() {

        if (!dom.communityModal) {
            return;
        }

        dom.communityModal.classList.remove(
            "open"
        );

        dom.communityModal.setAttribute(
            "aria-hidden",
            "true"
        );

        setModalExpanded(
            false
        );

        document.body.classList.remove(
            "modal-open"
        );

        if (
            state.modalPreviousFocus &&
            typeof
            state.modalPreviousFocus.focus ===
            "function"
        ) {

            state.modalPreviousFocus.focus();

        }

        state.modalPreviousFocus =
            null;

    }


    function setModalExpanded(
        value
    ) {

        [
            dom.openCommunityButton,
            dom.communitySelectorButton,
            dom.headerCommunityButton
        ]
        .filter(Boolean)
        .forEach(button => {

            button.setAttribute(
                "aria-expanded",
                String(value)
            );

        });

    }


    function renderCommunityModal() {

        const container =
            dom.communityChoiceList;

        if (!container) {
            return;
        }

        container.innerHTML =
            "";

        const query =
            state.communitySearch
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(
                community => {

                    if (!query) {
                        return true;
                    }

                    return (

                        String(
                            community.name || ""
                        )
                        .toLowerCase()
                        .includes(query) ||

                        String(
                            community.description || ""
                        )
                        .toLowerCase()
                        .includes(query)

                    );

                }
            );

        if (!communities.length) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "center-state";

            empty.textContent =
                "No communities found.";

            container.appendChild(
                empty
            );

            return;

        }

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

                button.setAttribute(
                    "role",
                    "option"
                );

                button.setAttribute(
                    "aria-label",
                    `Open ${community.name}`
                );

                const icon =
                    document.createElement(
                        "div"
                    );

                icon.className =
                    "community-choice-icon";

                renderIconContent(
                    icon,
                    community.icon_url,
                    community.name
                );

                const info =
                    document.createElement(
                        "div"
                    );

                info.className =
                    "community-choice-info";

                const name =
                    document.createElement(
                        "div"
                    );

                name.className =
                    "community-choice-name";

                name.textContent =
                    community.name;

                const description =
                    document.createElement(
                        "div"
                    );

                description.className =
                    "community-choice-description";

                description.textContent =
                    community.description ||
                    "Mwaniki Scholars community";

                info.appendChild(
                    name
                );

                info.appendChild(
                    description
                );

                button.appendChild(
                    icon
                );

                button.appendChild(
                    info
                );

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community
                        )
                );

                container.appendChild(
                    button
                );

            }
        );

    }


    /* ============================================================
       EMOJI DATABASE
       ============================================================ */

    const EMOJI_CATEGORIES = {

        Recent: [],

        Smileys: [

            "😀","😃","😄","😁","😆","😅","😂","🤣",
            "😊","😇","🙂","🙃","😉","😌","😍","🥰",
            "😘","😗","😙","😚","😋","😛","😝","😜",
            "🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳",
            "😏","😒","😞","😔","😟","😕","🙁","☹️",
            "😣","😖","😫","😩","🥺","😢","😭","😤",
            "😠","😡","🤬","🤯","😳","🥵","🥶","😱",
            "😨","😰","😥","😓","🤗","🤔","🫡","🤭",
            "🤫","🤥","😶","😐","😑","😬","🙄","😯",
            "😦","😧","😮","😲","🥱","😴","🤤","😪",
            "😵","🤐","🥴","🤢","🤮","🤧","😷","🤒",
            "🤕","🤑","🤠","😈","👿","👹","👺","🤡",
            "💩","👻","💀","☠️","👽","👾","🤖","🎃",
            "😺","😸","😹","😻","😼","😽","🙀","😿",
            "😾","🙈","🙉","🙊",

            "🫠","🫢","🫣","🫡","🫥","🫤","🥹",
            "😮‍💨","😵‍💫","🫨","🤭","🤗","🤩",
            "😶‍🌫️","😐","😑","😬","🙃","😌"

        ],

        People: [

            "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️",
            "🤞","🤟","🤘","🤙","👈","👉","👆","👇",
            "☝️","👍","👎","✊","👊","🤛","🤜","👏",
            "🙌","👐","🤲","🙏","✍️","💅","🤳","💪",
            "🦾","🦿","🦵","🦶","👂","👃","🧠","🫀",
            "🫁","🦷","🦴","👀","👁️","👅","👄","💋",

            "👶","🧒","👦","👧","🧑","👱","👨","👩",
            "🧔","👴","👵","🧓","👨‍⚕️","👩‍⚕️",
            "🧑‍⚕️","👨‍🎓","👩‍🎓","🧑‍🎓",
            "👨‍🏫","👩‍🏫","🧑‍🏫","👮","🕵️",
            "👷","💂","🥷","👸","🤴","👰","🤵",
            "🧑‍💻","👨‍💻","👩‍💻","🧑‍🔬","👨‍🔬",
            "👩‍🔬","🧑‍🚀","👨‍🚀","👩‍🚀"

        ],

        Hearts: [

            "❤️","🧡","💛","💚","💙","💜","🖤","🩷",
            "🩵","🩶","🤍","🤎","💔","❣️","💕","💞",
            "💓","💗","💖","💘","💝","💟","♥️","💌",
            "💋","❤️‍🔥","❤️‍🩹","💖","💗","💓",
            "💞","💕","💟","♥️","♦️","♣️","♠️"

        ],

        Medical: [

            "🩺","💊","💉","🩸","🧬","🧫","🧪","🔬",
            "🦠","🩹","🩻","🫀","🫁","🧠","🦷","🦴",
            "👁️","👂","👃","🧑‍⚕️","👨‍⚕️","👩‍⚕️",
            "⚕️","🚑","🏥","🩼","🩹","🧯",
            "📋","📑","📚","📖","📝","✏️","📌",
            "📍","🎓","🔎","🧫","🧬","🦠","🧪",
            "🩸","💉","💊","🩺","🩻","🫀","🫁"

        ],

        Animals: [

            "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼",
            "🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
            "🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅",
            "🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛",
            "🦋","🐌","🐞","🐜","🪲","🕷️","🦂","🐢",
            "🐍","🦎","🦖","🦕","🐙","🦑","🦀","🐠",
            "🐟","🐡","🐬","🐳","🦈","🐊","🐘","🦏",
            "🦒","🦓","🦘","🦬","🐄","🐎","🐕","🐈",
            "🐅","🐆","🦣","🦧","🦍","🦥","🦦","🦨",
            "🦫","🦔","🐇","🐿️","🦜","🦢","🦩","🦚",
            "🐋","🦭","🦐","🪼","🪸","🐚"

        ],

        Food: [

            "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇",
            "🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥",
            "🥝","🍅","🥑","🥦","🥬","🥒","🌶️","🌽",
            "🥕","🧄","🧅","🥔","🍞","🥐","🥖","🥨",
            "🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩",
            "🍗","🍔","🍟","🍕","🌭","🌮","🌯","🥗",
            "🍿","🍩","🍪","🎂","🍰","🧁","🍫","🍬",
            "🍭","☕","🍵","🥤","🧃","🧋","💧",
            "🍚","🍜","🍝","🍣","🍤","🍱","🥟","🍙",
            "🍘","🍥","🥠","🍛","🍲","🥣","🥡","🫕",
            "🥪","🌮","🌯","🫔","🥙","🧆","🥘","🍖",
            "🍫","🍮","🍯","🧂","🫙","🍽️"

        ],

        Activities: [

            "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉",
            "🥏","🎱","🏓","🏸","🏒","🏑","🥊","🥋",
            "⛳","🏹","🎣","🤿","🏆","🥇","🥈","🥉",
            "🎮","🕹️","🎲","♟️","🎯","🎳","🎨","🎭",
            "🎬","🎤","🎧","🎼","🎹","🥁","🎸","🎻",
            "🎺","🎷","🏋️","🚴","🏃","🧘","🧗",
            "🏄","🏊","🚣","🧑‍🚀","🎯","🎪","🎟️",
            "🎫","🎖️","🏅","🎗️","🎰"

        ],

        Travel: [

            "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑",
            "🚒","🚐","🛻","🚚","🚛","🚜","🛵","🏍️",
            "🚲","🛴","✈️","🛫","🛬","🚁","🚀","🛸",
            "🚢","⛵","🚤","🚂","🚆","🚇","🚉","🏠",
            "🏥","🏫","🏢","🏦","🏨","⛪","🕌","🗿",
            "🗽","🗼","🏰","🏯","🌍","🌎","🌏","🗺️",
            "🏖️","🏝️","🏕️","⛰️","🌋","🌄","🌅",
            "🌌","🌃","🏙️","🌆","🌉","🎡","🎢","🎠"

        ],

        Objects: [

            "⌚","📱","💻","⌨️","🖥️","🖨️","📷","📹",
            "🔋","🔌","💡","🔦","🕯️","📚","📖","📝",
            "✏️","🖊️","📎","📌","📍","📐","✂️","🔒",
            "🔑","🔨","🪛","⚙️","🔧","🧰","🧲","💰",
            "💳","🎁","🎈","🎉","🎊","📦","✉️","📧",
            "📞","☎️","📺","📻","🎵","🔔","📣","📢",
            "🧮","📒","📕","📗","📘","📙","📓","📔",
            "📃","📄","📜","🗂️","🗃️","🗄️","📂","📁",
            "🗑️","🖇️","📏","📎","🖋️","🖌️","🧷",
            "🔍","🔎","🔬","🔭","💡","🧭","⏰","⌛"

        ],

        Symbols: [

            "❤️","⭐","🌟","✨","⚡","🔥","💥","💯",
            "❗","❓","‼️","⁉️","⭕","❌","✅","☑️",
            "✔️","➕","➖","✖️","➗","♻️","⚠️","🚫",
            "🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪",
            "⬆️","⬇️","⬅️","➡️","↗️","↘️","↙️","↖️",
            "🔝","🔚","🔙","🔜","♾️","©️","®️","™️",
            "☀️","☁️","☔","❄️","☃️","⚡","☄️","🌈",
            "💤","💢","💦","💨","🕳️","💬","💭",
            "🔔","🔕","🔇","🔊","📣","📢","🔒","🔓",
            "🔑","🔐","⚙️","🔧","🛠️","⚕️","✳️","❇️"

        ],

        Flags: [

            "🇰🇪","🇺🇬","🇹🇿","🇷🇼","🇧🇮","🇸🇸","🇪🇹",
            "🇳🇬","🇬🇭","🇿🇦","🇿🇲","🇿🇼","🇧🇼","🇲🇼",
            "🇲🇿","🇸🇴","🇸🇩","🇪🇬","🇦🇪","🇸🇦","🇮🇳",
            "🇨🇳","🇯🇵","🇰🇷","🇦🇺","🇳🇿","🇬🇧","🇺🇸",
            "🇨🇦","🇲🇽","🇧🇷","🇦🇷","🇩🇪","🇫🇷","🇮🇹",
            "🇪🇸","🇵🇹","🇳🇱","🇧🇪","🇨🇭","🇸🇪","🇳🇴",
            "🇩🇰","🇫🇮","🇮🇪","🇺🇦","🇵🇱","🇹🇷","🇬🇷",
            "🇮🇱","🇵🇭","🇸🇬","🇲🇾","🇮🇩","🇹🇭","🇻🇳",
            "🇵🇰","🇧🇩","🇳🇵","🇱🇰","🇦🇫","🇮🇷","🇮🇶",
            "🇶🇦","🇰🇼","🇯🇴","🇱🇧","🇲🇦","🇩🇿","🇹🇳"

        ]

    };


    /* ============================================================
       EMOJI PICKER
       ============================================================ */

    function setupEmojiPicker() {

        if (!dom.emojiButton) {
            return;
        }

        dom.emojiButton.setAttribute(
            "aria-haspopup",
            "dialog"
        );

        dom.emojiButton.setAttribute(
            "aria-expanded",
            "false"
        );

        dom.emojiButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                toggleEmojiPicker();

            }
        );

    }


    function toggleEmojiPicker() {

        if (
            state.emojiPicker
        ) {

            closeEmojiPicker();

            return;

        }

        createEmojiPicker();

    }


    function createEmojiPicker() {

        closeEmojiPicker();

        const picker =
            document.createElement(
                "div"
            );

        picker.id =
            "mwanikiEmojiPicker";

        picker.className =
            "emoji-picker";

        picker.setAttribute(
            "role",
            "dialog"
        );

        picker.setAttribute(
            "aria-label",
            "Emoji keyboard"
        );


        /* SEARCH */

        const header =
            document.createElement(
                "div"
            );

        header.className =
            "emoji-picker-header";


        const search =
            document.createElement(
                "input"
            );

        search.type =
            "search";

        search.className =
            "emoji-search";

        search.placeholder =
            "Search or paste an emoji...";

        search.setAttribute(
            "aria-label",
            "Search emojis"
        );


        header.appendChild(
            search
        );

        picker.appendChild(
            header
        );


        /* CATEGORIES */

        const categories =
            document.createElement(
                "div"
            );

        categories.className =
            "emoji-categories";


        Object.keys(
            EMOJI_CATEGORIES
        )
        .forEach(
            category => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "emoji-category";

                button.title =
                    category;

                button.setAttribute(
                    "aria-label",
                    category
                );

                button.textContent =
                    getCategoryIcon(
                        category
                    );


                if (
                    category ===
                    state.emojiCategory
                ) {

                    button.classList.add(
                        "active"
                    );

                }


                button.addEventListener(
                    "click",
                    () => {

                        state.emojiCategory =
                            category;

                        renderEmojiGrid(
                            grid,
                            search.value
                        );

                        categories
                            .querySelectorAll(
                                ".emoji-category"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        button.classList.add(
                            "active"
                        );

                    }
                );


                categories.appendChild(
                    button
                );

            }
        );


        picker.appendChild(
            categories
        );


        /* GRID */

        const grid =
            document.createElement(
                "div"
            );

        grid.className =
            "emoji-grid";

        picker.appendChild(
            grid
        );


        search.addEventListener(
            "input",
            () => {

                renderEmojiGrid(
                    grid,
                    search.value
                );

            }
        );


        document.body.appendChild(
            picker
        );


        positionEmojiPicker(
            picker
        );


        state.emojiPicker =
            picker;


        dom.emojiButton.setAttribute(
            "aria-expanded",
            "true"
        );


        renderEmojiGrid(
            grid,
            ""
        );


        search.focus();


        document.addEventListener(
            "mousedown",
            emojiOutsideClick,
            true
        );


        document.addEventListener(
            "keydown",
            emojiEscape,
            true
        );

    }


    function renderEmojiGrid(
        grid,
        query
    ) {

        if (!grid) {
            return;
        }

        grid.innerHTML =
            "";

        const clean =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();

        let emojis =
            EMOJI_CATEGORIES[
                state.emojiCategory
            ] ||
            [];


        if (
            state.emojiCategory ===
            "Recent"
        ) {

            emojis =
                state.recentEmojis;

        }


        /*
         * If the user pastes/types an actual emoji,
         * find it regardless of category.
         */

        if (clean) {

            const all =
                Object.values(
                    EMOJI_CATEGORIES
                )
                .flat();


            const exactMatches =
                [
                    ...new Set(
                        all.filter(
                            emoji =>
                                emoji.includes(
                                    query
                                )
                        )
                    )
                ];


            if (exactMatches.length) {

                emojis =
                    exactMatches;

            } else {

                /*
                 * Search category names.
                 * Example:
                 * "medical"
                 * "heart"
                 * "food"
                 */

                const categoryMatch =
                    Object.keys(
                        EMOJI_CATEGORIES
                    )
                    .find(
                        category =>
                            category
                                .toLowerCase()
                                .includes(clean)
                    );


                if (categoryMatch) {

                    emojis =
                        EMOJI_CATEGORIES[
                            categoryMatch
                        ];

                } else {

                    emojis = [];

                }

            }

        }


        if (!emojis.length) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "emoji-empty";

            empty.textContent =
                "No emojis found.";

            grid.appendChild(
                empty
            );

            return;

        }


        [
            ...new Set(
                emojis
            )
        ]
        .forEach(
            emoji => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "emoji-item";

                button.textContent =
                    emoji;

                button.setAttribute(
                    "aria-label",
                    `Insert ${emoji}`
                );

                button.addEventListener(
                    "click",
                    () =>
                        insertEmoji(
                            emoji
                        )
                );

                grid.appendChild(
                    button
                );

            }
        );

    }


    function getCategoryIcon(
        category
    ) {

        const icons = {

            Recent: "🕘",

            Smileys: "😀",

            People: "🧑",

            Hearts: "❤️",

            Medical: "🩺",

            Animals: "🐶",

            Food: "🍔",

            Activities: "🎮",

            Travel: "✈️",

            Objects: "💡",

            Symbols: "🔣",

            Flags: "🇰🇪"

        };

        return (
            icons[category] ||
            "•"
        );

    }


    function positionEmojiPicker(
        picker
    ) {

        if (
            !picker ||
            !dom.emojiButton
        ) {
            return;
        }

        const rect =
            dom.emojiButton.getBoundingClientRect();

        const width =
            Math.min(
                440,
                window.innerWidth - 24
            );

        let left =
            rect.left;

        picker.style.width =
            `${width}px`;

        left =
            Math.max(
                12,
                Math.min(
                    left,
                    window.innerWidth -
                    width -
                    12
                )
            );

        picker.style.left =
            `${left}px`;

        picker.style.top =
            `${Math.max(
                12,
                rect.top - 12
            )}px`;

        picker.style.transform =
            "translateY(-100%)";

    }


    function closeEmojiPicker() {

        if (
            state.emojiPicker
        ) {

            state.emojiPicker.remove();

            state.emojiPicker =
                null;

        }

        dom.emojiButton?.setAttribute(
            "aria-expanded",
            "false"
        );

        document.removeEventListener(
            "mousedown",
            emojiOutsideClick,
            true
        );

        document.removeEventListener(
            "keydown",
            emojiEscape,
            true
        );

    }


    function emojiOutsideClick(
        event
    ) {

        if (
            state.emojiPicker &&
            !state.emojiPicker.contains(
                event.target
            ) &&
            event.target !==
            dom.emojiButton
        ) {

            closeEmojiPicker();

        }

    }


    function emojiEscape(
        event
    ) {

        if (
            event.key ===
            "Escape"
        ) {

            event.preventDefault();

            closeEmojiPicker();

            dom.emojiButton?.focus();

        }

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

        const cursor =
            start +
            emoji.length;

        input.focus();

        input.setSelectionRange(
            cursor,
            cursor
        );

        autoResizeTextarea();

        rememberEmoji(
            emoji
        );

    }


    function rememberEmoji(
        emoji
    ) {

        state.recentEmojis =
            [
                emoji,

                ...state.recentEmojis
                    .filter(
                        item =>
                            item !==
                            emoji
                    )

            ]
            .slice(
                0,
                80
            );


        EMOJI_CATEGORIES.Recent =
            state.recentEmojis;


        try {

            localStorage.setItem(
                "mwanikiRecentEmojis",
                JSON.stringify(
                    state.recentEmojis
                )
            );

        } catch (_) {}

    }


    function loadRecentEmojis() {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        "mwanikiRecentEmojis"
                    ) ||
                    "[]"
                );

            if (
                Array.isArray(saved)
            ) {

                state.recentEmojis =
                    saved;

                EMOJI_CATEGORIES.Recent =
                    saved;

            }

        } catch (_) {

            state.recentEmojis =
                [];

        }

    }


    /* ============================================================
       UI HELPERS
       ============================================================ */

    function renderChannelLoading() {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML = `
            <div class="center-state">
                <div>
                    <div
                        class="loader"
                        aria-hidden="true"
                    ></div>
                    Loading channels...
                </div>
            </div>
        `;

    }


    function showChannelError(
        detail
    ) {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML =
            "";

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "center-state";

        const wrapper =
            document.createElement(
                "div"
            );

        const title =
            document.createElement(
                "strong"
            );

        title.textContent =
            "Unable to load channels.";

        const message =
            document.createElement(
                "div"
            );

        message.style.marginTop =
            "7px";

        message.textContent =
            detail ||
            "Please try refreshing the community.";

        wrapper.appendChild(
            title
        );

        wrapper.appendChild(
            message
        );

        element.appendChild(
            wrapper
        );

        dom.channelList.appendChild(
            element
        );

    }


    function renderEmptyChannels() {

        if (!dom.channelList) {
            return;
        }

        dom.channelList.innerHTML =
            "";

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "center-state";

        element.textContent =
            state.selectedCommunity
                ? "No channels found in this community."
                : "Choose a community to see its channels.";

        dom.channelList.appendChild(
            element
        );

    }


    function renderMessageLoading() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML = `
            <div class="center-state">
                <div>
                    <div
                        class="loader"
                        aria-hidden="true"
                    ></div>
                    Loading messages...
                </div>
            </div>
        `;

    }


    function renderMessageError() {

        if (!dom.messageList) {
            return;
        }

        dom.messageList.innerHTML =
            "";

        const element =
            document.createElement(
                "div"
            );

        element.className =
            "center-state";

        element.textContent =
            "Unable to load messages.";

        dom.messageList.appendChild(
            element
        );

    }


    function showError(
        message
    ) {

        console.error(
            "Mwaniki Community:",
            message
        );

        if (dom.messageList) {

            dom.messageList.innerHTML =
                "";

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "center-state";

            element.textContent =
                message;

            dom.messageList.appendChild(
                element
            );

        }

        announce(
            message
        );

    }


    function scrollMessagesToBottom() {

        requestAnimationFrame(
            () => {

                if (
                    dom.messageList
                ) {

                    dom.messageList.scrollTop =
                        dom.messageList.scrollHeight;

                }

            }
        );

    }


    function focusMessageInput() {

        dom.messageInput?.focus();

        announce(
            "Message input focused."
        );

    }


    function autoResizeTextarea() {

        if (!dom.messageInput) {
            return;
        }

        dom.messageInput.style.height =
            "auto";

        dom.messageInput.style.height =
            `${Math.min(
                dom.messageInput.scrollHeight,
                130
            )}px`;

    }


    /* ============================================================
       ATTACHMENT
       ============================================================ */

    function handleAttachment() {

        announce(
            "Attachment upload is not enabled in this composer yet."
        );

    }


    /* ============================================================
       PROFILE / DASHBOARD NAVIGATION
       ============================================================ */

    function openProfile() {

        window.location.href =
            CONFIG.profileUrl;

    }


    function goDashboard() {

        window.location.href =
            CONFIG.dashboardUrl;

    }


    /* ============================================================
       ACCESSIBILITY
       ============================================================ */

    function setupAccessibility() {

        addAria(
            dom.homeButton,
            "Return to Mwaniki Scholars dashboard"
        );

        addAria(
            dom.railHomeButton,
            "Home"
        );

        addAria(
            dom.railGeneralButton,
            "Open Mwaniki Scholars General"
        );

        document.addEventListener(
            "keydown",
            globalKeyboard
        );

        dom.communityRailList?.addEventListener(
            "keydown",
            railKeyboard
        );

        dom.channelList?.addEventListener(
            "keydown",
            channelKeyboard
        );

        dom.communityChoiceList?.addEventListener(
            "keydown",
            communityKeyboard
        );

        dom.communityModal?.addEventListener(
            "keydown",
            modalKeyboard
        );

    }


    function globalKeyboard(
        event
    ) {

        if (
            (event.ctrlKey ||
                event.metaKey) &&
            event.key.toLowerCase() ===
            "k"
        ) {

            event.preventDefault();

            openCommunityModal();

            return;

        }

        if (
            event.key === "/" &&
            !isTyping(
                event.target
            )
        ) {

            event.preventDefault();

            dom.channelSearchInput?.focus();

        }

        if (
            event.key === "Escape"
        ) {

            if (
                dom.communityModal?.classList.contains(
                    "open"
                )
            ) {

                closeCommunityModal();

            }

        }

    }


    function isTyping(
        target
    ) {

        const tag =
            target?.tagName?.toLowerCase();

        return (

            tag === "input" ||

            tag === "textarea" ||

            target?.isContentEditable

        );

    }


    function railKeyboard(
        event
    ) {

        const buttons =
            [
                ...dom.communityRailList
                    .querySelectorAll(
                        "button"
                    )
            ];

        const index =
            buttons.indexOf(
                document.activeElement
            );

        if (index < 0) {
            return;
        }

        let next =
            index;

        if (
            event.key ===
            "ArrowDown"
        ) {

            next =
                (index + 1) %
                buttons.length;

        } else if (
            event.key ===
            "ArrowUp"
        ) {

            next =
                (
                    index -
                    1 +
                    buttons.length
                ) %
                buttons.length;

        } else {

            return;

        }

        event.preventDefault();

        buttons[next].focus();

    }


    function channelKeyboard(
        event
    ) {

        const buttons =
            [
                ...dom.channelList
                    .querySelectorAll(
                        "button"
                    )
            ];

        const index =
            buttons.indexOf(
                document.activeElement
            );

        if (index < 0) {
            return;
        }

        let next =
            index;

        if (
            event.key ===
            "ArrowDown"
        ) {

            next =
                Math.min(
                    index + 1,
                    buttons.length - 1
                );

        } else if (
            event.key ===
            "ArrowUp"
        ) {

            next =
                Math.max(
                    index - 1,
                    0
                );

        } else {

            return;

        }

        event.preventDefault();

        buttons[next].focus();

    }


    function communityKeyboard(
        event
    ) {

        const buttons =
            [
                ...dom.communityChoiceList
                    .querySelectorAll(
                        "button"
                    )
            ];

        const index =
            buttons.indexOf(
                document.activeElement
            );

        if (index < 0) {
            return;
        }

        let next =
            index;

        if (
            event.key ===
            "ArrowDown"
        ) {

            next =
                Math.min(
                    index + 1,
                    buttons.length - 1
                );

        } else if (
            event.key ===
            "ArrowUp"
        ) {

            next =
                Math.max(
                    index - 1,
                    0
                );

        } else {

            return;

        }

        event.preventDefault();

        buttons[next].focus();

    }


    function modalKeyboard(
        event
    ) {

        if (
            event.key !== "Tab"
        ) {
            return;
        }

        const focusable =
            [
                ...dom.communityModal
                    .querySelectorAll(
                        "button,input,textarea,select,[tabindex]:not([tabindex='-1'])"
                    )
            ]
            .filter(
                item =>
                    !item.disabled &&
                    item.offsetParent !== null
            );

        if (!focusable.length) {
            return;
        }

        const first =
            focusable[0];

        const last =
            focusable[
                focusable.length - 1
            ];

        if (
            event.shiftKey &&
            document.activeElement === first
        ) {

            event.preventDefault();

            last.focus();

        } else if (
            !event.shiftKey &&
            document.activeElement === last
        ) {

            event.preventDefault();

            first.focus();

        }

    }


    function addAria(
        element,
        label
    ) {

        if (!element) {
            return;
        }

        if (
            !element.hasAttribute(
                "aria-label"
            )
        ) {

            element.setAttribute(
                "aria-label",
                label
            );

        }

    }


    /* ============================================================
       EVENTS
       ============================================================ */

    function bindEvents() {

        dom.homeButton?.addEventListener(
            "click",
            goDashboard
        );

        dom.dashboardButton?.addEventListener(
            "click",
            goDashboard
        );

        dom.railHomeButton?.addEventListener(
            "click",
            goDashboard
        );

        dom.railGeneralButton?.addEventListener(
            "click",
            showMwanikiGeneral
        );

        dom.railProfileButton?.addEventListener(
            "click",
            openProfile
        );

        dom.sidebarProfileButton?.addEventListener(
            "click",
            openProfile
        );

        dom.openCommunityButton?.addEventListener(
            "click",
            openCommunityModal
        );

        dom.communitySelectorButton?.addEventListener(
            "click",
            openCommunityModal
        );

        dom.headerCommunityButton?.addEventListener(
            "click",
            openCommunityModal
        );

        dom.closeCommunityModal?.addEventListener(
            "click",
            closeCommunityModal
        );

        dom.communityModal?.addEventListener(
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


        /* CHANNEL SEARCH */

        dom.channelSearchInput?.addEventListener(
            "input",
            event => {

                state.channelSearch =
                    event.target.value;

                renderChannels();

            }
        );


        /* COMMUNITY SEARCH */

        dom.communityModalSearch?.addEventListener(
            "input",
            event => {

                state.communitySearch =
                    event.target.value;

                renderCommunityModal();

            }
        );


        /* MESSAGE FORM */

        dom.messageForm?.addEventListener(
            "submit",
            sendMessage
        );


        dom.messageInput?.addEventListener(
            "input",
            autoResizeTextarea
        );


        dom.messageInput?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.isComposing
                ) {

                    event.preventDefault();

                    sendMessage();

                }

            }
        );


        dom.attachButton?.addEventListener(
            "click",
            handleAttachment
        );


        dom.startConversationButton?.addEventListener(
            "click",
            focusMessageInput
        );


        dom.welcomeStartButton?.addEventListener(
            "click",
            focusMessageInput
        );


        /* PRESENCE */

        document.addEventListener(
            "visibilitychange",
            () => {

                if (!document.hidden) {

                    updatePresence();

                }

            }
        );


        /* RESIZE */

        window.addEventListener(
            "resize",
            () => {

                if (
                    state.emojiPicker
                ) {

                    positionEmojiPicker(
                        state.emojiPicker
                    );

                }

            }
        );


        /* EXIT */

        window.addEventListener(
            "beforeunload",
            () => {

                setOfflinePresence();

            }
        );

    }


    /* ============================================================
       OFFLINE PRESENCE
       ============================================================ */

    function setOfflinePresence() {

        if (
            !state.user ||
            !state.supabase
        ) {
            return;
        }

        try {

            state.supabase
                .from("chat_presence")
                .update({

                    status:
                        "offline",

                    last_seen_at:
                        new Date().toISOString(),

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "user_id",
                    state.user.id
                );

        } catch (_) {}

    }


    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.MwanikiCommunity = {

        state,

        refresh: async () => {

            await loadCommunities();

            renderCommunityRail();

            renderCommunityModal();

            if (
                state.selectedCommunity
            ) {

                await loadChannels(
                    state.selectedCommunity.id
                );

            }

        },

        refreshMessages:
            async () => {

                if (
                    state.selectedChannel
                ) {

                    await loadMessages(
                        state.selectedChannel.id
                    );

                }

            },

        openCommunitySelector:
            openCommunityModal,

        closeCommunitySelector:
            closeCommunityModal,

        sendMessage

    };


    /* ============================================================
       START
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            async () => {

                loadRecentEmojis();

                await init();

            },
            {
                once: true
            }
        );

    } else {

        loadRecentEmojis();

        init();

    }

})();
