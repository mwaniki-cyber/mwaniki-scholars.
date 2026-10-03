/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   =========================================================

   IMPORTANT:

   This file handles:

   - Communities
   - Channels
   - Messages
   - Message history
   - Sender profiles
   - Reactions
   - Attachments
   - GIF messages
   - Emoji picker
   - Message deletion
   - Community rules

   IT DOES NOT HANDLE WEBRTC CALLS.

   Calls are handled separately by call.js.
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       CONFIG
       ===================================================== */

    const RULES_KEY =
        "mwanikiCommunityRulesAccepted_v1";

    const ATTACHMENT_BUCKET =
        "chat-attachments";

    const PAGE_SIZE =
        100;


    /* =====================================================
       WAIT FOR SUPABASE
       ===================================================== */

    function waitForSupabase() {

        return new Promise(resolve => {

            if (window.supabase) {

                resolve(window.supabase);

                return;
            }


            const timer =
                setInterval(() => {

                    if (window.supabase) {

                        clearInterval(timer);

                        resolve(
                            window.supabase
                        );

                    }

                }, 50);

        });

    }


    /* =====================================================
       MAIN
       ===================================================== */

    waitForSupabase()
        .then(startCommunity)
        .catch(error => {

            console.error(
                "Community initialization failed:",
                error
            );

        });


    async function startCommunity(supabase) {


        /* =================================================
           STATE
           ================================================= */

        const state = {

            user: null,

            profile: null,

            communities: [],

            channels: [],

            currentCommunity: null,

            currentChannel: null,

            messages: [],

            messageProfiles: new Map(),

            messageAttachments: new Map(),

            messageReactions: new Map(),

            messagePage: 0,

            loadingMessages: false,

            hasOlderMessages: true,

            messageSubscription: null,

            reactionSubscription: null,

            profileCache: new Map(),

            currentReplyTo: null,

            selectedGifUrl: null

        };


        /* =================================================
           DOM
           ================================================= */

        const $ = id =>
            document.getElementById(id);


        const rulesGate =
            $("communityRulesGate");

        const rulesAgreement =
            $("communityRulesAgreement");

        const acceptRulesButton =
            $("acceptCommunityRulesButton");

        const rulesGateMessage =
            $("rulesGateMessage");

        const messageList =
            $("messageList");

        const messageEmptyState =
            $("messageEmptyState");

        const messageForm =
            $("messageForm");

        const messageInput =
            $("messageInput");

        const attachmentInput =
            $("attachmentInput");

        const emojiPicker =
            $("emojiPicker");

        const emojiGrid =
            $("emojiGrid");

        const gifPicker =
            $("gifPicker");

        const gifUrlInput =
            $("gifUrlInput");

        const gifPreview =
            $("gifPreview");

        const sendGifButton =
            $("sendGifButton");

        const communityToast =
            $("communityToast");


        /* =================================================
           BASIC UTILITIES
           ================================================= */

        function announce(message) {

            const element =
                $("accessibilityAnnouncer");

            if (element) {

                element.textContent =
                    message;

            }

        }


        function toast(message) {

            if (!communityToast) {

                console.log(
                    "[Community]",
                    message
                );

                return;
            }

            communityToast.textContent =
                message;

            communityToast.classList.add(
                "show"
            );

            clearTimeout(
                toast.timer
            );

            toast.timer =
                setTimeout(() => {

                    communityToast.classList.remove(
                        "show"
                    );

                }, 3000);

        }


        function escapeHtml(value) {

            const div =
                document.createElement(
                    "div"
                );

            div.textContent =
                value ?? "";

            return div.innerHTML;

        }


        function isUrl(value) {

            try {

                const url =
                    new URL(value);

                return (
                    url.protocol === "http:" ||
                    url.protocol === "https:"
                );

            } catch {

                return false;

            }

        }


        function isGifUrl(value) {

            if (!isUrl(value)) {
                return false;
            }

            const lower =
                value.toLowerCase();

            return (
                lower.includes(".gif") ||
                lower.includes("giphy.com") ||
                lower.includes("tenor.com")
            );

        }


        function formatTime(dateValue) {

            const date =
                new Date(dateValue);

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
                    hour: "numeric",
                    minute: "2-digit"
                }
            ).format(date);

        }


        function formatDate(dateValue) {

            const date =
                new Date(dateValue);

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
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            ).format(date);

        }


        function createInitialAvatar(name) {

            const clean =
                String(name || "User")
                    .trim();

            const parts =
                clean.split(/\s+/);

            const initials =
                (
                    parts[0]?.[0] || "U"
                ) +
                (
                    parts[1]?.[0] || ""
                );

            const svg =
                `
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
                        y="92"
                        text-anchor="middle"
                        font-family="Arial"
                        font-size="52"
                        font-weight="700"
                        fill="white"
                    >
                        ${escapeHtml(
                            initials.toUpperCase()
                        )}
                    </text>
                </svg>
                `;

            return (
                "data:image/svg+xml;charset=UTF-8," +
                encodeURIComponent(svg)
            );

        }


        function profileName(profile, userId) {

            if (
                profile?.full_name &&
                profile.full_name.trim()
            ) {

                return profile.full_name.trim();

            }


            if (
                profile?.email &&
                profile.email.trim()
            ) {

                return profile.email
                    .split("@")[0];

            }


            if (
                state.user?.id === userId &&
                state.user?.email
            ) {

                return state.user.email
                    .split("@")[0];

            }


            return "Mwaniki Scholar";

        }


        function profilePhoto(profile, name) {

            if (
                profile?.photo_url &&
                isUrl(profile.photo_url)
            ) {

                return profile.photo_url;

            }


            if (
                profile?.avatar_url &&
                isUrl(profile.avatar_url)
            ) {

                return profile.avatar_url;

            }


            return createInitialAvatar(
                name
            );

        }


        /* =================================================
           AUTH
           ================================================= */

        async function loadCurrentUser() {

            const {
                data,
                error
            } =
                await supabase.auth.getUser();


            if (error) {

                console.error(
                    "Auth error:",
                    error
                );

                return null;

            }


            state.user =
                data?.user || null;


            return state.user;

        }


        /* =================================================
           STUDENT PROFILE
           =================================================

           IMPORTANT:

           The project uses:

           students.id = auth.users.id

           students.full_name
           students.email
           students.course
           students.level
           students.photo_url
           ================================================= */

        async function loadProfiles(userIds) {

            const uniqueIds =
                [
                    ...new Set(
                        (userIds || [])
                            .filter(Boolean)
                    )
                ];


            if (!uniqueIds.length) {

                return;

            }


            const missingIds =
                uniqueIds.filter(
                    id =>
                        !state.profileCache.has(id)
                );


            if (!missingIds.length) {

                return;

            }


            const {
                data,
                error
            } =
                await supabase
                    .from("students")
                    .select(
                        "id,full_name,email,course,level,photo_url"
                    )
                    .in(
                        "id",
                        missingIds
                    );


            if (error) {

                console.error(
                    "Student profile error:",
                    error
                );

                /*
                 * Do not destroy the chat if a profile
                 * cannot be read.
                 */

                return;

            }


            for (
                const profile
                of data || []
            ) {

                state.profileCache.set(
                    profile.id,
                    profile
                );

            }

        }


        async function loadOwnProfile() {

            if (!state.user) {
                return;
            }


            const {
                data,
                error
            } =
                await supabase
                    .from("students")
                    .select(
                        "id,full_name,email,course,level,photo_url"
                    )
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Own profile error:",
                    error
                );

            }


            state.profile =
                data || null;


            if (data) {

                state.profileCache.set(
                    state.user.id,
                    data
                );

            }


            updateOwnProfileUI();

        }


        function updateOwnProfileUI() {

            const name =
                profileName(
                    state.profile,
                    state.user?.id
                );

            const photo =
                profilePhoto(
                    state.profile,
                    name
                );


            const railAvatar =
                $("railProfileAvatar");

            const sidebarAvatar =
                $("sidebarProfileAvatar");

            const sidebarName =
                $("sidebarProfileName");


            if (railAvatar) {

                railAvatar.src =
                    photo;

            }


            if (sidebarAvatar) {

                sidebarAvatar.src =
                    photo;

            }


            if (sidebarName) {

                sidebarName.textContent =
                    name;

            }

        }


        /* =================================================
           RULES
           ================================================= */

        function hasAcceptedRules() {

            return (
                localStorage.getItem(
                    RULES_KEY
                ) === "accepted"
            );

        }


        function showRulesGate() {

            if (!rulesGate) {
                return;
            }

            rulesGate.classList.remove(
                "hidden"
            );

            document.body.style.overflow =
                "hidden";

        }


        function hideRulesGate() {

            if (!rulesGate) {
                return;
            }

            rulesGate.classList.add(
                "hidden"
            );

            document.body.style.overflow =
                "";

        }


        function setupRules() {

            if (hasAcceptedRules()) {

                hideRulesGate();

            } else {

                showRulesGate();

            }


            rulesAgreement?.addEventListener(
                "change",
                () => {

                    if (acceptRulesButton) {

                        acceptRulesButton.disabled =
                            !rulesAgreement.checked;

                    }

                }
            );


            acceptRulesButton?.addEventListener(
                "click",
                () => {

                    if (
                        !rulesAgreement?.checked
                    ) {

                        rulesGateMessage.textContent =
                            "Please read and agree to the rules.";

                        return;

                    }


                    localStorage.setItem(
                        RULES_KEY,
                        "accepted"
                    );


                    hideRulesGate();

                    announce(
                        "Community rules accepted."
                    );

                }
            );

        }


        /* =================================================
           COMMUNITY ICON
           ================================================= */

        function renderIcon(
            container,
            iconValue,
            fallback = "🌐"
        ) {

            if (!container) {
                return;
            }


            container.innerHTML =
                "";


            const value =
                String(
                    iconValue || ""
                ).trim();


            /*
             * Only treat actual URLs as images.
             *
             * This prevents:
             *
             * 🎮
             * 😂
             * 📚
             *
             * from becoming broken image URLs.
             */

            if (isUrl(value)) {

                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    value;

                image.alt =
                    "";

                image.onerror =
                    () => {

                        container.textContent =
                            fallback;

                    };

                container.appendChild(
                    image
                );

            } else {

                container.textContent =
                    value || fallback;

            }

        }


        /* =================================================
           COMMUNITIES
           ================================================= */

        async function loadCommunities() {

            const {
                data: publicCommunities,
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

                console.error(
                    "Community loading error:",
                    error
                );

                toast(
                    "Unable to load communities."
                );

                return;

            }


            let memberships = [];


            if (state.user) {

                const {
                    data,
                    error:
                        membershipError
                } =
                    await supabase
                        .from(
                            "chat_community_members"
                        )
                        .select(
                            "community_id,role,is_muted,is_banned"
                        )
                        .eq(
                            "user_id",
                            state.user.id
                        );


                if (
                    membershipError
                ) {

                    console.warn(
                        "Membership loading warning:",
                        membershipError
                    );

                } else {

                    memberships =
                        data || [];

                }

            }


            const membershipMap =
                new Map(
                    memberships.map(
                        item =>
                            [
                                item.community_id,
                                item
                            ]
                    )
                );


            state.communities =
                (publicCommunities || [])
                    .map(community => ({
                        ...community,
                        membership:
                            membershipMap.get(
                                community.id
                            ) || null
                    }))
                    .filter(community => {

                        if (
                            community.is_public
                        ) {

                            return true;

                        }


                        return Boolean(
                            community.membership
                        );

                    });


            renderCommunityRail();

            renderCommunityModal();

        }


        function renderCommunityRail() {

            const rail =
                $("communityRailList");

            if (!rail) {
                return;
            }


            rail.innerHTML =
                "";


            for (
                const community
                of state.communities
            ) {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-rail-item";


                if (
                    state.currentCommunity?.id ===
                    community.id
                ) {

                    button.classList.add(
                        "active"
                    );

                }


                button.title =
                    community.name;


                if (
                    isUrl(
                        community.icon_url
                    )
                ) {

                    const image =
                        document.createElement(
                            "img"
                        );

                    image.src =
                        community.icon_url;

                    image.alt =
                        community.name;

                    button.appendChild(
                        image
                    );

                } else {

                    button.textContent =
                        community.icon_url ||
                        community.name
                            ?.charAt(0)
                            .toUpperCase() ||
                        "C";

                }


                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community
                        )
                );


                rail.appendChild(
                    button
                );

            }

        }


        function renderCommunityModal(
            filter = ""
        ) {

            const list =
                $("communityChoiceList");

            if (!list) {
                return;
            }


            list.innerHTML =
                "";


            const query =
                filter
                    .trim()
                    .toLowerCase();


            const communities =
                state.communities.filter(
                    community =>
                        !query ||
                        community.name
                            ?.toLowerCase()
                            .includes(query) ||
                        community.description
                            ?.toLowerCase()
                            .includes(query)
                );


            if (!communities.length) {

                const empty =
                    document.createElement(
                        "p"
                    );

                empty.className =
                    "message-deleted";

                empty.textContent =
                    "No communities found.";

                list.appendChild(
                    empty
                );

                return;

            }


            for (
                const community
                of communities
            ) {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-choice";


                const icon =
                    document.createElement(
                        "div"
                    );

                icon.className =
                    "community-choice-icon";


                renderIcon(
                    icon,
                    community.icon_url,
                    "🌐"
                );


                const info =
                    document.createElement(
                        "div"
                    );

                info.className =
                    "community-choice-info";


                const name =
                    document.createElement(
                        "strong"
                    );

                name.textContent =
                    community.name;


                const description =
                    document.createElement(
                        "span"
                    );

                description.textContent =
                    community.description ||
                    "Academic community";


                info.appendChild(name);
                info.appendChild(description);


                button.appendChild(icon);
                button.appendChild(info);


                button.addEventListener(
                    "click",
                    () => {

                        selectCommunity(
                            community
                        );

                        closeCommunityModal();

                    }
                );


                list.appendChild(
                    button
                );

            }

        }


        async function selectCommunity(
            community
        ) {

            if (!hasAcceptedRules()) {

                showRulesGate();

                return;

            }


            state.currentCommunity =
                community;


            renderCommunityRail();


            const icon =
                $("selectedCommunityIcon");

            renderIcon(
                icon,
                community.icon_url,
                "🌐"
            );


            const name =
                $("selectedCommunityName");

            const description =
                $("selectedCommunityDescription");


            if (name) {

                name.textContent =
                    community.name;

            }


            if (description) {

                description.textContent =
                    community.description ||
                    "Academic community";

            }


            await loadChannels(
                community.id
            );

        }


        /* =================================================
           CHANNELS
           ================================================= */

        async function loadChannels(
            communityId
        ) {

            const {
                data,
                error
            } =
                await supabase
                    .from("chat_channels")
                    .select("*")
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


            if (error) {

                console.error(
                    "Channel loading error:",
                    error
                );

                toast(
                    "Unable to load channels."
                );

                return;

            }


            let channels =
                data || [];


            /*
             * Private channels require membership.
             */

            const privateChannels =
                channels.filter(
                    channel =>
                        channel.is_private
                );


            if (
                privateChannels.length &&
                state.user
            ) {

                const {
                    data:
                        memberships
                } =
                    await supabase
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


                const allowed =
                    new Set(
                        (
                            memberships || []
                        ).map(
                            item =>
                                item.channel_id
                        )
                    );


                channels =
                    channels.filter(
                        channel =>
                            !channel.is_private ||
                            allowed.has(
                                channel.id
                            )
                    );

            }


            state.channels =
                channels;


            renderChannels();

            renderChannelSearch();


            if (
                !state.currentChannel ||
                !state.channels.some(
                    channel =>
                        channel.id ===
                        state.currentChannel.id
                )
            ) {

                const first =
                    state.channels[0];

                if (first) {

                    await selectChannel(
                        first
                    );

                } else {

                    showEmptyChannel();

                }

            } else {

                await selectChannel(
                    state.currentChannel
                );

            }

        }


        function renderChannels(
            filter = ""
        ) {

            const list =
                $("channelList");

            if (!list) {
                return;
            }


            list.innerHTML =
                "";


            const query =
                filter
                    .trim()
                    .toLowerCase();


            const channels =
                state.channels.filter(
                    channel =>
                        !query ||
                        channel.name
                            ?.toLowerCase()
                            .includes(query) ||
                        channel.description
                            ?.toLowerCase()
                            .includes(query)
                );


            const groups =
                new Map();


            for (
                const channel
                of channels
            ) {

                const category =
                    channel.category ||
                    "Channels";


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


            for (
                const [
                    category,
                    categoryChannels
                ]
                of groups
            ) {

                const heading =
                    document.createElement(
                        "div"
                    );

                heading.className =
                    "channel-category";

                heading.textContent =
                    category;

                list.appendChild(
                    heading
                );


                for (
                    const channel
                    of categoryChannels
                ) {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";

                    button.className =
                        "channel-item";


                    if (
                        state.currentChannel?.id ===
                        channel.id
                    ) {

                        button.classList.add(
                            "active"
                        );

                    }


                    const icon =
                        document.createElement(
                            "span"
                        );

                    icon.className =
                        "channel-icon";

                    icon.textContent =
                        channel.icon ||
                        (
                            channel.channel_type ===
                            "voice"
                                ? "🔊"
                                : "#"
                        );


                    const name =
                        document.createElement(
                            "span"
                        );

                    name.className =
                        "channel-name";

                    name.textContent =
                        channel.name;


                    button.appendChild(
                        icon
                    );

                    button.appendChild(
                        name
                    );


                    button.addEventListener(
                        "click",
                        () =>
                            selectChannel(
                                channel
                            )
                    );


                    list.appendChild(
                        button
                    );

                }

            }

        }


        function renderChannelSearch() {

            const input =
                $("channelSearchInput");

            if (!input) {
                return;
            }

            input.value =
                "";

        }


        async function selectChannel(
            channel
        ) {

            if (!hasAcceptedRules()) {

                showRulesGate();

                return;

            }


            state.currentChannel =
                channel;


            renderChannels(
                $("channelSearchInput")
                    ?.value || ""
            );


            const title =
                $("mainChannelTitle");

            const description =
                $("mainChannelDescription");

            const icon =
                $("mainChannelIcon");


            if (title) {

                title.textContent =
                    channel.name;

            }


            if (description) {

                description.textContent =
                    channel.description ||
                    "Academic discussion";

            }


            if (icon) {

                icon.textContent =
                    channel.icon ||
                    "#";

            }


            await subscribeToMessages();

            await loadMessages(
                true
            );

        }


        function showEmptyChannel() {

            state.currentChannel =
                null;

            messageList.innerHTML =
                "";

            messageEmptyState?.classList.add(
                "visible"
            );

        }


        /* =================================================
           MESSAGE REALTIME
           ================================================= */

        async function subscribeToMessages() {

            if (
                state.messageSubscription
            ) {

                await supabase.removeChannel(
                    state.messageSubscription
                );

            }


            if (!state.currentChannel) {
                return;
            }


            state.messageSubscription =
                supabase
                    .channel(
                        `community-messages-${state.currentChannel.id}`
                    )
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "chat_messages",
                            filter:
                                `channel_id=eq.${state.currentChannel.id}`
                        },
                        async payload => {

                            await handleMessageRealtime(
                                payload
                            );

                        }
                    )
                    .subscribe();


            if (
                state.reactionSubscription
            ) {

                await supabase.removeChannel(
                    state.reactionSubscription
                );

            }


            state.reactionSubscription =
                supabase
                    .channel(
                        `community-reactions-${state.currentChannel.id}`
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

                            if (
                                payload.new?.message_id &&
                                state.messages.some(
                                    message =>
                                        message.id ===
                                        payload.new.message_id
                                )
                            ) {

                                await loadReactions(
                                    state.messages.map(
                                        message =>
                                            message.id
                                    )
                                );

                                renderMessages();

                            }

                        }
                    )
                    .subscribe();

        }


        async function handleMessageRealtime(
            payload
        ) {

            const message =
                payload.new;


            if (
                payload.eventType ===
                "DELETE"
            ) {

                state.messages =
                    state.messages.filter(
                        item =>
                            item.id !==
                            payload.old.id
                    );

                renderMessages();

                return;

            }


            if (
                !message ||
                message.channel_id !==
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
                            item.id ===
                            message.id
                    );


                if (!exists) {

                    state.messages.push(
                        message
                    );

                }


                await loadProfiles([
                    message.user_id
                ]);

                await loadAttachments([
                    message.id
                ]);

                await loadReactions([
                    message.id
                ]);

                renderMessages();

                scrollToBottom();

            }


            if (
                payload.eventType ===
                "UPDATE"
            ) {

                state.messages =
                    state.messages.map(
                        item =>
                            item.id ===
                            message.id
                                ? {
                                    ...item,
                                    ...message
                                }
                                : item
                    );


                await loadReactions([
                    message.id
                ]);

                renderMessages();

            }

        }


        /* =================================================
           MESSAGE HISTORY
           ================================================= */

        async function loadMessages(
            reset = false
        ) {

            if (
                state.loadingMessages ||
                !state.currentChannel
            ) {

                return;

            }


            state.loadingMessages =
                true;


            try {

                if (reset) {

                    state.messagePage =
                        0;

                    state.hasOlderMessages =
                        true;

                    state.messages =
                        [];

                    state.messageAttachments.clear();

                    state.messageReactions.clear();

                    messageList.innerHTML =
                        "";

                }


                const from =
                    state.messagePage *
                    PAGE_SIZE;

                const to =
                    from +
                    PAGE_SIZE -
                    1;


                const {
                    data,
                    error
                } =
                    await supabase
                        .from(
                            "chat_messages"
                        )
                        .select("*")
                        .eq(
                            "channel_id",
                            state.currentChannel.id
                        )
                        .order(
                            "created_at",
                            {
                                ascending: false
                            }
                        )
                        .range(
                            from,
                            to
                        );


                if (error) {

                    console.error(
                        "Message history error:",
                        error
                    );

                    toast(
                        "Unable to load message history."
                    );

                    return;

                }


                const rows =
                    data || [];


                if (
                    rows.length <
                    PAGE_SIZE
                ) {

                    state.hasOlderMessages =
                        false;

                }


                state.messagePage++;


                if (reset) {

                    state.messages =
                        rows.reverse();

                } else {

                    /*
                     * Older messages were returned newest-first.
                     * Put them before the current messages.
                     */

                    state.messages =
                        [
                            ...rows.reverse(),
                            ...state.messages
                        ];

                }


                const userIds =
                    state.messages
                        .map(
                            message =>
                                message.user_id
                        )
                        .filter(Boolean);


                await loadProfiles(
                    userIds
                );


                const messageIds =
                    state.messages.map(
                        message =>
                            message.id
                    );


                await loadAttachments(
                    messageIds
                );

                await loadReactions(
                    messageIds
                );


                renderMessages();


                updateHistoryButton();


                if (reset) {

                    scrollToBottom();

                }

            } finally {

                state.loadingMessages =
                    false;

            }

        }


        function updateHistoryButton() {

            const button =
                $("loadOlderMessagesButton");

            if (!button) {
                return;
            }


            button.classList.toggle(
                "hidden",
                !state.hasOlderMessages
            );

        }


        /* =================================================
           ATTACHMENTS
           ================================================= */

        async function loadAttachments(
            messageIds
        ) {

            if (!messageIds?.length) {
                return;
            }


            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "chat_attachments"
                    )
                    .select("*")
                    .in(
                        "message_id",
                        messageIds
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "Attachment loading error:",
                    error
                );

                return;

            }


            for (
                const attachment
                of data || []
            ) {

                if (
                    !state.messageAttachments.has(
                        attachment.message_id
                    )
                ) {

                    state.messageAttachments.set(
                        attachment.message_id,
                        []
                    );

                }


                state.messageAttachments
                    .get(
                        attachment.message_id
                    )
                    .push(
                        attachment
                    );

            }

        }


        /* =================================================
           REACTIONS
           ================================================= */

        async function loadReactions(
            messageIds
        ) {

            if (!messageIds?.length) {
                return;
            }


            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "chat_message_reactions"
                    )
                    .select(
                        "id,message_id,user_id,reaction"
                    )
                    .in(
                        "message_id",
                        messageIds
                    );


            if (error) {

                console.error(
                    "Reaction loading error:",
                    error
                );

                return;

            }


            for (
                const messageId
                of messageIds
            ) {

                state.messageReactions.set(
                    messageId,
                    []
                );

            }


            for (
                const reaction
                of data || []
            ) {

                state.messageReactions
                    .get(
                        reaction.message_id
                    )
                    ?.push(
                        reaction
                    );

            }

        }


        async function toggleReaction(
            messageId,
            emoji
        ) {

            if (!state.user) {
                return;
            }


            const reactions =
                state.messageReactions.get(
                    messageId
                ) || [];


            const mine =
                reactions.find(
                    reaction =>
                        reaction.user_id ===
                            state.user.id &&
                        reaction.reaction ===
                            emoji
                );


            if (mine) {

                const {
                    error
                } =
                    await supabase
                        .from(
                            "chat_message_reactions"
                        )
                        .delete()
                        .eq(
                            "id",
                            mine.id
                        );


                if (error) {

                    console.error(
                        "Reaction removal error:",
                        error
                    );

                    toast(
                        "Unable to remove reaction."
                    );

                    return;

                }

            } else {

                const {
                    error
                } =
                    await supabase
                        .from(
                            "chat_message_reactions"
                        )
                        .insert({

                            message_id:
                                messageId,

                            user_id:
                                state.user.id,

                            reaction:
                                emoji

                        });


                if (error) {

                    console.error(
                        "Reaction insert error:",
                        error
                    );

                    toast(
                        "Unable to add reaction."
                    );

                    return;

                }

            }


            await loadReactions([
                messageId
            ]);

            renderMessages();

        }


        /* =================================================
           RENDER MESSAGES
           ================================================= */

        function renderMessages() {

            if (!messageList) {
                return;
            }


            messageList.innerHTML =
                "";


            messageEmptyState?.classList.toggle(
                "visible",
                state.messages.length === 0
            );


            if (!state.messages.length) {
                return;
            }


            for (
                const message
                of state.messages
            ) {

                renderMessage(
                    message
                );

            }

        }


        function renderMessage(
            message
        ) {

            const wrapper =
                document.createElement(
                    "article"
                );

            wrapper.className =
                "message-group";

            wrapper.dataset.messageId =
                message.id;


            const profile =
                state.profileCache.get(
                    message.user_id
                );


            const name =
                profileName(
                    profile,
                    message.user_id
                );


            const photo =
                profilePhoto(
                    profile,
                    name
                );


            const avatar =
                document.createElement(
                    "img"
                );

            avatar.className =
                "message-avatar";

            avatar.src =
                photo;

            avatar.alt =
                `${name} profile photo`;


            const body =
                document.createElement(
                    "div"
                );

            body.className =
                "message-body";


            const meta =
                document.createElement(
                    "div"
                );

            meta.className =
                "message-meta";


            const author =
                document.createElement(
                    "span"
                );

            author.className =
                "message-author";

            author.textContent =
                name;


            const time =
                document.createElement(
                    "time"
                );

            time.className =
                "message-time";

            time.textContent =
                `${formatDate(message.created_at)} · ${formatTime(message.created_at)}`;


            meta.appendChild(
                author
            );

            meta.appendChild(
                time
            );


            body.appendChild(
                meta
            );


            if (
                message.parent_message_id
            ) {

                const parent =
                    state.messages.find(
                        item =>
                            item.id ===
                            message.parent_message_id
                    );


                if (parent) {

                    const parentProfile =
                        state.profileCache.get(
                            parent.user_id
                        );


                    const parentName =
                        profileName(
                            parentProfile,
                            parent.user_id
                        );


                    const reply =
                        document.createElement(
                            "div"
                        );

                    reply.className =
                        "reply-indicator";

                    reply.textContent =
                        `Replying to ${parentName}`;

                    body.appendChild(
                        reply
                    );

                }

            }


            if (
                message.is_deleted
            ) {

                const deleted =
                    document.createElement(
                        "div"
                    );

                deleted.className =
                    "message-content message-deleted";

                deleted.textContent =
                    "This message was deleted.";

                body.appendChild(
                    deleted
                );

            } else {

                if (
                    message.content
                ) {

                    const content =
                        document.createElement(
                            "div"
                        );

                    content.className =
                        "message-content";

                    content.textContent =
                        message.content;

                    body.appendChild(
                        content
                    );

                }


                renderMessageAttachments(
                    body,
                    message
                );

            }


            renderReactions(
                body,
                message
            );


            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "message-actions";


            const reactButton =
                document.createElement(
                    "button"
                );

            reactButton.type =
                "button";

            reactButton.className =
                "message-action";

            reactButton.textContent =
                "😊 React";


            reactButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    openReactionMenu(
                        reactButton,
                        message.id
                    );

                }
            );


            const replyButton =
                document.createElement(
                    "button"
                );

            replyButton.type =
                "button";

            replyButton.className =
                "message-action";

            replyButton.textContent =
                "↩ Reply";


            replyButton.addEventListener(
                "click",
                () => {

                    state.currentReplyTo =
                        message;

                    messageInput.focus();

                    toast(
                        `Replying to ${name}`
                    );

                }
            );


            actions.appendChild(
                reactButton
            );

            actions.appendChild(
                replyButton
            );


            if (
                message.user_id ===
                state.user?.id &&
                !message.is_deleted
            ) {

                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.type =
                    "button";

                deleteButton.className =
                    "message-action delete";

                deleteButton.textContent =
                    "Delete";


                deleteButton.addEventListener(
                    "click",
                    () =>
                        deleteMessage(
                            message
                        )
                );


                actions.appendChild(
                    deleteButton
                );

            }


            body.appendChild(
                actions
            );


            wrapper.appendChild(
                avatar
            );

            wrapper.appendChild(
                body
            );


            messageList.appendChild(
                wrapper
            );

        }


        /* =================================================
           ATTACHMENT RENDERING
           ================================================= */

        function renderMessageAttachments(
            body,
            message
        ) {

            const attachments =
                state.messageAttachments.get(
                    message.id
                ) || [];


            for (
                const attachment
                of attachments
            ) {

                const container =
                    document.createElement(
                        "div"
                    );

                container.className =
                    "message-attachment";


                const url =
                    attachment.file_url;


                if (
                    attachment.mime_type
                        ?.startsWith(
                            "image/"
                        ) &&
                    isUrl(url)
                ) {

                    const image =
                        document.createElement(
                            "img"
                        );

                    image.className =
                        attachment.mime_type
                            .toLowerCase()
                            .includes("gif")
                                ? "gif-message"
                                : "attachment-image";

                    image.src =
                        url;

                    image.alt =
                        attachment.file_name ||
                        "Shared image";

                    image.loading =
                        "lazy";

                    container.appendChild(
                        image
                    );

                } else {

                    const link =
                        document.createElement(
                            "a"
                        );

                    link.className =
                        "attachment-file";

                    link.href =
                        url || "#";

                    link.target =
                        "_blank";

                    link.rel =
                        "noopener noreferrer";


                    link.textContent =
                        `📎 ${attachment.file_name}`;


                    container.appendChild(
                        link
                    );

                }


                body.appendChild(
                    container
                );

            }

        }


        /* =================================================
           REACTION RENDERING
           ================================================= */

        function renderReactions(
            body,
            message
        ) {

            const reactions =
                state.messageReactions.get(
                    message.id
                ) || [];


            if (!reactions.length) {
                return;
            }


            const grouped =
                new Map();


            for (
                const reaction
                of reactions
            ) {

                if (
                    !grouped.has(
                        reaction.reaction
                    )
                ) {

                    grouped.set(
                        reaction.reaction,
                        {
                            count: 0,
                            mine: false
                        }
                    );

                }


                const item =
                    grouped.get(
                        reaction.reaction
                    );


                item.count++;


                if (
                    reaction.user_id ===
                    state.user?.id
                ) {

                    item.mine =
                        true;

                }

            }


            const list =
                document.createElement(
                    "div"
                );

            list.className =
                "reaction-list";


            for (
                const [
                    emoji,
                    item
                ]
                of grouped
            ) {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "reaction-button";


                if (item.mine) {

                    button.classList.add(
                        "active"
                    );

                }


                button.textContent =
                    `${emoji} ${item.count}`;


                button.addEventListener(
                    "click",
                    () =>
                        toggleReaction(
                            message.id,
                            emoji
                        )
                );


                list.appendChild(
                    button
                );

            }


            body.appendChild(
                list
            );

        }


        /* =================================================
           REACTION MENU
           ================================================= */

        function openReactionMenu(
            anchor,
            messageId
        ) {

            closeReactionMenu();


            const menu =
                document.createElement(
                    "div"
                );

            menu.id =
                "activeReactionMenu";

            menu.style.position =
                "fixed";

            menu.style.zIndex =
                "1500";

            menu.style.display =
                "flex";

            menu.style.gap =
                "4px";

            menu.style.padding =
                "7px";

            menu.style.background =
                "#1d3039";

            menu.style.border =
                "1px solid rgba(255,255,255,.1)";

            menu.style.borderRadius =
                "12px";

            menu.style.boxShadow =
                "0 15px 40px rgba(0,0,0,.35)";


            const emojis = [
                "👍",
                "❤️",
                "😂",
                "😮",
                "😢",
                "🎉",
                "👏",
                "🔥"
            ];


            for (
                const emoji
                of emojis
            ) {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.style.border =
                    "0";

                button.style.background =
                    "transparent";

                button.style.fontSize =
                    "20px";

                button.style.cursor =
                    "pointer";

                button.textContent =
                    emoji;


                button.addEventListener(
                    "click",
                    async () => {

                        await toggleReaction(
                            messageId,
                            emoji
                        );

                        closeReactionMenu();

                    }
                );


                menu.appendChild(
                    button
                );

            }


            document.body.appendChild(
                menu
            );


            const rect =
                anchor.getBoundingClientRect();


            menu.style.left =
                `${Math.max(
                    8,
                    Math.min(
                        rect.left,
                        window.innerWidth -
                            menu.offsetWidth -
                            8
                    )
                )}px`;


            menu.style.top =
                `${Math.max(
                    8,
                    rect.bottom + 6
                )}px`;


            setTimeout(() => {

                document.addEventListener(
                    "click",
                    outsideReactionClick,
                    {
                        once: true
                    }
                );

            }, 0);


            function outsideReactionClick(
                event
            ) {

                if (
                    !menu.contains(
                        event.target
                    )
                ) {

                    closeReactionMenu();

                }

            }

        }


        function closeReactionMenu() {

            document
                .getElementById(
                    "activeReactionMenu"
                )
                ?.remove();

        }


        /* =================================================
           DELETE MESSAGE
           ================================================= */

        async function deleteMessage(
            message
        ) {

            if (
                message.user_id !==
                state.user?.id
            ) {

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
                await supabase
                    .from(
                        "chat_messages"
                    )
                    .update({

                        is_deleted:
                            true,

                        deleted_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString(),

                        content:
                            null

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

                console.error(
                    "Delete message error:",
                    error
                );

                toast(
                    "Unable to delete message."
                );

                return;

            }


            state.messages =
                state.messages.map(
                    item =>
                        item.id ===
                        message.id
                            ? {
                                ...item,
                                is_deleted:
                                    true,
                                content:
                                    null
                            }
                            : item
                );


            renderMessages();

            toast(
                "Message deleted."
            );

        }


        /* =================================================
           SEND MESSAGE
           ================================================= */

        async function sendMessage() {

            if (
                !state.user ||
                !state.currentChannel
            ) {

                return;

            }


            const content =
                messageInput.value.trim();


            if (!content) {
                return;
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
                state.currentReplyTo
            ) {

                payload.parent_message_id =
                    state.currentReplyTo.id;

            }


            const {
                error
            } =
                await supabase
                    .from(
                        "chat_messages"
                    )
                    .insert(
                        payload
                    );


            if (error) {

                console.error(
                    "Send message error:",
                    error
                );

                toast(
                    "Unable to send message."
                );

                return;

            }


            messageInput.value =
                "";

            autoResizeTextarea();

            state.currentReplyTo =
                null;

        }


        /* =================================================
           ATTACH FILE
           ================================================= */

        async function uploadAttachment(
            file
        ) {

            if (
                !state.user ||
                !state.currentChannel
            ) {

                return;

            }


            if (!file) {
                return;
            }


            const maxSize =
                15 * 1024 * 1024;


            if (
                file.size >
                maxSize
            ) {

                toast(
                    "Files must be 15 MB or smaller."
                );

                return;

            }


            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );


            const uniqueName =
                `${Date.now()}-${crypto.randomUUID()}-${safeName}`;


            const filePath =
                `${state.user.id}/${uniqueName}`;


            toast(
                `Uploading ${file.name}...`
            );


            const {
                error:
                    uploadError
            } =
                await supabase.storage
                    .from(
                        ATTACHMENT_BUCKET
                    )
                    .upload(
                        filePath,
                        file,
                        {
                            upsert: false,
                            contentType:
                                file.type ||
                                "application/octet-stream"
                        }
                    );


            if (uploadError) {

                console.error(
                    "Attachment upload error:",
                    uploadError
                );

                toast(
                    "Unable to upload file."
                );

                return;

            }


            const {
                data:
                    publicData
            } =
                supabase.storage
                    .from(
                        ATTACHMENT_BUCKET
                    )
                    .getPublicUrl(
                        filePath
                    );


            const fileUrl =
                publicData?.publicUrl;


            const {
                data:
                    message,
                error:
                    messageError
            } =
                await supabase
                    .from(
                        "chat_messages"
                    )
                    .insert({

                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            file.name,

                        message_type:
                            file.type
                                ?.startsWith(
                                    "image/"
                                )
                                ? "image"
                                : "file"

                    })
                    .select()
                    .single();


            if (messageError) {

                console.error(
                    "Attachment message error:",
                    messageError
                );

                await supabase.storage
                    .from(
                        ATTACHMENT_BUCKET
                    )
                    .remove([
                        filePath
                    ]);

                toast(
                    "Unable to create attachment message."
                );

                return;

            }


            const {
                error:
                    attachmentError
            } =
                await supabase
                    .from(
                        "chat_attachments"
                    )
                    .insert({

                        message_id:
                            message.id,

                        uploaded_by:
                            state.user.id,

                        file_name:
                            file.name,

                        file_path:
                            filePath,

                        file_url:
                            fileUrl,

                        mime_type:
                            file.type ||
                            "application/octet-stream",

                        file_size:
                            file.size

                    });


            if (attachmentError) {

                console.error(
                    "Attachment record error:",
                    attachmentError
                );

                toast(
                    "File uploaded but attachment record failed."
                );

                return;

            }


            toast(
                "File shared."
            );

        }


        /* =================================================
           GIF
           ================================================= */

        function openGifPicker() {

            closeEmojiPicker();

            gifPicker?.classList.remove(
                "hidden"
            );

            gifUrlInput?.focus();

        }


        function closeGifPicker() {

            gifPicker?.classList.add(
                "hidden"
            );

        }


        function previewGif() {

            const url =
                gifUrlInput?.value.trim();


            state.selectedGifUrl =
                null;


            if (
                !url ||
                !isGifUrl(url)
            ) {

                gifPreview.innerHTML =
                    "<span class='message-deleted'>Enter a valid GIF URL.</span>";

                sendGifButton.disabled =
                    true;

                return;

            }


            state.selectedGifUrl =
                url;


            gifPreview.innerHTML =
                "";


            const image =
                document.createElement(
                    "img"
                );

            image.src =
                url;

            image.alt =
                "GIF preview";


            image.onload =
                () => {

                    sendGifButton.disabled =
                        false;

                };


            image.onerror =
                () => {

                    state.selectedGifUrl =
                        null;

                    sendGifButton.disabled =
                        true;

                    gifPreview.textContent =
                        "The GIF could not be loaded.";

                };


            gifPreview.appendChild(
                image
            );

        }


        async function sendGif() {

            const url =
                state.selectedGifUrl;


            if (
                !url ||
                !state.currentChannel ||
                !state.user
            ) {

                return;

            }


            const {
                error
            } =
                await supabase
                    .from(
                        "chat_messages"
                    )
                    .insert({

                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            url,

                        message_type:
                            "gif"

                    });


            if (error) {

                console.error(
                    "GIF message error:",
                    error
                );

                toast(
                    "Unable to share GIF."
                );

                return;

            }


            gifUrlInput.value =
                "";

            gifPreview.innerHTML =
                "";

            state.selectedGifUrl =
                null;

            sendGifButton.disabled =
                true;

            closeGifPicker();

        }


        /* =================================================
           EMOJI
           ================================================= */

        const emojis = [

            "😀","😃","😄","😁","😆","😅","😂","🤣",
            "😊","😇","🙂","🙃","😉","😌","😍","🥰",
            "😘","😗","😙","😚","😋","😛","😝","😜",
            "🤪","🤨","🧐","🤓","😎","🤩","🥳","😏",
            "😒","😞","😔","😟","😕","🙁","☹️","😣",
            "😖","😫","😩","🥺","😢","😭","😤","😠",
            "😡","🤬","🤯","😳","🥵","🥶","😱","😨",
            "😰","😥","😓","🤗","🤔","🫡","🤭","🤫",
            "🤥","😶","😐","😑","😬","🙄","😯","😦",
            "😧","😮","😲","🥱","😴","🤤","😪","😵",
            "🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕",

            "👍","👎","👏","🙌","🙏","💪","🤝","✌️",
            "🤞","👌","🤌","🤏","👈","👉","👆","👇",
            "☝️","✋","🤚","🖐️","🖖","👋","🤟","🤘",
            "💗","❤️","🧡","💛","💚","💙","💜","🖤",
            "🤍","🤎","💔","❣️","💕","💞","💓","💖",
            "💘","💝","💟","💯","🔥","✨","⭐","🌟",

            "🎉","🎊","🎓","📚","📖","📝","💡","🔬",
            "🧪","🧬","🩺","💊","🧠","🫀","🫁","🩸",
            "🏥","👨‍⚕️","👩‍⚕️","⏰","📌","📎","🔔",
            "✅","❌","⚠️","❗","❓","💬","📢","🔗",

            "😂","🤣","😭","😎","🤔","😮","🥳","🔥",
            "❤️","👍","👏","🎉","🙏","💯"

        ];


        function setupEmojiPicker() {

            if (!emojiGrid) {
                return;
            }


            emojiGrid.innerHTML =
                "";


            emojis.forEach(
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
                        () => {

                            insertEmoji(
                                emoji
                            );

                        }
                    );


                    emojiGrid.appendChild(
                        button
                    );

                }
            );

        }


        function insertEmoji(
            emoji
        ) {

            if (!messageInput) {
                return;
            }


            const start =
                messageInput.selectionStart ??
                messageInput.value.length;


            const end =
                messageInput.selectionEnd ??
                messageInput.value.length;


            messageInput.value =
                messageInput.value.slice(
                    0,
                    start
                ) +
                emoji +
                messageInput.value.slice(
                    end
                );


            messageInput.focus();


            const position =
                start +
                emoji.length;


            messageInput.setSelectionRange(
                position,
                position
            );


            autoResizeTextarea();

        }


        function openEmojiPicker() {

            closeGifPicker();

            emojiPicker?.classList.remove(
                "hidden"
            );

            $("emojiButton")
                ?.setAttribute(
                    "aria-expanded",
                    "true"
                );

        }


        function closeEmojiPicker() {

            emojiPicker?.classList.add(
                "hidden"
            );

            $("emojiButton")
                ?.setAttribute(
                    "aria-expanded",
                    "false"
                );

        }


        /* =================================================
           TEXTAREA
           ================================================= */

        function autoResizeTextarea() {

            if (!messageInput) {
                return;
            }


            messageInput.style.height =
                "auto";


            messageInput.style.height =
                Math.min(
                    messageInput.scrollHeight,
                    140
                ) +
                "px";

        }


        /* =================================================
           SCROLL
           ================================================= */

        function scrollToBottom() {

            if (!messageList) {
                return;
            }


            requestAnimationFrame(
                () => {

                    messageList.scrollTop =
                        messageList.scrollHeight;

                }
            );

        }


        /* =================================================
           COMMUNITY MODAL
           ================================================= */

        function openCommunityModal() {

            if (!hasAcceptedRules()) {

                showRulesGate();

                return;

            }


            $("communityModal")
                ?.classList.remove(
                    "hidden"
                );

            $("communityModalSearch")
                ?.focus();

        }


        function closeCommunityModal() {

            $("communityModal")
                ?.classList.add(
                    "hidden"
                );

        }


        /* =================================================
           EVENTS
           ================================================= */

        function setupEvents() {

            /*
             * Rules
             */

            setupRules();


            /*
             * Community selector
             */

            $("openCommunityButton")
                ?.addEventListener(
                    "click",
                    openCommunityModal
                );


            $("headerCommunityButton")
                ?.addEventListener(
                    "click",
                    openCommunityModal
                );


            $("closeCommunityModal")
                ?.addEventListener(
                    "click",
                    closeCommunityModal
                );


            $("communityModalSearch")
                ?.addEventListener(
                    "input",
                    event =>
                        renderCommunityModal(
                            event.target.value
                        )
                );


            /*
             * Channel search
             */

            $("channelSearchInput")
                ?.addEventListener(
                    "input",
                    event =>
                        renderChannels(
                            event.target.value
                        )
                );


            /*
             * Dashboard
             */

            $("dashboardButton")
                ?.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            "./dashboard.html";

                    }
                );


            $("homeButton")
                ?.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            "./dashboard.html";

                    }
                );


            $("railHomeButton")
                ?.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            "./dashboard.html";

                    }
                );


            /*
             * General Chat
             */

            $("railGeneralButton")
                ?.addEventListener(
                    "click",
                    async () => {

                        if (
                            !hasAcceptedRules()
                        ) {

                            showRulesGate();

                            return;

                        }


                        const generalCommunity =
                            state.communities.find(
                                community =>
                                    community.slug ===
                                    "general"
                            ) ||
                            state.communities.find(
                                community =>
                                    community.name
                                        ?.toLowerCase()
                                        .includes(
                                            "general"
                                        )
                            );


                        if (
                            generalCommunity
                        ) {

                            await selectCommunity(
                                generalCommunity
                            );

                        }

                    }
                );


            /*
             * Composer
             */

            messageForm?.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();

                    await sendMessage();

                }
            );


            $("sendMessageButton")
                ?.addEventListener(
                    "click",
                    () => {

                        /*
                         * The form handles the actual send.
                         */

                    }
                );


            messageInput?.addEventListener(
                "input",
                autoResizeTextarea
            );


            messageInput?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        messageForm.requestSubmit();

                    }

                }
            );


            /*
             * Attachments
             */

            $("attachButton")
                ?.addEventListener(
                    "click",
                    () => {

                        attachmentInput?.click();

                    }
                );


            attachmentInput?.addEventListener(
                "change",
                async event => {

                    const files =
                        [
                            ...(
                                event.target.files ||
                                []
                            )
                        ];


                    for (
                        const file
                        of files
                    ) {

                        await uploadAttachment(
                            file
                        );

                    }


                    event.target.value =
                        "";

                }
            );


            /*
             * Emoji
             */

            $("emojiButton")
                ?.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        if (
                            emojiPicker.classList.contains(
                                "hidden"
                            )
                        ) {

                            openEmojiPicker();

                        } else {

                            closeEmojiPicker();

                        }

                    }
                );


            $("closeEmojiButton")
                ?.addEventListener(
                    "click",
                    closeEmojiPicker
                );


            /*
             * GIF
             */

            $("gifButton")
                ?.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        if (
                            gifPicker.classList.contains(
                                "hidden"
                            )
                        ) {

                            openGifPicker();

                        } else {

                            closeGifPicker();

                        }

                    }
                );


            $("closeGifButton")
                ?.addEventListener(
                    "click",
                    closeGifPicker
                );


            $("previewGifButton")
                ?.addEventListener(
                    "click",
                    previewGif
                );


            gifUrlInput?.addEventListener(
                "input",
                () => {

                    state.selectedGifUrl =
                        null;

                    sendGifButton.disabled =
                        true;

                }
            );


            gifUrlInput?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter"
                    ) {

                        event.preventDefault();

                        previewGif();

                    }

                }
            );


            sendGifButton?.addEventListener(
                "click",
                sendGif
            );


            /*
             * Older messages
             */

            $("loadOlderMessagesButton")
                ?.addEventListener(
                    "click",
                    async () => {

                        const oldHeight =
                            messageList.scrollHeight;


                        await loadMessages(
                            false
                        );


                        const newHeight =
                            messageList.scrollHeight;


                        messageList.scrollTop =
                            newHeight -
                            oldHeight;

                    }
                );


            /*
             * Welcome button
             */

            $("welcomeStartButton")
                ?.addEventListener(
                    "click",
                    () => {

                        messageInput?.focus();

                    }
                );


            /*
             * Close popups when clicking outside.
             *
             * This deliberately does NOT use
             * aria-hidden on focused elements.
             */

            document.addEventListener(
                "click",
                event => {

                    if (
                        emojiPicker &&
                        !emojiPicker.contains(
                            event.target
                        ) &&
                        !$("emojiButton")
                            ?.contains(
                                event.target
                            )
                    ) {

                        closeEmojiPicker();

                    }


                    if (
                        gifPicker &&
                        !gifPicker.contains(
                            event.target
                        ) &&
                        !$("gifButton")
                            ?.contains(
                                event.target
                            )
                    ) {

                        closeGifPicker();

                    }


                    if (
                        $("communityModal") &&
                        event.target ===
                            $("communityModal")
                    ) {

                        closeCommunityModal();

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

                        closeEmojiPicker();

                        closeGifPicker();

                        closeCommunityModal();

                        closeReactionMenu();

                    }

                }
            );


            /*
             * Profile
             */

            $("sidebarProfileButton")
                ?.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            "./profile.html";

                    }
                );


            $("railProfileButton")
                ?.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            "./profile.html";

                    }
                );

        }


        /* =================================================
           INITIALIZE
           ================================================= */

        async function initialize() {

            console.log(
                "🚀 Mwaniki Scholars Community engine loading..."
            );


            const user =
                await loadCurrentUser();


            if (!user) {

                toast(
                    "Please sign in to use the community."
                );

                setTimeout(() => {

                    window.location.href =
                        "./index.html";

                }, 1500);

                return;

            }


            await loadOwnProfile();

            setupEmojiPicker();

            setupEvents();

            await loadCommunities();


            /*
             * Automatically choose a General community
             * when one exists.
             */

            const general =
                state.communities.find(
                    community =>
                        community.slug ===
                        "general"
                ) ||
                state.communities.find(
                    community =>
                        community.name
                            ?.toLowerCase()
                            .includes(
                                "general"
                            )
                );


            if (general) {

                await selectCommunity(
                    general
                );

            } else if (
                state.communities[0]
            ) {

                await selectCommunity(
                    state.communities[0]
                );

            }


            console.log(
                "✅ Mwaniki Scholars Community ready"
            );

        }


        initialize();

    }

})();
