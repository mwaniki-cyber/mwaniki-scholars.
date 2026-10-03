/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   =========================================================

   Handles:
   - Communities
   - Channels
   - Real student names
   - Real student profile photos
   - Message history
   - Sending messages
   - Replies
   - Message deletion
   - Reactions
   - Emoji picker
   - Photo/document attachments
   - GIF URL sharing
   - Channel search
   - Community switching
   - Profile display
   - Rules gate
   - Realtime messages
   - Realtime reactions

   CALLING:
   This file DOES NOT implement calls.
   The independent call.js handles calling.

   Required:
   supabase.js must load before this file.
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       SUPABASE
       ===================================================== */

    const supabase =
        window.supabase ||
        window.supabaseClient ||
        window.sb ||
        window.mwanikiSupabase;

    if (!supabase) {

        console.error(
            "❌ Supabase client was not found."
        );

        return;
    }


    /* =====================================================
       CONSTANTS
       ===================================================== */

    const RULES_VERSION =
        "mwaniki-community-rules-v1";

    const ATTACHMENT_BUCKET =
        "chat-attachments";

    const PAGE_SIZE =
        100;


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        user: null,

        profile: null,

        communities: [],

        currentCommunity: null,

        channels: [],

        currentChannel: null,

        messages: [],

        reactions: new Map(),

        profiles: new Map(),

        realtimeChannels: [],

        oldestMessageDate: null,

        loadingMessages: false,

        loadingOlder: false,

        hasOlderMessages: true,

        replyingTo: null,

        selectedAttachment: null,

        rulesAccepted: false,

        initialized: false

    };


    /* =====================================================
       DOM HELPER
       ===================================================== */

    const $ = id =>
        document.getElementById(id);


    /* =====================================================
       DOM REFERENCES
       ===================================================== */

    const app =
        $("communityApp");

    const messageList =
        $("messageList");

    const messageForm =
        $("messageForm");

    const messageInput =
        $("messageInput");

    const sendMessageButton =
        $("sendMessageButton");

    const attachButton =
        $("attachButton");

    const emojiButton =
        $("emojiButton");

    const channelSearchInput =
        $("channelSearchInput");

    const channelList =
        $("channelList");

    const communityRailList =
        $("communityRailList");

    const selectedCommunityIcon =
        $("selectedCommunityIcon");

    const selectedCommunityName =
        $("selectedCommunityName");

    const selectedCommunityDescription =
        $("selectedCommunityDescription");

    const mainChannelTitle =
        $("mainChannelTitle");

    const mainChannelDescription =
        $("mainChannelDescription");

    const communityToast =
        $("communityToast");


    /* =====================================================
       UTILITY
       ===================================================== */

    function showToast(message) {

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
            showToast.timer
        );

        showToast.timer =
            setTimeout(() => {

                communityToast.classList.remove(
                    "show"
                );

            }, 3000);

    }


    function escapeHtml(value = "") {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function getInitials(name = "Student") {

        const clean =
            String(name)
                .trim();

        if (!clean) {
            return "S";
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
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();

    }


    function formatMessageTime(dateValue) {

        if (!dateValue) {
            return "";
        }

        const date =
            new Date(dateValue);

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
                dateStyle: "short",
                timeStyle: "short"
            }
        );

    }


    function isValidHttpUrl(value) {

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

        if (!isValidHttpUrl(value)) {
            return false;
        }

        const lower =
            value.toLowerCase();

        return (
            lower.includes(".gif") ||
            lower.includes("giphy.com") ||
            lower.includes("tenor.com") ||
            lower.includes("media.giphy") ||
            lower.includes("media.tenor")
        );

    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function loadCurrentUser() {

        const {
            data,
            error
        } =
            await supabase.auth.getUser();

        if (error) {

            console.error(
                "Authentication error:",
                error
            );

            return null;
        }

        state.user =
            data?.user || null;

        return state.user;

    }


    /* =====================================================
       REAL STUDENT PROFILE
       ===================================================== */

    async function loadStudentProfile(
        userId
    ) {

        if (!userId) {

            return {
                id: null,
                full_name: "Student",
                photo_url: null
            };

        }


        if (
            state.profiles.has(userId)
        ) {

            return state.profiles.get(
                userId
            );

        }


        const fallback = {

            id: userId,

            full_name:
                "Student",

            photo_url:
                null

        };


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("students")
                    .select(
                        "id,full_name,photo_url"
                    )
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();


            if (error) {

                console.error(
                    "Student profile error:",
                    error
                );

                state.profiles.set(
                    userId,
                    fallback
                );

                return fallback;

            }


            if (!data) {

                state.profiles.set(
                    userId,
                    fallback
                );

                return fallback;

            }


            const profile = {

                id:
                    data.id,

                full_name:
                    data.full_name?.trim() ||
                    "Student",

                photo_url:
                    data.photo_url ||
                    null

            };


            state.profiles.set(
                userId,
                profile
            );


            return profile;

        } catch (error) {

            console.error(
                "Profile exception:",
                error
            );

            state.profiles.set(
                userId,
                fallback
            );

            return fallback;

        }

    }


    /* =====================================================
       LOAD MULTIPLE MESSAGE PROFILES
       ===================================================== */

    async function loadMessageProfiles(
        messages = []
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


        const missing =
            ids.filter(
                id =>
                    !state.profiles.has(
                        id
                    )
            );


        if (!missing.length) {
            return;
        }


        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("students")
                    .select(
                        "id,full_name,photo_url"
                    )
                    .in(
                        "id",
                        missing
                    );


            if (error) {

                console.error(
                    "Batch profile error:",
                    error
                );

                return;

            }


            for (
                const profile
                of data || []
            ) {

                state.profiles.set(
                    profile.id,
                    {

                        id:
                            profile.id,

                        full_name:
                            profile.full_name?.trim() ||
                            "Student",

                        photo_url:
                            profile.photo_url ||
                            null

                    }
                );

            }

        } catch (error) {

            console.error(
                "Batch profile exception:",
                error
            );

        }

    }


    /* =====================================================
       CREATE AVATAR
       ===================================================== */

    function createAvatar(
        profile,
        className = "message-avatar"
    ) {

        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            className;


        const name =
            profile?.full_name ||
            "Student";


        if (profile?.photo_url) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                profile.photo_url;

            image.alt =
                name;

            image.loading =
                "lazy";


            image.onerror =
                () => {

                    image.remove();

                    avatar.textContent =
                        getInitials(
                            name
                        );

                };


            avatar.appendChild(
                image
            );

        } else {

            avatar.textContent =
                getInitials(
                    name
                );

        }


        return avatar;

    }


    /* =====================================================
       CURRENT PROFILE
       ===================================================== */

    async function loadMyProfile() {

        if (!state.user) {
            return null;
        }

        state.profile =
            await loadStudentProfile(
                state.user.id
            );

        updateProfileUI();

        return state.profile;

    }


    function updateProfileUI() {

        const profile =
            state.profile;

        if (!profile) {
            return;
        }


        const nameElements = [

            $("sidebarProfileName")

        ];


        for (
            const element
            of nameElements
        ) {

            if (element) {

                element.textContent =
                    profile.full_name ||
                    "Student";

            }

        }


        const avatarElements = [

            $("sidebarProfileAvatar"),

            $("railProfileAvatar"),

            $("headerProfileAvatar"),

            $("profileLargeAvatar")

        ];


        for (
            const element
            of avatarElements
        ) {

            if (!element) {
                continue;
            }


            element.innerHTML =
                "";


            const avatar =
                createAvatar(
                    profile,
                    "profile-avatar"
                );


            element.appendChild(
                avatar
            );

        }

    }


    /* =====================================================
       RULES
       ===================================================== */

    function hasAcceptedRules() {

        return (
            localStorage.getItem(
                RULES_VERSION
            ) === "true"
        );

    }


    function setupRulesModal() {

        const modal =
            $("communityRulesModal");

        if (!modal) {
            return;
        }


        const checkbox =
            $("communityRulesAgree");

        const continueButton =
            $("communityRulesContinue");


        const accepted =
            hasAcceptedRules();


        state.rulesAccepted =
            accepted;


        if (accepted) {

            modal.classList.add(
                "hidden"
            );

            return;

        }


        modal.classList.remove(
            "hidden"
        );


        if (checkbox) {

            checkbox.checked =
                false;

        }


        if (continueButton) {

            continueButton.disabled =
                true;


            checkbox?.addEventListener(
                "change",
                () => {

                    continueButton.disabled =
                        !checkbox.checked;

                }
            );


            continueButton.addEventListener(
                "click",
                () => {

                    if (
                        !checkbox?.checked
                    ) {
                        return;
                    }


                    localStorage.setItem(
                        RULES_VERSION,
                        "true"
                    );


                    state.rulesAccepted =
                        true;


                    modal.classList.add(
                        "hidden"
                    );


                    announce(
                        "Community rules accepted."
                    );

                }
            );

        }

    }


    function requireRules() {

        if (state.rulesAccepted) {
            return true;
        }

        const modal =
            $("communityRulesModal");

        modal?.classList.remove(
            "hidden"
        );

        showToast(
            "Please read and accept the community rules first."
        );

        return false;

    }


    /* =====================================================
       ACCESSIBILITY
       ===================================================== */

    function announce(message) {

        const element =
            $("accessibilityAnnouncer");

        if (element) {

            element.textContent =
                message;

        }

    }


    /* =====================================================
       LOAD COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        const {
            data,
            error
        } =
            await supabase
                .from("chat_communities")
                .select(`
                    id,
                    name,
                    slug,
                    description,
                    icon_url,
                    is_public,
                    is_active,
                    created_at
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

            console.error(
                "Community loading error:",
                error
            );

            showToast(
                "Unable to load communities."
            );

            return;

        }


        state.communities =
            data || [];


        renderCommunityRail();


        if (
            !state.currentCommunity &&
            state.communities.length
        ) {

            await selectCommunity(
                state.communities[0]
            );

        }

    }


    /* =====================================================
       COMMUNITY ICON
       ===================================================== */

    function renderIcon(
        container,
        icon
    ) {

        if (!container) {
            return;
        }


        container.innerHTML =
            "";


        if (
            icon &&
            isValidHttpUrl(icon)
        ) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                icon;

            image.alt =
                "Community";

            image.loading =
                "lazy";

            image.onerror =
                () => {

                    image.remove();

                    container.textContent =
                        "💬";

                };

            container.appendChild(
                image
            );

            return;

        }


        container.textContent =
            icon ||
            "💬";

    }


    /* =====================================================
       COMMUNITY RAIL
       ===================================================== */

    function renderCommunityRail() {

        if (!communityRailList) {
            return;
        }


        communityRailList.innerHTML =
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


            const icon =
                document.createElement(
                    "span"
                );

            icon.className =
                "community-rail-icon";


            renderIcon(
                icon,
                community.icon_url ||
                getCommunityEmoji(
                    community
                )
            );


            button.appendChild(
                icon
            );


            button.addEventListener(
                "click",
                async () => {

                    if (!requireRules()) {
                        return;
                    }

                    await selectCommunity(
                        community
                    );

                }
            );


            communityRailList.appendChild(
                button
            );

        }

    }


    function getCommunityEmoji(
        community
    ) {

        const text =
            (
                community.name ||
                ""
            ).toLowerCase();


        if (
            text.includes("game")
        ) {
            return "🎮";
        }


        if (
            text.includes("meme")
        ) {
            return "😂";
        }


        if (
            text.includes("general")
        ) {
            return "💬";
        }


        if (
            text.includes("medical")
        ) {
            return "🩺";
        }


        return "🎓";

    }


    /* =====================================================
       SELECT COMMUNITY
       ===================================================== */

    async function selectCommunity(
        community
    ) {

        if (!requireRules()) {
            return;
        }


        state.currentCommunity =
            community;


        updateSelectedCommunityUI();

        renderCommunityRail();


        await loadChannels(
            community.id
        );

    }


    function updateSelectedCommunityUI() {

        const community =
            state.currentCommunity;


        if (!community) {
            return;
        }


        if (selectedCommunityName) {

            selectedCommunityName.textContent =
                community.name;

        }


        if (
            selectedCommunityDescription
        ) {

            selectedCommunityDescription.textContent =
                community.description ||
                "";

        }


        if (selectedCommunityIcon) {

            renderIcon(
                selectedCommunityIcon,
                community.icon_url ||
                getCommunityEmoji(
                    community
                )
            );

        }

    }


    /* =====================================================
       LOAD CHANNELS
       ===================================================== */

    async function loadChannels(
        communityId
    ) {

        const {
            data,
            error
        } =
            await supabase
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
                    unit_id
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
                    "name",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "Channel loading error:",
                error
            );

            showToast(
                "Unable to load channels."
            );

            return;

        }


        state.channels =
            data || [];


        await filterPrivateChannels();

        renderChannels();


        if (
            !state.currentChannel ||
            state.currentChannel.community_id !==
                communityId
        ) {

            const general =
                state.channels.find(
                    channel =>
                        channel.slug ===
                        "general"
                );


            const first =
                general ||
                state.channels[0];


            if (first) {

                await selectChannel(
                    first
                );

            } else {

                clearMessages();

                updateMainChannelUI(
                    null
                );

            }

        }

    }


    /* =====================================================
       PRIVATE CHANNEL FILTER
       ===================================================== */

    async function filterPrivateChannels() {

        if (!state.user) {
            return;
        }


        const privateChannels =
            state.channels.filter(
                channel =>
                    channel.is_private
            );


        if (!privateChannels.length) {
            return;
        }


        const ids =
            privateChannels.map(
                channel =>
                    channel.id
            );


        const {
            data,
            error
        } =
            await supabase
                .from("chat_channel_members")
                .select(
                    "channel_id"
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .in(
                    "channel_id",
                    ids
                );


        if (error) {

            console.error(
                "Private channel access error:",
                error
            );

            state.channels =
                state.channels.filter(
                    channel =>
                        !channel.is_private
                );

            return;

        }


        const allowed =
            new Set(
                (data || [])
                    .map(
                        row =>
                            row.channel_id
                    )
            );


        state.channels =
            state.channels.filter(
                channel =>
                    !channel.is_private ||
                    allowed.has(
                        channel.id
                    )
            );

    }


    /* =====================================================
       RENDER CHANNELS
       ===================================================== */

    function renderChannels() {

        if (!channelList) {
            return;
        }


        const search =
            channelSearchInput
                ?.value
                ?.trim()
                .toLowerCase() ||
            "";


        channelList.innerHTML =
            "";


        const channels =
            state.channels.filter(
                channel => {

                    if (!search) {
                        return true;
                    }

                    return (
                        channel.name
                            .toLowerCase()
                            .includes(search) ||
                        channel.description
                            ?.toLowerCase()
                            .includes(search)
                    );

                }
            );


        for (
            const channel
            of channels
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


            const text =
                document.createElement(
                    "span"
                );

            text.className =
                "channel-item-text";

            text.textContent =
                channel.name;


            button.appendChild(
                icon
            );

            button.appendChild(
                text
            );


            if (
                channel.is_private
            ) {

                const lock =
                    document.createElement(
                        "span"
                    );

                lock.className =
                    "channel-lock";

                lock.textContent =
                    "🔒";

                button.appendChild(
                    lock
                );

            }


            button.addEventListener(
                "click",
                async () => {

                    await selectChannel(
                        channel
                    );

                }
            );


            channelList.appendChild(
                button
            );

        }


        if (!channels.length) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "channel-empty";

            empty.textContent =
                "No channels found.";

            channelList.appendChild(
                empty
            );

        }

    }


    /* =====================================================
       SELECT CHANNEL
       ===================================================== */

    async function selectChannel(
        channel
    ) {

        if (!requireRules()) {
            return;
        }


        state.currentChannel =
            channel;


        state.messages =
            [];

        state.reactions.clear();

        state.oldestMessageDate =
            null;

        state.hasOlderMessages =
            true;


        updateMainChannelUI(
            channel
        );

        renderChannels();


        await loadMessages(
            channel.id,
            false
        );


        subscribeToChannel(
            channel.id
        );


        markChannelRead();

    }


    function updateMainChannelUI(
        channel
    ) {

        if (!channel) {

            if (mainChannelTitle) {
                mainChannelTitle.textContent =
                    "No channel";
            }

            if (mainChannelDescription) {
                mainChannelDescription.textContent =
                    "";
            }

            return;

        }


        if (mainChannelTitle) {

            mainChannelTitle.textContent =
                `# ${channel.name}`;

        }


        if (mainChannelDescription) {

            mainChannelDescription.textContent =
                channel.description ||
                "";

        }

    }


    /* =====================================================
       MESSAGE HISTORY
       ===================================================== */

    async function loadMessages(
        channelId,
        older = false
    ) {

        if (
            state.loadingMessages ||
            state.loadingOlder
        ) {
            return;
        }


        if (
            older &&
            !state.hasOlderMessages
        ) {
            return;
        }


        if (older) {

            state.loadingOlder =
                true;

        } else {

            state.loadingMessages =
                true;

        }


        try {

            let query =
                supabase
                    .from("chat_messages")
                    .select(`
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
                    `)
                    .eq(
                        "channel_id",
                        channelId
                    );


            if (
                older &&
                state.oldestMessageDate
            ) {

                query =
                    query.lt(
                        "created_at",
                        state.oldestMessageDate
                    );

            }


            const {
                data,
                error
            } =
                await query
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    )
                    .limit(
                        PAGE_SIZE
                    );


            if (error) {

                console.error(
                    "Message history error:",
                    error
                );

                showToast(
                    "Unable to load messages."
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


            const ordered =
                rows.reverse();


            await loadMessageProfiles(
                ordered
            );


            await loadReactionsForMessages(
                ordered
            );


            if (older) {

                state.messages =
                    [
                        ...ordered,
                        ...state.messages
                    ];

            } else {

                state.messages =
                    ordered;

            }


            if (state.messages.length) {

                state.oldestMessageDate =
                    state.messages[0]
                        .created_at;

            }


            renderMessages();

        } finally {

            state.loadingMessages =
                false;

            state.loadingOlder =
                false;

        }

    }


    /* =====================================================
       LOAD REACTIONS
       ===================================================== */

    async function loadReactionsForMessages(
        messages
    ) {

        const ids =
            messages
                .map(
                    message =>
                        message.id
                )
                .filter(Boolean);


        if (!ids.length) {
            return;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("chat_message_reactions")
                .select(
                    "id,message_id,user_id,reaction"
                )
                .in(
                    "message_id",
                    ids
                );


        if (error) {

            console.error(
                "Reaction loading error:",
                error
            );

            return;

        }


        for (
            const reaction
            of data || []
        ) {

            if (
                !state.reactions.has(
                    reaction.message_id
                )
            ) {

                state.reactions.set(
                    reaction.message_id,
                    []
                );

            }


            state.reactions
                .get(
                    reaction.message_id
                )
                .push(
                    reaction
                );

        }

    }


    /* =====================================================
       RENDER ALL MESSAGES
       ===================================================== */

    function renderMessages() {

        if (!messageList) {
            return;
        }


        messageList.innerHTML =
            "";


        if (
            state.hasOlderMessages &&
            state.messages.length
        ) {

            const olderButton =
                document.createElement(
                    "button"
                );

            olderButton.type =
                "button";

            olderButton.className =
                "load-older-button";

            olderButton.textContent =
                "Load older messages";


            olderButton.addEventListener(
                "click",
                async () => {

                    await loadMessages(
                        state.currentChannel.id,
                        true
                    );

                }
            );


            messageList.appendChild(
                olderButton
            );

        }


        if (!state.messages.length) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "messages-empty";

            empty.textContent =
                "No messages yet. Start the conversation.";

            messageList.appendChild(
                empty
            );

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


        messageList.scrollTop =
            messageList.scrollHeight;

    }


    /* =====================================================
       RENDER ONE MESSAGE
       ===================================================== */

    function renderMessage(
        message
    ) {

        const profile =
            state.profiles.get(
                message.user_id
            ) || {

                id:
                    message.user_id,

                full_name:
                    "Student",

                photo_url:
                    null

            };


        const article =
            document.createElement(
                "article"
            );

        article.className =
            "chat-message";


        article.dataset.messageId =
            message.id;


        article.dataset.userId =
            message.user_id || "";


        if (
            state.user &&
            message.user_id ===
                state.user.id
        ) {

            article.classList.add(
                "own-message"
            );

        }


        const avatar =
            createAvatar(
                profile,
                "message-avatar"
            );


        const body =
            document.createElement(
                "div"
            );

        body.className =
            "message-body";


        const header =
            document.createElement(
                "div"
            );

        header.className =
            "message-header";


        const sender =
            document.createElement(
                "strong"
            );

        sender.className =
            "message-sender";

        sender.textContent =
            profile.full_name ||
            "Student";


        const timestamp =
            document.createElement(
                "time"
            );

        timestamp.className =
            "message-time";

        timestamp.textContent =
            formatMessageTime(
                message.created_at
            );


        header.appendChild(
            sender
        );

        header.appendChild(
            timestamp
        );


        if (message.is_edited) {

            const edited =
                document.createElement(
                    "span"
                );

            edited.className =
                "edited-label";

            edited.textContent =
                "(edited)";

            header.appendChild(
                edited
            );

        }


        body.appendChild(
            header
        );


        /* -------------------------------------------------
           REPLY PREVIEW
           ------------------------------------------------- */

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
                    state.profiles.get(
                        parent.user_id
                    );


                const reply =
                    document.createElement(
                        "div"
                    );

                reply.className =
                    "message-reply-preview";


                const replyName =
                    document.createElement(
                        "strong"
                    );

                replyName.textContent =
                    parentProfile?.full_name ||
                    "Student";


                const replyText =
                    document.createElement(
                        "span"
                    );

                replyText.textContent =
                    parent.is_deleted
                        ? "Message deleted"
                        : (
                            parent.content ||
                            "Attachment"
                        );


                reply.appendChild(
                    replyName
                );

                reply.appendChild(
                    document.createTextNode(
                        ": "
                    )
                );

                reply.appendChild(
                    replyText
                );


                body.appendChild(
                    reply
                );

            }

        }


        /* -------------------------------------------------
           MESSAGE CONTENT
           ------------------------------------------------- */

        const content =
            document.createElement(
                "div"
            );

        content.className =
            "message-content";


        if (message.is_deleted) {

            content.classList.add(
                "deleted-message"
            );

            content.textContent =
                "This message was deleted.";

        }

        else if (
            message.message_type ===
                "gif" &&
            message.content
        ) {

            const gif =
                document.createElement(
                    "img"
                );

            gif.className =
                "message-gif";

            gif.src =
                message.content;

            gif.alt =
                "GIF";

            gif.loading =
                "lazy";


            gif.onerror =
                () => {

                    gif.remove();

                    const text =
                        document.createElement(
                            "span"
                        );

                    text.textContent =
                        "GIF unavailable.";

                    content.appendChild(
                        text
                    );

                };


            content.appendChild(
                gif
            );

        }

        else {

            content.textContent =
                message.content ||
                "";

        }


        if (
            !message.is_deleted &&
            message.content
        ) {

            body.appendChild(
                content
            );

        }

        else if (
            message.message_type ===
            "gif" &&
            !message.is_deleted
        ) {

            body.appendChild(
                content
            );

        }


        /* -------------------------------------------------
           ATTACHMENTS
           ------------------------------------------------- */

        const attachmentContainer =
            document.createElement(
                "div"
            );

        attachmentContainer.className =
            "message-attachments";


        loadAttachments(
            message.id,
            attachmentContainer
        );


        body.appendChild(
            attachmentContainer
        );


        /* -------------------------------------------------
           REACTIONS
           ------------------------------------------------- */

        const reactionBar =
            createReactionBar(
                message
            );


        body.appendChild(
            reactionBar
        );


        /* -------------------------------------------------
           ACTIONS
           ------------------------------------------------- */

        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "message-actions";


        if (!message.is_deleted) {

            const replyButton =
                document.createElement(
                    "button"
                );

            replyButton.type =
                "button";

            replyButton.className =
                "message-action-button";

            replyButton.textContent =
                "↩ Reply";

            replyButton.addEventListener(
                "click",
                () => {

                    startReply(
                        message
                    );

                }
            );


            actions.appendChild(
                replyButton
            );


            const reactButton =
                document.createElement(
                    "button"
                );

            reactButton.type =
                "button";

            reactButton.className =
                "message-action-button";

            reactButton.textContent =
                "😊";

            reactButton.title =
                "Add reaction";


            reactButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    openReactionPicker(
                        message.id,
                        reactButton
                    );

                }
            );


            actions.appendChild(
                reactButton
            );

        }


        if (
            state.user &&
            message.user_id ===
                state.user.id &&
            !message.is_deleted
        ) {

            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.type =
                "button";

            deleteButton.className =
                "message-action-button danger";

            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                async () => {

                    await deleteMessage(
                        message.id
                    );

                }
            );


            actions.appendChild(
                deleteButton
            );

        }


        body.appendChild(
            actions
        );


        article.appendChild(
            avatar
        );

        article.appendChild(
            body
        );


        messageList.appendChild(
            article
        );

    }


    /* =====================================================
       ATTACHMENTS
       ===================================================== */

    async function loadAttachments(
        messageId,
        container
    ) {

        const {
            data,
            error
        } =
            await supabase
                .from("chat_attachments")
                .select(`
                    id,
                    message_id,
                    file_name,
                    file_path,
                    file_url,
                    mime_type,
                    file_size
                `)
                .eq(
                    "message_id",
                    messageId
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

            renderAttachment(
                container,
                attachment
            );

        }

    }


    function renderAttachment(
        container,
        attachment
    ) {

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "message-attachment";


        const url =
            attachment.file_url;


        if (
            attachment.mime_type?.startsWith(
                "image/"
            ) &&
            url
        ) {

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                url;

            image.alt =
                attachment.file_name;

            image.loading =
                "lazy";

            image.className =
                "chat-image";


            image.addEventListener(
                "click",
                () => {

                    window.open(
                        url,
                        "_blank",
                        "noopener,noreferrer"
                    );

                }
            );


            wrapper.appendChild(
                image
            );

        } else {

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                url || "#";

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";

            link.className =
                "chat-file";


            const icon =
                document.createElement(
                    "span"
                );

            icon.textContent =
                getFileIcon(
                    attachment.mime_type
                );


            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                attachment.file_name;


            link.appendChild(
                icon
            );

            link.appendChild(
                name
            );


            wrapper.appendChild(
                link
            );

        }


        container.appendChild(
            wrapper
        );

    }


    function getFileIcon(
        mimeType = ""
    ) {

        if (
            mimeType.includes("pdf")
        ) {
            return "📕";
        }

        if (
            mimeType.includes("word") ||
            mimeType.includes("document")
        ) {
            return "📘";
        }

        if (
            mimeType.includes("sheet") ||
            mimeType.includes("excel")
        ) {
            return "📗";
        }

        if (
            mimeType.includes("presentation") ||
            mimeType.includes("powerpoint")
        ) {
            return "📙";
        }

        if (
            mimeType.startsWith(
                "image/"
            )
        ) {
            return "🖼️";
        }

        if (
            mimeType.startsWith(
                "video/"
            )
        ) {
            return "🎬";
        }

        return "📎";

    }


    /* =====================================================
       REACTION BAR
       ===================================================== */

    function createReactionBar(
        message
    ) {

        const bar =
            document.createElement(
                "div"
            );

        bar.className =
            "reaction-bar";


        const reactions =
            state.reactions.get(
                message.id
            ) || [];


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
                state.user &&
                reaction.user_id ===
                    state.user.id
            ) {

                item.mine =
                    true;

            }

        }


        for (
            const [
                emoji,
                info
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


            if (info.mine) {

                button.classList.add(
                    "mine"
                );

            }


            button.textContent =
                `${emoji} ${info.count}`;


            button.addEventListener(
                "click",
                async () => {

                    await toggleReaction(
                        message.id,
                        emoji
                    );

                }
            );


            bar.appendChild(
                button
            );

        }


        return bar;

    }


    /* =====================================================
       REACTION PICKER
       ===================================================== */

    function openReactionPicker(
        messageId,
        anchor
    ) {

        closeReactionPicker();


        const picker =
            document.createElement(
                "div"
            );

        picker.className =
            "reaction-picker";


        const emojis = [
            "👍",
            "❤️",
            "😂",
            "😮",
            "😢",
            "👏",
            "🔥",
            "🎉",
            "💯",
            "🙏"
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

            button.textContent =
                emoji;


            button.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();

                    await toggleReaction(
                        messageId,
                        emoji
                    );

                    picker.remove();

                }
            );


            picker.appendChild(
                button
            );

        }


        document.body.appendChild(
            picker
        );


        const rect =
            anchor.getBoundingClientRect();


        picker.style.position =
            "fixed";

        picker.style.left =
            `${rect.left}px`;

        picker.style.top =
            `${rect.bottom + 5}px`;


        setTimeout(() => {

            document.addEventListener(
                "click",
                closeReactionPicker,
                {
                    once: true
                }
            );

        }, 0);

    }


    function closeReactionPicker() {

        document
            .querySelectorAll(
                ".reaction-picker"
            )
            .forEach(
                picker =>
                    picker.remove()
            );

    }


    /* =====================================================
       TOGGLE REACTION
       ===================================================== */

    async function toggleReaction(
        messageId,
        reaction
    ) {

        if (!requireRules()) {
            return;
        }


        if (!state.user) {
            return;
        }


        const {
            data: existing,
            error: findError
        } =
            await supabase
                .from(
                    "chat_message_reactions"
                )
                .select(
                    "id"
                )
                .eq(
                    "message_id",
                    messageId
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .eq(
                    "reaction",
                    reaction
                )
                .maybeSingle();


        if (findError) {

            console.error(
                "Reaction lookup error:",
                findError
            );

            return;

        }


        if (existing) {

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
                        existing.id
                    );


            if (error) {

                console.error(
                    "Reaction delete error:",
                    error
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

                        reaction

                    });


            if (error) {

                console.error(
                    "Reaction insert error:",
                    error
                );

                return;

            }

        }


        await refreshCurrentChannel();

    }


    /* =====================================================
       SEND MESSAGE
       ===================================================== */

    async function sendMessage(
        event
    ) {

        event?.preventDefault();


        if (!requireRules()) {
            return;
        }


        if (
            !state.user ||
            !state.currentChannel
        ) {

            showToast(
                "Select a channel first."
            );

            return;

        }


        const content =
            messageInput
                ?.value
                ?.trim() ||
            "";


        if (
            !content &&
            !state.selectedAttachment
        ) {

            return;

        }


        if (
            sendMessageButton
        ) {

            sendMessageButton.disabled =
                true;

        }


        try {

            const {
                data: message,
                error
            } =
                await supabase
                    .from("chat_messages")
                    .insert({

                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            content || null,

                        message_type:
                            "text",

                        parent_message_id:
                            state.replyingTo?.id ||
                            null

                    })
                    .select()
                    .single();


            if (error) {

                console.error(
                    "Send message error:",
                    error
                );

                showToast(
                    "Message could not be sent."
                );

                return;

            }


            if (message) {

                state.profiles.set(
                    state.user.id,
                    state.profile
                );


                if (
                    state.selectedAttachment
                ) {

                    await uploadAttachment(
                        message.id,
                        state.selectedAttachment
                    );

                }


                clearComposer();

                await refreshCurrentChannel();

            }

        } finally {

            if (
                sendMessageButton
            ) {

                sendMessageButton.disabled =
                    false;

            }

        }

    }


    /* =====================================================
       REFRESH CURRENT CHANNEL
       ===================================================== */

    async function refreshCurrentChannel() {

        if (
            !state.currentChannel
        ) {
            return;
        }


        state.messages =
            [];

        state.reactions.clear();

        state.oldestMessageDate =
            null;

        state.hasOlderMessages =
            true;


        await loadMessages(
            state.currentChannel.id,
            false
        );

    }


    /* =====================================================
       REPLY
       ===================================================== */

    function startReply(
        message
    ) {

        state.replyingTo =
            message;


        const composer =
            document.getElementById(
                "messageForm"
            );


        let indicator =
            document.getElementById(
                "replyIndicator"
            );


        if (!indicator) {

            indicator =
                document.createElement(
                    "div"
                );

            indicator.id =
                "replyIndicator";

            indicator.className =
                "reply-indicator";


            const input =
                document.getElementById(
                    "messageInput"
                );


            input?.parentElement
                ?.insertBefore(
                    indicator,
                    input
                );

        }


        const profile =
            state.profiles.get(
                message.user_id
            );


        indicator.textContent =
            `Replying to ${
                profile?.full_name ||
                "Student"
            }: ${
                message.content ||
                "Attachment"
            }`;


        const cancel =
            document.createElement(
                "button"
            );

        cancel.type =
            "button";

        cancel.textContent =
            "×";


        cancel.addEventListener(
            "click",
            cancelReply
        );


        indicator.appendChild(
            cancel
        );


        messageInput?.focus();

    }


    function cancelReply() {

        state.replyingTo =
            null;


        const indicator =
            document.getElementById(
                "replyIndicator"
            );


        indicator?.remove();

    }


    /* =====================================================
       DELETE MESSAGE
       ===================================================== */

    async function deleteMessage(
        messageId
    ) {

        if (!state.user) {
            return;
        }


        const message =
            state.messages.find(
                item =>
                    item.id ===
                    messageId
            );


        if (!message) {
            return;
        }


        if (
            message.user_id !==
            state.user.id
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


        const {
            error
        } =
            await supabase
                .from("chat_messages")
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
                    messageId
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

            showToast(
                "Message could not be deleted."
            );

            return;

        }


        showToast(
            "Message deleted."
        );


        await refreshCurrentChannel();

    }


    /* =====================================================
       ATTACHMENT BUTTON
       ===================================================== */

    function setupAttachmentButton() {

        if (!attachButton) {
            return;
        }


        let fileInput =
            document.getElementById(
                "communityFileInput"
            );


        if (!fileInput) {

            fileInput =
                document.createElement(
                    "input"
                );

            fileInput.type =
                "file";

            fileInput.id =
                "communityFileInput";

            fileInput.accept =
                "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";


            fileInput.style.display =
                "none";


            document.body.appendChild(
                fileInput
            );

        }


        attachButton.addEventListener(
            "click",
            () => {

                if (!requireRules()) {
                    return;
                }

                fileInput.click();

            }
        );


        fileInput.addEventListener(
            "change",
            () => {

                const file =
                    fileInput.files?.[0];


                if (!file) {
                    return;
                }


                if (
                    file.size >
                    25 * 1024 * 1024
                ) {

                    showToast(
                        "Files must be 25 MB or smaller."
                    );

                    fileInput.value =
                        "";

                    return;

                }


                state.selectedAttachment =
                    file;


                showAttachmentPreview(
                    file
                );

            }
        );

    }


    function showAttachmentPreview(
        file
    ) {

        let preview =
            document.getElementById(
                "attachmentPreview"
            );


        if (!preview) {

            preview =
                document.createElement(
                    "div"
                );

            preview.id =
                "attachmentPreview";

            preview.className =
                "attachment-preview";


            messageForm?.prepend(
                preview
            );

        }


        preview.innerHTML =
            "";


        const text =
            document.createElement(
                "span"
            );

        text.textContent =
            `📎 ${file.name}`;


        const remove =
            document.createElement(
                "button"
            );

        remove.type =
            "button";

        remove.textContent =
            "×";


        remove.addEventListener(
            "click",
            () => {

                state.selectedAttachment =
                    null;

                preview.remove();

                const input =
                    document.getElementById(
                        "communityFileInput"
                    );

                if (input) {
                    input.value =
                        "";
                }

            }
        );


        preview.appendChild(
            text
        );

        preview.appendChild(
            remove
        );

    }


    /* =====================================================
       UPLOAD ATTACHMENT
       ===================================================== */

    async function uploadAttachment(
        messageId,
        file
    ) {

        if (!file || !state.user) {
            return;
        }


        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );


        const unique =
            typeof crypto !==
                "undefined" &&
            crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;


        const path =
            `${state.user.id}/${
                Date.now()
            }-${unique}-${safeName}`;


        const {
            error: uploadError
        } =
            await supabase
                .storage
                .from(
                    ATTACHMENT_BUCKET
                )
                .upload(
                    path,
                    file,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            false

                    }
                );


        if (uploadError) {

            console.error(
                "Attachment upload error:",
                uploadError
            );

            showToast(
                "File upload failed."
            );

            return;

        }


        const {
            data: publicData
        } =
            supabase
                .storage
                .from(
                    ATTACHMENT_BUCKET
                )
                .getPublicUrl(
                    path
                );


        const fileUrl =
            publicData?.publicUrl ||
            null;


        const {
            error: attachmentError
        } =
            await supabase
                .from(
                    "chat_attachments"
                )
                .insert({

                    message_id:
                        messageId,

                    uploaded_by:
                        state.user.id,

                    file_name:
                        file.name,

                    file_path:
                        path,

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
                "Attachment database error:",
                attachmentError
            );

            showToast(
                "Attachment record could not be saved."
            );

        }

    }


    /* =====================================================
       EMOJI
       ===================================================== */

    function setupEmojiButton() {

        if (!emojiButton) {
            return;
        }


        emojiButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                if (!requireRules()) {
                    return;
                }

                toggleEmojiPicker();

            }
        );

    }


    function toggleEmojiPicker() {

        let picker =
            document.getElementById(
                "communityEmojiPicker"
            );


        if (picker) {

            closeEmojiPicker();

            return;

        }


        picker =
            document.createElement(
                "div"
            );

        picker.id =
            "communityEmojiPicker";

        picker.className =
            "emoji-picker";


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
            "🩺",
            "🧪",
            "💊",
            "📚",
            "🎓",
            "🧠",
            "😂",
            "🎮",
            "⚽",
            "🏆"
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

            button.textContent =
                emoji;


            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    insertEmoji(
                        emoji
                    );

                }
            );


            picker.appendChild(
                button
            );

        }


        document.body.appendChild(
            picker
        );


        const rect =
            emojiButton.getBoundingClientRect();


        picker.style.position =
            "fixed";

        picker.style.left =
            `${rect.left}px`;

        picker.style.bottom =
            `${
                window.innerHeight -
                rect.top +
                8
            }px`;


        setTimeout(() => {

            document.addEventListener(
                "click",
                handleEmojiOutsideClick
            );

        }, 0);

    }


    function handleEmojiOutsideClick(
        event
    ) {

        const picker =
            document.getElementById(
                "communityEmojiPicker"
            );


        if (!picker) {
            return;
        }


        if (
            picker.contains(
                event.target
            ) ||
            emojiButton?.contains(
                event.target
            )
        ) {
            return;
        }


        closeEmojiPicker();

    }


    function closeEmojiPicker() {

        const picker =
            document.getElementById(
                "communityEmojiPicker"
            );


        if (!picker) {
            return;
        }


        if (
            picker.contains(
                document.activeElement
            )
        ) {

            document.activeElement.blur();

        }


        picker.remove();


        document.removeEventListener(
            "click",
            handleEmojiOutsideClick
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


        const cursor =
            start +
            emoji.length;


        messageInput.setSelectionRange(
            cursor,
            cursor
        );

    }


    /* =====================================================
       GIF
       ===================================================== */

    function setupGifButton() {

        let button =
            document.getElementById(
                "gifButton"
            );


        if (!button) {

            button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.id =
                "gifButton";

            button.className =
                "composer-extra-button";

            button.textContent =
                "GIF";

            button.title =
                "Share GIF";


            const form =
                document.getElementById(
                    "messageForm"
                );


            if (form) {
                form.appendChild(
                    button
                );
            }

        }


        button.addEventListener(
            "click",
            () => {

                if (!requireRules()) {
                    return;
                }

                openGifModal();

            }
        );

    }


    function openGifModal() {

        let modal =
            document.getElementById(
                "communityGifModal"
            );


        if (modal) {

            modal.classList.remove(
                "hidden"
            );

            return;

        }


        modal =
            document.createElement(
                "div"
            );

        modal.id =
            "communityGifModal";

        modal.className =
            "community-modal hidden";


        const box =
            document.createElement(
                "div"
            );

        box.className =
            "gif-modal-box";


        const title =
            document.createElement(
                "h3"
            );

        title.textContent =
            "Share a GIF";


        const input =
            document.createElement(
                "input"
            );

        input.type =
            "url";

        input.placeholder =
            "Paste a GIF URL";


        const help =
            document.createElement(
                "p"
            );

        help.textContent =
            "Paste a GIF link from a service such as Giphy or Tenor.";


        const buttons =
            document.createElement(
                "div"
            );

        buttons.className =
            "modal-actions";


        const cancel =
            document.createElement(
                "button"
            );

        cancel.type =
            "button";

        cancel.textContent =
            "Cancel";


        const share =
            document.createElement(
                "button"
            );

        share.type =
            "button";

        share.textContent =
            "Share GIF";


        cancel.addEventListener(
            "click",
            () => {

                modal.classList.add(
                    "hidden"
                );

            }
        );


        share.addEventListener(
            "click",
            async () => {

                const url =
                    input.value.trim();


                if (
                    !isGifUrl(url)
                ) {

                    showToast(
                        "Please enter a valid GIF URL."
                    );

                    return;

                }


                await sendGif(
                    url
                );


                modal.classList.add(
                    "hidden"
                );


                input.value =
                    "";

            }
        );


        buttons.appendChild(
            cancel
        );

        buttons.appendChild(
            share
        );


        box.appendChild(
            title
        );

        box.appendChild(
            input
        );

        box.appendChild(
            help
        );

        box.appendChild(
            buttons
        );


        modal.appendChild(
            box
        );


        document.body.appendChild(
            modal
        );


        modal.classList.remove(
            "hidden"
        );


        input.focus();


        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    modal.classList.add(
                        "hidden"
                    );

                }

            }
        );

    }


    /* =====================================================
       SEND GIF
       ===================================================== */

    async function sendGif(
        url
    ) {

        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }


        const {
            error
        } =
            await supabase
                .from("chat_messages")
                .insert({

                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        url,

                    message_type:
                        "gif",

                    parent_message_id:
                        state.replyingTo?.id ||
                        null

                });


        if (error) {

            console.error(
                "GIF send error:",
                error
            );

            showToast(
                "GIF could not be sent."
            );

            return;

        }


        cancelReply();

        await refreshCurrentChannel();

    }


    /* =====================================================
       CLEAR COMPOSER
       ===================================================== */

    function clearComposer() {

        if (messageInput) {
            messageInput.value =
                "";
        }


        state.selectedAttachment =
            null;


        const preview =
            document.getElementById(
                "attachmentPreview"
            );


        preview?.remove();


        const fileInput =
            document.getElementById(
                "communityFileInput"
            );


        if (fileInput) {
            fileInput.value =
                "";
        }


        cancelReply();

    }


    /* =====================================================
       REALTIME
       ===================================================== */

    function removeRealtimeChannels() {

        for (
            const channel
            of state.realtimeChannels
        ) {

            try {

                supabase.removeChannel(
                    channel
                );

            } catch (error) {

                console.warn(
                    "Realtime cleanup:",
                    error
                );

            }

        }


        state.realtimeChannels =
            [];

    }


    function subscribeToChannel(
        channelId
    ) {

        removeRealtimeChannels();


        const realtime =
            supabase
                .channel(
                    `community-channel-${channelId}`
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

                        await handleRealtimeMessage(
                            payload.new
                        );

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

                        await handleRealtimeMessageUpdate(
                            payload.new
                        );

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
                    async () => {

                        await refreshCurrentChannel();

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_attachments"
                    },
                    async () => {

                        await refreshCurrentChannel();

                    }
                )
                .subscribe();


        state.realtimeChannels.push(
            realtime
        );

    }


    async function handleRealtimeMessage(
        message
    ) {

        if (
            !message ||
            message.channel_id !==
                state.currentChannel?.id
        ) {
            return;
        }


        await loadMessageProfiles(
            [message]
        );


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

            state.messages.sort(
                (a, b) =>
                    new Date(
                        a.created_at
                    ) -
                    new Date(
                        b.created_at
                    )
            );

        }


        await loadReactionsForMessages(
            [message]
        );


        renderMessages();

    }


    async function handleRealtimeMessageUpdate(
        message
    ) {

        const index =
            state.messages.findIndex(
                item =>
                    item.id ===
                    message.id
            );


        if (index >= 0) {

            state.messages[index] =
                message;

        }


        await loadMessageProfiles(
            [message]
        );


        renderMessages();

    }


    /* =====================================================
       READ STATUS
       ===================================================== */

    async function markChannelRead() {

        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }


        const latest =
            state.messages[
                state.messages.length - 1
            ];


        try {

            await supabase
                .from("chat_read_status")
                .upsert(
                    {

                        channel_id:
                            state.currentChannel.id,

                        user_id:
                            state.user.id,

                        last_read_message_id:
                            latest?.id ||
                            null,

                        last_read_at:
                            new Date().toISOString()

                    },
                    {
                        onConflict:
                            "channel_id,user_id"
                    }
                );

        } catch (error) {

            console.warn(
                "Read status error:",
                error
            );

        }

    }


    /* =====================================================
       GENERAL CHANNEL
       ===================================================== */

    async function openGeneralChat() {

        if (!requireRules()) {
            return;
        }


        let general =
            state.channels.find(
                channel =>
                    channel.slug ===
                    "general"
            );


        if (!general) {

            for (
                const community
                of state.communities
            ) {

                const {
                    data
                } =
                    await supabase
                        .from(
                            "chat_channels"
                        )
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
                            unit_id
                        `)
                        .eq(
                            "community_id",
                            community.id
                        )
                        .eq(
                            "slug",
                            "general"
                        )
                        .eq(
                            "is_active",
                            true
                        )
                        .maybeSingle();


                if (data) {

                    await selectCommunity(
                        community
                    );

                    general =
                        data;

                    break;

                }

            }

        }


        if (!general) {

            showToast(
                "The general chat channel has not been created yet."
            );

            return;

        }


        await selectChannel(
            general
        );

    }


    /* =====================================================
       UI EVENTS
       ===================================================== */

    function setupEvents() {

        messageForm?.addEventListener(
            "submit",
            sendMessage
        );


        sendMessageButton?.addEventListener(
            "click",
            sendMessage
        );


        channelSearchInput?.addEventListener(
            "input",
            renderChannels
        );


        $("railGeneralButton")
            ?.addEventListener(
                "click",
                openGeneralChat
            );


        $("railHomeButton")
            ?.addEventListener(
                "click",
                openGeneralChat
            );


        $("homeButton")
            ?.addEventListener(
                "click",
                openGeneralChat
            );


        $("welcomeStartButton")
            ?.addEventListener(
                "click",
                () => {

                    messageInput?.focus();

                }
            );


        setupAttachmentButton();

        setupEmojiButton();

        setupGifButton();


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeEmojiPicker();

                    closeReactionPicker();

                    const gif =
                        document.getElementById(
                            "communityGifModal"
                        );

                    gif?.classList.add(
                        "hidden"
                    );

                }

            }
        );


        window.addEventListener(
            "beforeunload",
            () => {

                removeRealtimeChannels();

            }
        );

    }


    /* =====================================================
       START
       ===================================================== */

    async function initialize() {

        if (state.initialized) {
            return;
        }


        state.initialized =
            true;


        console.log(
            "🚀 Mwaniki Scholars Community loading..."
        );


        const user =
            await loadCurrentUser();


        if (!user) {

            showToast(
                "Please sign in to use the community."
            );

            console.warn(
                "No authenticated community user."
            );

            return;

        }


        await loadMyProfile();


        setupRulesModal();


        setupEvents();


        if (!state.rulesAccepted) {

            console.log(
                "Community waiting for rules acceptance."
            );

            return;

        }


        await loadCommunities();


        console.log(
            "✅ Mwaniki Scholars Community ready"
        );

    }


    /* =====================================================
       AUTH STATE
       ===================================================== */

    supabase.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            if (
                event ===
                "SIGNED_IN"
            ) {

                state.user =
                    session?.user ||
                    null;


                if (state.user) {

                    await loadMyProfile();

                    if (
                        state.rulesAccepted
                    ) {

                        await loadCommunities();

                    }

                }

            }


            if (
                event ===
                "SIGNED_OUT"
            ) {

                state.user =
                    null;

                state.profile =
                    null;

                state.profiles.clear();

                removeRealtimeChannels();

            }

        }
    );


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.MwanikiCommunity = {

        getState() {

            return state;

        },


        refresh() {

            return refreshCurrentChannel();

        },


        selectCommunity(
            community
        ) {

            return selectCommunity(
                community
            );

        },


        selectChannel(
            channel
        ) {

            return selectChannel(
                channel
            );

        },


        sendMessage() {

            return sendMessage();

        },


        loadProfile(
            userId
        ) {

            return loadStudentProfile(
                userId
            );

        }

    };


    /* =====================================================
       INIT
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }

})();
