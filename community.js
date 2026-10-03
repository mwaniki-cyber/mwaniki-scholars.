/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   =========================================================

   Handles:
   - Authentication
   - Community rules gate
   - Communities
   - Community switching
   - Channels
   - Channel search
   - Real student names
   - Real student profile photos
   - Message history
   - Older message loading
   - Sending messages
   - Replies
   - Message deletion
   - Reactions
   - Emoji picker
   - Photo/document attachments
   - GIF URL sharing
   - Profile display
   - Read status
   - Realtime messages
   - Realtime reactions
   - Realtime attachments

   CALLING:
   This file DOES NOT implement calling.
   call.js remains completely independent.

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

    /*
       IMPORTANT:
       This is the ONLY RULES_VERSION declaration
       in this file.
    */
    const RULES_VERSION =
        "mwaniki-community-rules-v2";


    const ATTACHMENT_BUCKET =
        "chat-attachments";


    const PAGE_SIZE =
        100;


    const MAX_FILE_SIZE =
        25 * 1024 * 1024;


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

        initialized: false,

        rulesListenersReady: false,

        eventListenersReady: false

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

    const messageArea =
        $("messageArea");

    const messageList =
        $("messageList");

    const messageEmptyState =
        $("messageEmptyState");

    const messageForm =
        $("messageForm");

    const messageInput =
        $("messageInput");

    const sendMessageButton =
        $("sendMessageButton");

    const attachButton =
        $("attachButton");

    const attachmentInput =
        $("attachmentInput");

    const emojiButton =
        $("emojiButton");

    const emojiPicker =
        $("emojiPicker");

    const emojiGrid =
        $("emojiGrid");

    const closeEmojiButton =
        $("closeEmojiButton");

    const gifButton =
        $("gifButton");

    const gifPicker =
        $("gifPicker");

    const closeGifButton =
        $("closeGifButton");

    const gifUrlInput =
        $("gifUrlInput");

    const previewGifButton =
        $("previewGifButton");

    const gifPreview =
        $("gifPreview");

    const sendGifButton =
        $("sendGifButton");

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

    const mainChannelIcon =
        $("mainChannelIcon");

    const mainChannelTitle =
        $("mainChannelTitle");

    const mainChannelDescription =
        $("mainChannelDescription");

    const communityToast =
        $("communityToast");

    const communityModal =
        $("communityModal");

    const communityChoiceList =
        $("communityChoiceList");

    const communityModalSearch =
        $("communityModalSearch");

    const accessibilityAnnouncer =
        $("accessibilityAnnouncer");


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


    function announce(message) {

        if (!accessibilityAnnouncer) {
            return;
        }


        accessibilityAnnouncer.textContent =
            "";


        setTimeout(() => {

            accessibilityAnnouncer.textContent =
                message;

        }, 20);

    }


    function escapeHtml(value = "") {

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


    function getInitials(
        name = "Student"
    ) {

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


    function formatMessageTime(
        dateValue
    ) {

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


    function isValidHttpUrl(
        value
    ) {

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


    function isGifUrl(
        value
    ) {

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


    function scrollMessagesToBottom() {

        if (!messageArea) {
            return;
        }


        requestAnimationFrame(() => {

            messageArea.scrollTop =
                messageArea.scrollHeight;

        });

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
       STUDENT PROFILE
       ===================================================== */

    async function loadStudentProfile(
        userId
    ) {

        if (!userId) {

            return {

                id: null,

                full_name:
                    "Student",

                photo_url:
                    null

            };

        }


        if (
            state.profiles.has(
                userId
            )
        ) {

            return state.profiles.get(
                userId
            );

        }


        const fallback = {

            id:
                userId,

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


        const imageElements = [

            $("railProfileAvatar"),

            $("sidebarProfileAvatar")

        ];


        for (
            const element
            of imageElements
        ) {

            if (!element) {
                continue;
            }


            /*
               These are actual <img> elements
               in the current HTML.
            */

            if (
                element.tagName ===
                "IMG"
            ) {

                element.src =
                    profile.photo_url ||
                    "";


                element.alt =
                    profile.full_name ||
                    "Profile";


                element.onerror =
                    () => {

                        element.removeAttribute(
                            "src"
                        );

                    };

            }

        }

    }


    /* =====================================================
       RULES GATE
       ===================================================== */

    function hasAcceptedRules() {

        return (
            localStorage.getItem(
                RULES_VERSION
            ) === "true"
        );

    }


    function setupRulesGate() {

        if (
            state.rulesListenersReady
        ) {

            state.rulesAccepted =
                hasAcceptedRules();

            return;

        }


        const gate =
            $("communityRulesGate");


        const checkbox =
            $("communityRulesAgreement");


        const continueButton =
            $("acceptCommunityRulesButton");


        const gateMessage =
            $("rulesGateMessage");


        if (!gate) {

            console.error(
                "❌ communityRulesGate was not found."
            );

            state.rulesAccepted =
                false;

            return;

        }


        state.rulesAccepted =
            hasAcceptedRules();


        if (state.rulesAccepted) {

            gate.classList.add(
                "hidden"
            );

            state.rulesListenersReady =
                true;

            return;

        }


        gate.classList.remove(
            "hidden"
        );


        if (checkbox) {

            checkbox.checked =
                false;

        }


        if (continueButton) {

            continueButton.disabled =
                true;

        }


        checkbox?.addEventListener(
            "change",
            () => {

                const accepted =
                    checkbox.checked;


                if (continueButton) {

                    continueButton.disabled =
                        !accepted;

                }


                if (gateMessage) {

                    gateMessage.textContent =
                        accepted
                            ? ""
                            : "You must agree to the rules before continuing.";

                }

            }
        );


        continueButton?.addEventListener(
            "click",
            async event => {

                event.preventDefault();
                event.stopPropagation();


                if (
                    !checkbox ||
                    !checkbox.checked
                ) {

                    if (gateMessage) {

                        gateMessage.textContent =
                            "Please read and agree to the community rules first.";

                    }

                    return;

                }


                localStorage.setItem(
                    RULES_VERSION,
                    "true"
                );


                state.rulesAccepted =
                    true;


                gate.classList.add(
                    "hidden"
                );


                checkbox.blur();
                continueButton.blur();


                announce(
                    "Community rules accepted."
                );


                showToast(
                    "Welcome to Mwaniki Scholars Community."
                );


                try {

                    await loadCommunities();

                } catch (error) {

                    console.error(
                        "Community loading after rules:",
                        error
                    );

                    showToast(
                        "Community could not be loaded."
                    );

                }

            }
        );


        state.rulesListenersReady =
            true;

    }


    function requireRules() {

        if (
            state.rulesAccepted
        ) {

            return true;

        }


        const gate =
            $("communityRulesGate");


        gate?.classList.remove(
            "hidden"
        );


        showToast(
            "Please read and accept the community rules first."
        );


        return false;

    }


    /* =====================================================
       COMMUNITY LOADING
       ===================================================== */

    async function loadCommunities() {

        if (!state.user) {
            return;
        }


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
                    banner_url,
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
        renderCommunityChoices();


        if (!state.communities.length) {

            state.currentCommunity =
                null;


            state.currentChannel =
                null;


            clearMessages();


            showToast(
                "No active communities are available yet."
            );


            return;

        }


        if (
            state.currentCommunity
        ) {

            const matching =
                state.communities.find(
                    community =>
                        community.id ===
                        state.currentCommunity.id
                );


            if (matching) {

                await selectCommunity(
                    matching
                );

                return;

            }

        }


        await selectCommunity(
            state.communities[0]
        );

    }


    /* =====================================================
       COMMUNITY ICONS
       ===================================================== */

    function getCommunityEmoji(
        community
    ) {

        const text =
            (
                community?.name ||
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


    function renderIcon(
        container,
        icon
    ) {

        if (!container) {
            return;
        }


        container.innerHTML =
            "";


        /*
           Emoji/text icons stay as text.
           Only real HTTP URLs become images.
        */

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


            button.title =
                community.name;


            if (
                state.currentCommunity?.id ===
                community.id
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


    /* =====================================================
       COMMUNITY CHOICE MODAL
       ===================================================== */

    function renderCommunityChoices() {

        if (!communityChoiceList) {
            return;
        }


        const search =
            communityModalSearch
                ?.value
                ?.trim()
                .toLowerCase() ||
            "";


        communityChoiceList.innerHTML =
            "";


        const communities =
            state.communities.filter(
                community => {

                    if (!search) {
                        return true;
                    }


                    return (
                        community.name
                            ?.toLowerCase()
                            .includes(search) ||
                        community.description
                            ?.toLowerCase()
                            .includes(search)
                    );

                }
            );


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
                "community-choice-item";


            if (
                state.currentCommunity?.id ===
                community.id
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
                "community-choice-icon";


            renderIcon(
                icon,
                community.icon_url ||
                getCommunityEmoji(
                    community
                )
            );


            const details =
                document.createElement(
                    "span"
                );


            details.className =
                "community-choice-details";


            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                community.name;


            const description =
                document.createElement(
                    "small"
                );


            description.textContent =
                community.description ||
                "Mwaniki Scholars Community";


            details.appendChild(
                name
            );


            details.appendChild(
                description
            );


            button.appendChild(
                icon
            );


            button.appendChild(
                details
            );


            button.addEventListener(
                "click",
                async () => {

                    if (!requireRules()) {
                        return;
                    }


                    closeCommunityModal();


                    await selectCommunity(
                        community
                    );

                }
            );


            communityChoiceList.appendChild(
                button
            );

        }


        if (!communities.length) {

            const empty =
                document.createElement(
                    "div"
                );


            empty.className =
                "channel-empty";


            empty.textContent =
                "No communities found.";


            communityChoiceList.appendChild(
                empty
            );

        }

    }


    function openCommunityModal() {

        if (!requireRules()) {
            return;
        }


        renderCommunityChoices();


        communityModal?.classList.remove(
            "hidden"
        );


        setTimeout(() => {

            communityModalSearch?.focus();

        }, 50);

    }


    function closeCommunityModal() {

        communityModal?.classList.add(
            "hidden"
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
                community.name ||
                "Community";

        }


        if (selectedCommunityDescription) {

            selectedCommunityDescription.textContent =
                community.description ||
                "Mwaniki Scholars";

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


        renderCommunityRail();
        renderCommunityChoices();

    }


    /* =====================================================
       SELECT COMMUNITY
       ===================================================== */

    async function selectCommunity(
        community
    ) {

        if (!community) {
            return;
        }


        if (!requireRules()) {
            return;
        }


        state.currentCommunity =
            community;


        updateSelectedCommunityUI();


        await loadChannels(
            community.id
        );

    }


    /* =====================================================
       CHANNEL LOADING
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


        const currentBelongs =
            state.currentChannel &&
            state.currentChannel.community_id ===
                communityId &&
            state.channels.some(
                channel =>
                    channel.id ===
                    state.currentChannel.id
            );


        if (currentBelongs) {

            await selectChannel(
                state.channels.find(
                    channel =>
                        channel.id ===
                        state.currentChannel.id
                )
            );


            return;

        }


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

            state.currentChannel =
                null;


            clearMessages();


            updateMainChannelUI(
                null
            );

        }

    }


    /* =====================================================
       PRIVATE CHANNELS
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
       CHANNEL RENDERING
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
                            ?.toLowerCase()
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
       CHANNEL SELECTION
       ===================================================== */

    async function selectChannel(
        channel
    ) {

        if (!channel) {
            return;
        }


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


        await markChannelRead();

    }


    function updateMainChannelUI(
        channel
    ) {

        if (!channel) {

            if (mainChannelIcon) {

                mainChannelIcon.textContent =
                    "#";

            }


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


        if (mainChannelIcon) {

            mainChannelIcon.textContent =
                channel.icon ||
                (
                    channel.channel_type ===
                    "voice"
                        ? "🔊"
                        : "#"
                );

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


            if (!older) {

                scrollMessagesToBottom();

            }

        } finally {

            state.loadingMessages =
                false;


            state.loadingOlder =
                false;

        }

    }


    /* =====================================================
       REACTIONS LOADING
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

            console.error(
                "Reaction loading error:",
                error
            );


            return;

        }


        for (
            const id
            of ids
        ) {

            state.reactions.set(
                id,
                []
            );

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
       RENDER MESSAGES
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

                    if (
                        state.currentChannel
                    ) {

                        await loadMessages(
                            state.currentChannel.id,
                            true
                        );

                    }

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


            empty.innerHTML = `
                <div class="empty-icon">💬</div>
                <strong>No messages yet</strong>
                <span>Start the conversation.</span>
            `;


            messageList.appendChild(
                empty
            );


            if (messageEmptyState) {

                messageEmptyState.classList.remove(
                    "hidden"
                );

            }


            return;

        }


        if (messageEmptyState) {

            messageEmptyState.classList.add(
                "hidden"
            );

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


        /* =================================================
           REPLY PREVIEW
           ================================================= */

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


        /* =================================================
           CONTENT
           ================================================= */

        if (message.is_deleted) {

            const deleted =
                document.createElement(
                    "div"
                );


            deleted.className =
                "message-content deleted-message";


            deleted.textContent =
                "This message was deleted.";


            body.appendChild(
                deleted
            );

        } else if (
            message.message_type ===
            "gif" &&
            message.content
        ) {

            const content =
                document.createElement(
                    "div"
                );


            content.className =
                "message-content";


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


            gif.referrerPolicy =
                "no-referrer";


            gif.onerror =
                () => {

                    gif.remove();


                    const unavailable =
                        document.createElement(
                            "span"
                        );


                    unavailable.textContent =
                        "GIF unavailable.";


                    content.appendChild(
                        unavailable
                    );

                };


            content.appendChild(
                gif
            );


            body.appendChild(
                content
            );

        } else if (
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


        /* =================================================
           ATTACHMENTS
           ================================================= */

        const attachmentContainer =
            document.createElement(
                "div"
            );


        attachmentContainer.className =
            "message-attachments";


        body.appendChild(
            attachmentContainer
        );


        loadAttachments(
            message.id,
            attachmentContainer
        );


        /* =================================================
           REACTIONS
           ================================================= */

        body.appendChild(
            createReactionBar(
                message
            )
        );


        /* =================================================
           ACTIONS
           ================================================= */

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
                event => {

                    event.stopPropagation();


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
                async event => {

                    event.stopPropagation();


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
       ATTACHMENTS - LOAD
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
                    file_size,
                    created_at
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

        const type =
            mimeType.toLowerCase();


        if (
            type.includes("pdf")
        ) {

            return "📕";

        }


        if (
            type.includes("word") ||
            type.includes("document")
        ) {

            return "📘";

        }


        if (
            type.includes("sheet") ||
            type.includes("excel")
        ) {

            return "📗";

        }


        if (
            type.includes("presentation") ||
            type.includes("powerpoint")
        ) {

            return "📙";

        }


        if (
            type.startsWith("image/")
        ) {

            return "🖼️";

        }


        if (
            type.startsWith("video/")
        ) {

            return "🎬";

        }


        return "📎";

    }


    /* =====================================================
       ATTACHMENTS - SELECT
       ===================================================== */

    function setupAttachmentButton() {

        if (
            !attachButton ||
            !attachmentInput
        ) {

            console.warn(
                "Attachment controls were not found."
            );


            return;

        }


        attachButton.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                if (!requireRules()) {
                    return;
                }


                attachmentInput.click();

            }
        );


        attachmentInput.addEventListener(
            "change",
            () => {

                const file =
                    attachmentInput.files?.[0];


                if (!file) {
                    return;
                }


                if (
                    file.size >
                    MAX_FILE_SIZE
                ) {

                    showToast(
                        "Files must be 25 MB or smaller."
                    );


                    attachmentInput.value =
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
            $("attachmentPreview");


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


        remove.title =
            "Remove attachment";


        remove.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                state.selectedAttachment =
                    null;


                preview.remove();


                if (attachmentInput) {

                    attachmentInput.value =
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
       ATTACHMENT UPLOAD
       ===================================================== */

    async function uploadAttachment(
        messageId,
        file
    ) {

        if (
            !file ||
            !state.user
        ) {

            return false;

        }


        const safeName =
            file.name.replace(
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
            `${state.user.id}/${Date.now()}-${unique}-${safeName}`;


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


            return false;

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


            return false;

        }


        return true;

    }


    /* =====================================================
       EMOJI PICKER
       ===================================================== */

    const EMOJIS = [

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
        "🎮",
        "⚽",
        "🏆",
        "✨",
        "✅",
        "❌",
        "💡",
        "🚀",
        "❤️‍🔥"

    ];


    function buildEmojiPicker() {

        if (!emojiGrid) {
            return;
        }


        emojiGrid.innerHTML =
            "";


        for (
            const emoji
            of EMOJIS
        ) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "emoji-choice";


            button.textContent =
                emoji;


            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();


                    insertEmoji(
                        emoji
                    );

                }
            );


            emojiGrid.appendChild(
                button
            );

        }

    }


    function openEmojiPicker() {

        if (!emojiPicker) {
            return;
        }


        if (!requireRules()) {
            return;
        }


        buildEmojiPicker();


        emojiPicker.classList.remove(
            "hidden"
        );


        emojiButton?.setAttribute(
            "aria-expanded",
            "true"
        );


        setTimeout(() => {

            document.addEventListener(
                "click",
                handleEmojiOutsideClick
            );

        }, 0);

    }


    function closeEmojiPicker() {

        if (!emojiPicker) {
            return;
        }


        emojiPicker.classList.add(
            "hidden"
        );


        emojiButton?.setAttribute(
            "aria-expanded",
            "false"
        );


        document.removeEventListener(
            "click",
            handleEmojiOutsideClick
        );

    }


    function toggleEmojiPicker() {

        if (
            emojiPicker?.classList.contains(
                "hidden"
            )
        ) {

            openEmojiPicker();

        } else {

            closeEmojiPicker();

        }

    }


    function handleEmojiOutsideClick(
        event
    ) {

        if (!emojiPicker) {
            return;
        }


        if (
            emojiPicker.contains(
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


        const cursor =
            start +
            emoji.length;


        messageInput.focus();


        messageInput.setSelectionRange(
            cursor,
            cursor
        );


        closeEmojiPicker();

    }


    function setupEmojiButton() {

        if (!emojiButton) {
            return;
        }


        emojiButton.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                toggleEmojiPicker();

            }
        );


        closeEmojiButton?.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                closeEmojiPicker();

            }
        );


        emojiPicker?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

            }
        );

    }


    /* =====================================================
       GIF PICKER
       ===================================================== */

    function setupGifPicker() {

        if (!gifButton) {
            return;
        }


        gifButton.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                if (!requireRules()) {
                    return;
                }


                openGifPicker();

            }
        );


        closeGifButton?.addEventListener(
            "click",
            event => {

                event.preventDefault();


                closeGifPicker();

            }
        );


        previewGifButton?.addEventListener(
            "click",
            event => {

                event.preventDefault();


                previewGif();

            }
        );


        sendGifButton?.addEventListener(
            "click",
            async event => {

                event.preventDefault();


                await sendGifFromPicker();

            }
        );


        gifUrlInput?.addEventListener(
            "input",
            () => {

                updateGifPreviewState();

            }
        );


        gifPicker?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

            }
        );

    }


    function openGifPicker() {

        if (!gifPicker) {
            return;
        }


        gifPicker.classList.remove(
            "hidden"
        );


        if (gifUrlInput) {

            gifUrlInput.focus();

        }


        updateGifPreviewState();

    }


    function closeGifPicker() {

        gifPicker?.classList.add(
            "hidden"
        );


        if (gifPreview) {

            gifPreview.innerHTML =
                "";

        }


        if (gifUrlInput) {

            gifUrlInput.value =
                "";

        }


        if (sendGifButton) {

            sendGifButton.disabled =
                true;

        }

    }


    function updateGifPreviewState() {

        const url =
            gifUrlInput
                ?.value
                ?.trim() ||
            "";


        if (sendGifButton) {

            sendGifButton.disabled =
                !isGifUrl(url);

        }

    }


    function previewGif() {

        const url =
            gifUrlInput
                ?.value
                ?.trim() ||
            "";


        if (!isGifUrl(url)) {

            showToast(
                "Please enter a valid GIF URL."
            );


            return;

        }


        if (!gifPreview) {
            return;
        }


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


        image.className =
            "gif-preview-image";


        image.onload =
            () => {

                if (sendGifButton) {

                    sendGifButton.disabled =
                        false;

                }

            };


        image.onerror =
            () => {

                gifPreview.textContent =
                    "The GIF could not be loaded.";


                if (sendGifButton) {

                    sendGifButton.disabled =
                        true;

                }

            };


        gifPreview.appendChild(
            image
        );

    }


    async function sendGifFromPicker() {

        const url =
            gifUrlInput
                ?.value
                ?.trim() ||
            "";


        if (!isGifUrl(url)) {

            showToast(
                "Please enter a valid GIF URL."
            );


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


        if (sendGifButton) {

            sendGifButton.disabled =
                true;

        }


        try {

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


            closeGifPicker();


            await refreshCurrentChannel();


        } finally {

            if (sendGifButton) {

                sendGifButton.disabled =
                    false;

            }

        }

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


            const info =
                grouped.get(
                    reaction.reaction
                );


            info.count++;


            if (
                state.user &&
                reaction.user_id ===
                    state.user.id
            ) {

                info.mine =
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
                async event => {

                    event.preventDefault();
                    event.stopPropagation();


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

                    event.preventDefault();
                    event.stopPropagation();


                    await toggleReaction(
                        messageId,
                        emoji
                    );


                    closeReactionPicker();

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
            `${Math.max(
                8,
                Math.min(
                    rect.left,
                    window.innerWidth - 250
                )
            )}px`;


        picker.style.top =
            `${Math.min(
                rect.bottom + 6,
                window.innerHeight - 70
            )}px`;


        setTimeout(() => {

            document.addEventListener(
                "click",
                handleReactionOutsideClick
            );

        }, 0);

    }


    function handleReactionOutsideClick(
        event
    ) {

        const picker =
            document.querySelector(
                ".reaction-picker"
            );


        if (!picker) {
            return;
        }


        if (
            picker.contains(
                event.target
            )
        ) {

            return;

        }


        closeReactionPicker();

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


        document.removeEventListener(
            "click",
            handleReactionOutsideClick
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


            showToast(
                "Reaction could not be changed."
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


                showToast(
                    "Reaction could not be removed."
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


                showToast(
                    "Reaction could not be added."
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


        if (sendMessageButton) {

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
                    state.profile || {

                        id:
                            state.user.id,

                        full_name:
                            "Student",

                        photo_url:
                            null

                    }
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

            if (sendMessageButton) {

                sendMessageButton.disabled =
                    false;

            }

        }

    }


    /* =====================================================
       REFRESH CURRENT CHANNEL
       ===================================================== */

    async function refreshCurrentChannel() {

        if (!state.currentChannel) {
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


        await markChannelRead();

    }


    /* =====================================================
       REPLY
       ===================================================== */

    function startReply(
        message
    ) {

        if (!message) {
            return;
        }


        state.replyingTo =
            message;


        let indicator =
            $("replyIndicator");


        if (!indicator) {

            indicator =
                document.createElement(
                    "div"
                );


            indicator.id =
                "replyIndicator";


            indicator.className =
                "reply-indicator";


            messageForm?.prepend(
                indicator
            );

        }


        indicator.innerHTML =
            "";


        const profile =
            state.profiles.get(
                message.user_id
            );


        const text =
            document.createElement(
                "span"
            );


        text.textContent =
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


        cancel.title =
            "Cancel reply";


        cancel.addEventListener(
            "click",
            cancelReply
        );


        indicator.appendChild(
            text
        );


        indicator.appendChild(
            cancel
        );


        messageInput?.focus();

    }


    function cancelReply() {

        state.replyingTo =
            null;


        $("replyIndicator")
            ?.remove();

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


        const now =
            new Date().toISOString();


        const {
            error
        } =
            await supabase
                .from("chat_messages")
                .update({

                    is_deleted:
                        true,

                    deleted_at:
                        now,

                    updated_at:
                        now,

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
       CLEAR COMPOSER
       ===================================================== */

    function clearComposer() {

        if (messageInput) {

            messageInput.value =
                "";

        }


        state.selectedAttachment =
            null;


        $("attachmentPreview")
            ?.remove();


        if (attachmentInput) {

            attachmentInput.value =
                "";

        }


        cancelReply();


        closeEmojiPicker();
        closeGifPicker();

    }


    /* =====================================================
       MESSAGE INPUT
       ===================================================== */

    function setupMessageInput() {

        if (!messageInput) {
            return;
        }


        messageInput.addEventListener(
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


        messageInput.addEventListener(
            "input",
            () => {

                messageInput.style.height =
                    "auto";


                messageInput.style.height =
                    `${Math.min(
                        messageInput.scrollHeight,
                        160
                    )}px`;

            }
        );

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
                    "Realtime cleanup error:",
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


        if (!channelId) {
            return;
        }


        const realtime =
            supabase
                .channel(
                    `community-channel-${channelId}`
                )
                .on(
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

                        await handleRealtimeMessage(
                            payload.new
                        );

                    }
                )
                .on(
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
                    async payload => {

                        await handleRealtimeMessageUpdate(
                            payload.new
                        );

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_message_reactions"

                    },
                    async () => {

                        if (
                            state.currentChannel?.id ===
                            channelId
                        ) {

                            await refreshCurrentChannel();

                        }

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_attachments"

                    },
                    async () => {

                        if (
                            state.currentChannel?.id ===
                            channelId
                        ) {

                            await refreshCurrentChannel();

                        }

                    }
                )
                .subscribe(
                    status => {

                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            console.log(
                                "✅ Community realtime connected:",
                                channelId
                            );

                        }

                    }
                );


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


        const exists =
            state.messages.some(
                item =>
                    item.id ===
                    message.id
            );


        if (exists) {
            return;
        }


        await loadMessageProfiles(
            [message]
        );


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


        await loadReactionsForMessages(
            [message]
        );


        renderMessages();


        scrollMessagesToBottom();


        await markChannelRead();

    }


    async function handleRealtimeMessageUpdate(
        message
    ) {

        if (
            message.channel_id !==
            state.currentChannel?.id
        ) {

            return;

        }


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


        const {
            error
        } =
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


        if (error) {

            console.warn(
                "Read status error:",
                error
            );

        }

    }


    /* =====================================================
       GENERAL CHAT
       ===================================================== */

    async function openGeneralChat() {

        if (!requireRules()) {
            return;
        }


        if (!state.communities.length) {

            await loadCommunities();

            return;

        }


        let general =
            state.channels.find(
                channel =>
                    channel.slug ===
                    "general"
            );


        if (general) {

            await selectChannel(
                general
            );


            return;

        }


        /*
           Search all communities for a general channel.
        */

        for (
            const community
            of state.communities
        ) {

            const {
                data,
                error
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
                    .eq(
                        "is_archived",
                        false
                    )
                    .maybeSingle();


            if (error) {

                console.warn(
                    "General channel search:",
                    error
                );


                continue;

            }


            if (data) {

                await selectCommunity(
                    community
                );


                await selectChannel(
                    data
                );


                return;

            }

        }


        showToast(
            "The General Chat channel has not been created yet."
        );

    }


    /* =====================================================
       NAVIGATION
       ===================================================== */

    function goToDashboard() {

        window.location.href =
            "./dashboard.html";

    }


    function goToProfile() {

        window.location.href =
            "./profile.html";

    }


    /* =====================================================
       UI EVENTS
       ===================================================== */

    function setupEvents() {

        if (
            state.eventListenersReady
        ) {

            return;

        }


        messageForm?.addEventListener(
            "submit",
            sendMessage
        );


        /*
           Do NOT attach a second send handler to
           sendMessageButton because the form already
           handles submission.
        */


        channelSearchInput?.addEventListener(
            "input",
            renderChannels
        );


        communityModalSearch?.addEventListener(
            "input",
            renderCommunityChoices
        );


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


        communityModal?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    communityModal
                ) {

                    closeCommunityModal();

                }

            }
        );


        $("dashboardButton")
            ?.addEventListener(
                "click",
                goToDashboard
            );


        $("homeButton")
            ?.addEventListener(
                "click",
                goToDashboard
            );


        $("railHomeButton")
            ?.addEventListener(
                "click",
                goToDashboard
            );


        $("railGeneralButton")
            ?.addEventListener(
                "click",
                openGeneralChat
            );


        $("railProfileButton")
            ?.addEventListener(
                "click",
                goToProfile
            );


        $("sidebarProfileButton")
            ?.addEventListener(
                "click",
                goToProfile
            );


        $("welcomeStartButton")
            ?.addEventListener(
                "click",
                () => {

                    if (!requireRules()) {
                        return;
                    }


                    messageInput?.focus();

                }
            );


        setupAttachmentButton();

        setupEmojiButton();

        setupGifPicker();

        setupMessageInput();


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeEmojiPicker();

                    closeReactionPicker();

                    closeGifPicker();

                    closeCommunityModal();

                }

            }
        );


        window.addEventListener(
            "beforeunload",
            () => {

                removeRealtimeChannels();

            }
        );


        state.eventListenersReady =
            true;

    }


    /* =====================================================
       AUTH STATE
       ===================================================== */

    function setupAuthListener() {

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


                    state.communities =
                        [];


                    state.currentCommunity =
                        null;


                    state.channels =
                        [];


                    state.currentChannel =
                        null;


                    state.messages =
                        [];


                    removeRealtimeChannels();


                    renderCommunityRail();
                    renderChannels();
                    clearMessages();

                }

            }
        );

    }


    /* =====================================================
       CLEAR MESSAGES
       ===================================================== */

    function clearMessages() {

        state.messages =
            [];


        state.reactions.clear();


        state.oldestMessageDate =
            null;


        state.hasOlderMessages =
            true;


        if (messageList) {

            messageList.innerHTML =
                "";

        }


        if (messageEmptyState) {

            messageEmptyState.classList.remove(
                "hidden"
            );

        }

    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {

            return;

        }


        state.initialized =
            true;


        console.log(
            "🚀 Mwaniki Scholars Community loading..."
        );


        /*
           Set up UI first so the rules gate is
           immediately usable.
        */

        setupRulesGate();

        setupEvents();

        setupAuthListener();


        const user =
            await loadCurrentUser();


        if (!user) {

            showToast(
                "Please sign in to use the community."
            );


            console.warn(
                "⚠️ No authenticated community user."
            );


            return;

        }


        await loadMyProfile();


        /*
           The rules gate blocks all community
           activity until accepted.
        */

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

        },


        openCommunityModal() {

            return openCommunityModal();

        },


        closeCommunityModal() {

            return closeCommunityModal();

        },


        acceptRules() {

            localStorage.setItem(
                RULES_VERSION,
                "true"
            );


            state.rulesAccepted =
                true;


            $("communityRulesGate")
                ?.classList.add(
                    "hidden"
                );


            return loadCommunities();

        }

    };


    /* =====================================================
       START
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
