/* =========================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE

   Handles ONLY:

   - Authentication
   - Communities
   - Channels
   - Messages
   - Attachments
   - Emoji
   - Message deletion
   - Realtime messages

   CALLING IS HANDLED BY THE INDEPENDENT CALL ENGINE.
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        user: null,

        communities: [],

        channels: [],

        currentCommunity: null,

        currentChannel: null,

        messages: [],

        attachments: new Map(),

        selectedFiles: [],

        messageSubscription: null,

        communitySubscription: null,

        channelSubscription: null,

        loadingMessages: false,

        sendingMessage: false

    };


    /* =====================================================
       DOM HELPER
       ===================================================== */

    const $ = id =>
        document.getElementById(id);


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (window.supabase) {

            return window.supabase;

        }

        if (window.supabaseClient) {

            return window.supabaseClient;

        }

        if (window.sb) {

            return window.sb;

        }

        return null;

    }


    function client() {

        const supabase =
            getSupabase();

        if (!supabase) {

            throw new Error(
                "Supabase client is not available."
            );

        }

        return supabase;

    }


    /* =====================================================
       STATUS
       ===================================================== */

    function announce(message) {

        const element =
            $("accessibilityAnnouncer");

        if (element) {

            element.textContent =
                message;

        }

        const status =
            $("communityStatus");

        if (status) {

            status.textContent =
                message;

        }

    }


    function toast(message) {

        const element =
            $("communityToast");

        if (!element) {

            console.log(
                "[Community]",
                message
            );

            return;

        }

        element.textContent =
            message;

        element.classList.add(
            "show"
        );

        clearTimeout(
            toast.timer
        );

        toast.timer =
            setTimeout(() => {

                element.classList.remove(
                    "show"
                );

            }, 3000);

    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function loadUser() {

        const supabase =
            client();

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


    function getUserName() {

        const user =
            state.user;

        if (!user) {

            return "Student";

        }

        const metadata =
            user.user_metadata || {};

        return (
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            user.email?.split("@")[0] ||
            "Student"
        );

    }


    function getUserAvatar() {

        const user =
            state.user;

        if (!user) {

            return createAvatar(
                "S"
            );

        }

        const metadata =
            user.user_metadata || {};

        const avatar =
            metadata.avatar_url ||
            metadata.picture ||
            metadata.photoURL;

        if (avatar) {

            return avatar;

        }

        return createAvatar(
            getInitials(
                getUserName()
            )
        );

    }


    /* =====================================================
       AVATAR
       ===================================================== */

    function getInitials(name) {

        const value =
            String(name || "Student")
                .trim();

        const parts =
            value
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {

            return "S";

        }

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


    function createAvatar(initials) {

        const safe =
            String(initials || "S")
                .slice(0, 2)
                .toUpperCase();

        const svg =
            `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="100"
                height="100"
                viewBox="0 0 100 100"
            >
                <rect
                    width="100"
                    height="100"
                    rx="50"
                    fill="#087f73"
                />
                <text
                    x="50"
                    y="54"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="white"
                    font-size="34"
                    font-family="Arial"
                    font-weight="700"
                >
                    ${safe}
                </text>
            </svg>
            `;

        return (
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(svg)
        );

    }


    function setProfileUI() {

        const name =
            getUserName();

        const avatar =
            getUserAvatar();


        const sidebarName =
            $("sidebarProfileName");

        if (sidebarName) {

            sidebarName.textContent =
                name;

        }


        const railAvatar =
            $("railProfileAvatar");

        if (railAvatar) {

            railAvatar.src =
                avatar;

        }


        const sidebarAvatar =
            $("sidebarProfileAvatar");

        if (sidebarAvatar) {

            sidebarAvatar.src =
                avatar;

        }

    }


    /* =====================================================
       URL / ICON HELPERS
       ===================================================== */

    function isImageUrl(value) {

        if (!value) {

            return false;

        }

        const text =
            String(value)
                .trim();

        return (
            /^https?:\/\//i.test(text) ||
            /^data:image\//i.test(text) ||
            /^blob:/i.test(text) ||
            /^\/\//.test(text)
        );

    }


    function setIcon(element, value, fallback = "💬") {

        if (!element) {

            return;

        }

        element.innerHTML = "";


        if (isImageUrl(value)) {

            const img =
                document.createElement(
                    "img"
                );

            img.src =
                value;

            img.alt = "";

            img.loading =
                "lazy";

            img.onerror =
                () => {

                    img.remove();

                    element.textContent =
                        fallback;

                };

            element.appendChild(
                img
            );

            return;

        }


        element.textContent =
            value || fallback;

    }


    /* =====================================================
       COMMUNITY LOADING
       ===================================================== */

    async function loadCommunities() {

        const supabase =
            client();

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_communities"
                )
                .select(
                    "*"
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
                "Community loading error:",
                error
            );

            toast(
                "Unable to load communities."
            );

            return;

        }


        const communities =
            data || [];


        let memberships = [];


        if (state.user) {

            const result =
                await supabase
                    .from(
                        "chat_community_members"
                    )
                    .select(
                        "community_id,role"
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (!result.error) {

                memberships =
                    result.data || [];

            }

        }


        const membershipMap =
            new Map(
                memberships.map(
                    item => [
                        item.community_id,
                        item
                    ]
                )
            );


        state.communities =
            communities.filter(
                community => {

                    if (
                        community.is_public
                    ) {

                        return true;

                    }

                    return membershipMap.has(
                        community.id
                    );

                }
            );


        renderCommunityRail();
        renderCommunityModal();


        if (!state.currentCommunity) {

            const first =
                state.communities[0];

            if (first) {

                await selectCommunity(
                    first.id
                );

            } else {

                renderNoCommunities();

            }

        } else {

            const stillExists =
                state.communities.find(
                    item =>
                        item.id ===
                        state.currentCommunity.id
                );

            if (stillExists) {

                state.currentCommunity =
                    stillExists;

                updateCommunityHeader();

            } else {

                state.currentCommunity =
                    null;

                state.currentChannel =
                    null;

                renderNoCommunities();

            }

        }

    }


    function renderNoCommunities() {

        const list =
            $("channelList");

        if (list) {

            list.innerHTML = "";

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "no-channels";

            element.textContent =
                "No communities are available.";

            list.appendChild(
                element
            );

        }

    }


    /* =====================================================
       COMMUNITY RAIL
       ===================================================== */

    function renderCommunityRail() {

        const rail =
            $("communityRailList");

        if (!rail) return;

        rail.innerHTML = "";


        state.communities
            .forEach(
                community => {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";

                    button.className =
                        "community-rail-item";


                    if (
                        state.currentCommunity &&
                        state.currentCommunity.id ===
                            community.id
                    ) {

                        button.classList.add(
                            "active"
                        );

                    }


                    button.title =
                        community.name;


                    setIcon(
                        button,
                        community.icon_url,
                        getInitials(
                            community.name
                        )
                    );


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

    }


    /* =====================================================
       COMMUNITY MODAL
       ===================================================== */

    function renderCommunityModal(
        filter = ""
    ) {

        const list =
            $("communityChoiceList");

        if (!list) return;

        list.innerHTML = "";


        const query =
            String(filter)
                .trim()
                .toLowerCase();


        const communities =
            state.communities
                .filter(
                    community => {

                        if (!query) {

                            return true;

                        }

                        return (
                            community.name
                                ?.toLowerCase()
                                .includes(query) ||
                            community.description
                                ?.toLowerCase()
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
                "no-channels";

            empty.textContent =
                "No communities found.";

            list.appendChild(
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


                const icon =
                    document.createElement(
                        "span"
                    );

                icon.className =
                    "community-choice-icon";


                setIcon(
                    icon,
                    community.icon_url,
                    getInitials(
                        community.name
                    )
                );


                const info =
                    document.createElement(
                        "span"
                    );

                info.className =
                    "community-choice-info";


                const name =
                    document.createElement(
                        "strong"
                    );

                name.textContent =
                    community.name ||
                    "Community";


                const description =
                    document.createElement(
                        "small"
                    );

                description.textContent =
                    community.description ||
                    "Academic community";


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
                    async () => {

                        closeCommunityModal();

                        await selectCommunity(
                            community.id
                        );

                    }
                );


                list.appendChild(
                    button
                );

            }
        );

    }


    function openCommunityModal() {

        const modal =
            $("communityModal");

        if (!modal) return;

        modal.classList.remove(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        const search =
            $("communityModalSearch");

        if (search) {

            search.value = "";

            renderCommunityModal();

            requestAnimationFrame(
                () => search.focus()
            );

        }

    }


    function closeCommunityModal() {

        const modal =
            $("communityModal");

        if (!modal) return;

        modal.classList.add(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

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
                    item.id ===
                    communityId
            );

        if (!community) {

            return;

        }


        state.currentCommunity =
            community;

        state.currentChannel =
            null;

        state.channels =
            [];

        renderCommunityRail();
        updateCommunityHeader();

        await loadChannels();

    }


    function updateCommunityHeader() {

        const community =
            state.currentCommunity;

        if (!community) return;


        setIcon(
            $("selectedCommunityIcon"),
            community.icon_url,
            getInitials(
                community.name
            )
        );


        const name =
            $("selectedCommunityName");

        if (name) {

            name.textContent =
                community.name;

        }


        const description =
            $("selectedCommunityDescription");

        if (description) {

            description.textContent =
                community.description ||
                "Academic community";

        }

    }


    /* =====================================================
       CHANNELS
       ===================================================== */

    async function loadChannels() {

        if (
            !state.currentCommunity
        ) {

            return;

        }


        const supabase =
            client();

        const communityId =
            state.currentCommunity.id;


        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_channels"
                )
                .select(
                    "*"
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
                )
                .order(
                    "created_at",
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


        const privateChannels =
            channels.filter(
                channel =>
                    channel.is_private
            );


        if (
            state.user &&
            privateChannels.length
        ) {

            const {
                data: memberships
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
                    );


            const allowed =
                new Set(
                    (memberships || [])
                        .map(
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

        } else {

            channels =
                channels.filter(
                    channel =>
                        !channel.is_private
                );

        }


        state.channels =
            channels;


        renderChannels();


        if (!state.currentChannel) {

            if (state.channels.length) {

                await selectChannel(
                    state.channels[0].id
                );

            } else {

                showEmptyChannel();

            }

            return;

        }


        const current =
            state.channels.find(
                channel =>
                    channel.id ===
                    state.currentChannel.id
            );


        if (current) {

            state.currentChannel =
                current;

            renderChannelHeader();

            await loadMessages();

        } else {

            state.currentChannel =
                null;

            if (state.channels.length) {

                await selectChannel(
                    state.channels[0].id
                );

            } else {

                showEmptyChannel();

            }

        }

    }


    function renderChannels(
        filter = ""
    ) {

        const list =
            $("channelList");

        if (!list) return;

        list.innerHTML = "";


        const query =
            String(filter)
                .trim()
                .toLowerCase();


        const channels =
            state.channels.filter(
                channel => {

                    if (!query) {

                        return true;

                    }

                    return (
                        channel.name
                            ?.toLowerCase()
                            .includes(query) ||
                        channel.description
                            ?.toLowerCase()
                            .includes(query)
                    );

                }
            );


        if (!channels.length) {

            const empty =
                document.createElement(
                    "div"
                );

            empty.className =
                "no-channels";

            empty.textContent =
                "No channels found.";

            list.appendChild(
                empty
            );

            return;

        }


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
                    state.currentChannel.id ===
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


                const info =
                    document.createElement(
                        "span"
                    );

                info.className =
                    "channel-info";


                const name =
                    document.createElement(
                        "span"
                    );

                name.className =
                    "channel-name";

                name.textContent =
                    channel.name;


                const description =
                    document.createElement(
                        "span"
                    );

                description.className =
                    "channel-description";

                description.textContent =
                    channel.description ||
                    (
                        channel.is_private
                            ? "Private channel"
                            : "Academic discussion"
                    );


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
                    () => {

                        selectChannel(
                            channel.id
                        );

                    }
                );


                list.appendChild(
                    button
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
                    item.id ===
                    channelId
            );

        if (!channel) {

            return;

        }


        state.currentChannel =
            channel;

        state.messages =
            [];

        state.attachments.clear();


        renderChannels(
            $("channelSearchInput")
                ?.value || ""
        );

        renderChannelHeader();

        closeEmojiPicker();

        await loadMessages();

    }


    function renderChannelHeader() {

        const channel =
            state.currentChannel;

        if (!channel) {

            return;

        }


        const icon =
            $("mainChannelIcon");

        if (icon) {

            icon.textContent =
                channel.icon ||
                (
                    channel.channel_type ===
                    "voice"
                        ? "🔊"
                        : "#"
                );

        }


        const title =
            $("mainChannelTitle");

        if (title) {

            title.textContent =
                channel.name ||
                "Channel";

        }


        const description =
            $("mainChannelDescription");

        if (description) {

            description.textContent =
                channel.description ||
                "Academic discussion channel";

        }


        announce(
            `Opened ${channel.name || "channel"}`
        );

    }


    function showEmptyChannel() {

        const list =
            $("messageList");

        if (!list) return;

        list.innerHTML = "";


        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-community";


        const icon =
            document.createElement(
                "div"
            );

        icon.className =
            "empty-community-icon";

        icon.textContent =
            "💬";


        const heading =
            document.createElement(
                "h2"
            );

        heading.textContent =
            "No channels available";


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "There are no accessible channels in this community yet.";


        empty.appendChild(
            icon
        );

        empty.appendChild(
            heading
        );

        empty.appendChild(
            paragraph
        );


        list.appendChild(
            empty
        );

    }


    /* =====================================================
       MESSAGES
       ===================================================== */

    async function loadMessages() {

        if (
            !state.currentChannel ||
            state.loadingMessages
        ) {

            return;

        }


        state.loadingMessages =
            true;


        const list =
            $("messageList");

        if (list) {

            list.innerHTML = "";

            const loading =
                document.createElement(
                    "div"
                );

            loading.className =
                "empty-community";

            loading.textContent =
                "Loading messages...";

            list.appendChild(
                loading
            );

        }


        try {

            const supabase =
                client();

            const {
                data,
                error
            } =
                await supabase
                    .from(
                        "chat_messages"
                    )
                    .select(
                        "*"
                    )
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
                    .limit(
                        100
                    );


            if (error) {

                throw error;

            }


            state.messages =
                (data || [])
                    .reverse();


            await loadAttachmentsForMessages();

            renderMessages();

            subscribeToMessages();

            scrollMessagesToBottom();

        } catch (error) {

            console.error(
                "Message loading error:",
                error
            );

            showMessageError();

        } finally {

            state.loadingMessages =
                false;

        }

    }


    async function loadAttachmentsForMessages() {

        state.attachments.clear();


        const ids =
            state.messages
                .map(
                    message =>
                        message.id
                )
                .filter(Boolean);


        if (!ids.length) {

            return;

        }


        const supabase =
            client();


        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_attachments"
                )
                .select(
                    "*"
                )
                .in(
                    "message_id",
                    ids
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


        (data || [])
            .forEach(
                attachment => {

                    if (
                        !state.attachments.has(
                            attachment.message_id
                        )
                    ) {

                        state.attachments.set(
                            attachment.message_id,
                            []
                        );

                    }

                    state.attachments
                        .get(
                            attachment.message_id
                        )
                        .push(
                            attachment
                        );

                }
            );

    }


    function subscribeToMessages() {

        const supabase =
            client();


        if (
            state.messageSubscription
        ) {

            supabase.removeChannel(
                state.messageSubscription
            );

        }


        const channelId =
            state.currentChannel?.id;


        if (!channelId) {

            return;

        }


        state.messageSubscription =
            supabase
                .channel(
                    `community-messages-${channelId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    async payload => {

                        if (
                            payload.eventType ===
                            "INSERT"
                        ) {

                            await handleNewMessage(
                                payload.new
                            );

                        }

                        else if (
                            payload.eventType ===
                            "UPDATE"
                        ) {

                            handleUpdatedMessage(
                                payload.new
                            );

                        }

                        else if (
                            payload.eventType ===
                            "DELETE"
                        ) {

                            handleDeletedMessage(
                                payload.old
                            );

                        }

                    }
                )
                .subscribe();

    }


    async function handleNewMessage(
        message
    ) {

        if (
            state.messages.some(
                item =>
                    item.id ===
                    message.id
            )
        ) {

            return;

        }


        state.messages.push(
            message
        );


        await loadAttachmentsForMessages();

        renderMessages();

        scrollMessagesToBottom();

    }


    function handleUpdatedMessage(
        message
    ) {

        const index =
            state.messages.findIndex(
                item =>
                    item.id ===
                    message.id
            );


        if (index === -1) {

            return;

        }


        state.messages[index] =
            message;


        renderMessages();

    }


    function handleDeletedMessage(
        message
    ) {

        const index =
            state.messages.findIndex(
                item =>
                    item.id ===
                    message.id
            );


        if (index !== -1) {

            state.messages[index] =
                message;

            renderMessages();

        }

    }


    function showMessageError() {

        const list =
            $("messageList");

        if (!list) return;

        list.innerHTML = "";


        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-community";


        const icon =
            document.createElement(
                "div"
            );

        icon.className =
            "empty-community-icon";

        icon.textContent =
            "⚠️";


        const heading =
            document.createElement(
                "h2"
            );

        heading.textContent =
            "Unable to load messages";


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "Please refresh the page and try again.";


        empty.appendChild(
            icon
        );

        empty.appendChild(
            heading
        );

        empty.appendChild(
            paragraph
        );


        list.appendChild(
            empty
        );

    }


    /* =====================================================
       RENDER MESSAGES
       ===================================================== */

    function renderMessages() {

        const list =
            $("messageList");

        if (!list) return;


        list.innerHTML = "";


        if (!state.messages.length) {

            renderWelcomeMessage(
                list
            );

            return;

        }


        state.messages.forEach(
            message => {

                list.appendChild(
                    createMessageElement(
                        message
                    )
                );

            }
        );

    }


    function renderWelcomeMessage(
        list
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "empty-community";


        const icon =
            document.createElement(
                "div"
            );

        icon.className =
            "empty-community-icon";

        icon.textContent =
            "🎓";


        const heading =
            document.createElement(
                "h2"
            );

        heading.textContent =
            `Welcome to #${state.currentChannel?.name || "this channel"}`;


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "This is the beginning of the conversation.";


        empty.appendChild(
            icon
        );

        empty.appendChild(
            heading
        );

        empty.appendChild(
            paragraph
        );


        list.appendChild(
            empty
        );

    }


    function createMessageElement(
        message
    ) {

        const group =
            document.createElement(
                "article"
            );

        group.className =
            "message-group";


        const avatar =
            document.createElement(
                "img"
            );

        avatar.className =
            "message-avatar";

        avatar.alt =
            "User avatar";

        avatar.src =
            createAvatar(
                getInitials(
                    message.user_id ===
                    state.user?.id
                        ? getUserName()
                        : "Student"
                )
            );


        const content =
            document.createElement(
                "div"
            );

        content.className =
            "message-content";


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
            message.user_id ===
            state.user?.id
                ? getUserName()
                : `Student ${String(message.user_id || "").slice(0, 8)}`;


        const time =
            document.createElement(
                "time"
            );

        time.className =
            "message-time";

        time.textContent =
            formatTime(
                message.created_at
            );


        meta.appendChild(
            author
        );

        meta.appendChild(
            time
        );


        content.appendChild(
            meta
        );


        if (
            message.is_deleted
        ) {

            const deleted =
                document.createElement(
                    "div"
                );

            deleted.className =
                "message-body message-deleted";

            deleted.textContent =
                "This message was deleted.";

            content.appendChild(
                deleted
            );

        } else {

            if (
                message.content
            ) {

                const body =
                    document.createElement(
                        "div"
                    );

                body.className =
                    "message-body";

                body.textContent =
                    message.content;

                content.appendChild(
                    body
                );

            }


            renderMessageAttachments(
                content,
                message.id
            );

        }


        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "message-actions";


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
                () => {

                    deleteMessage(
                        message.id
                    );

                }
            );

            actions.appendChild(
                deleteButton
            );

        }


        if (
            !message.is_deleted
        ) {

            const reactionButton =
                document.createElement(
                    "button"
                );

            reactionButton.type =
                "button";

            reactionButton.className =
                "message-action";

            reactionButton.textContent =
                "😊 React";

            reactionButton.addEventListener(
                "click",
                () => {

                    addReaction(
                        message.id,
                        "👍"
                    );

                }
            );

            actions.appendChild(
                reactionButton
            );

        }


        if (
            actions.children.length
        ) {

            content.appendChild(
                actions
            );

        }


        group.appendChild(
            avatar
        );

        group.appendChild(
            content
        );


        return group;

    }


    function renderMessageAttachments(
        parent,
        messageId
    ) {

        const attachments =
            state.attachments.get(
                messageId
            ) || [];


        if (!attachments.length) {

            return;

        }


        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "message-attachments";


        attachments.forEach(
            attachment => {

                const url =
                    attachment.file_url;


                if (
                    !url
                ) {

                    return;

                }


                const mime =
                    attachment.mime_type ||
                    "";


                if (
                    mime.startsWith(
                        "image/"
                    )
                ) {

                    const image =
                        document.createElement(
                            "img"
                        );

                    image.className =
                        "message-image";

                    image.src =
                        url;

                    image.alt =
                        attachment.file_name ||
                        "Image";

                    image.loading =
                        "lazy";


                    image.addEventListener(
                        "click",
                        () => {

                            window.open(
                                url,
                                "_blank",
                                "noopener"
                            );

                        }
                    );


                    wrapper.appendChild(
                        image
                    );

                    return;

                }


                const link =
                    document.createElement(
                        "a"
                    );

                link.className =
                    "file-attachment";

                link.href =
                    url;

                link.target =
                    "_blank";

                link.rel =
                    "noopener noreferrer";


                const icon =
                    document.createElement(
                        "span"
                    );

                icon.className =
                    "file-icon";

                icon.textContent =
                    getFileIcon(
                        mime,
                        attachment.file_name
                    );


                const info =
                    document.createElement(
                        "span"
                    );

                info.className =
                    "file-info";


                const name =
                    document.createElement(
                        "span"
                    );

                name.className =
                    "file-name";

                name.textContent =
                    attachment.file_name ||
                    "File";


                const meta =
                    document.createElement(
                        "span"
                    );

                meta.className =
                    "file-meta";

                meta.textContent =
                    formatBytes(
                        attachment.file_size
                    );


                info.appendChild(
                    name
                );

                info.appendChild(
                    meta
                );


                link.appendChild(
                    icon
                );

                link.appendChild(
                    info
                );


                wrapper.appendChild(
                    link
                );

            }
        );


        parent.appendChild(
            wrapper
        );

    }


    /* =====================================================
       SEND MESSAGE
       ===================================================== */

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
            !state.user
        ) {

            toast(
                "Please sign in first."
            );

            return;

        }


        if (
            !state.currentChannel
        ) {

            toast(
                "Select a channel first."
            );

            return;

        }


        const input =
            $("messageInput");


        const text =
            input?.value.trim() ||
            "";


        if (
            !text &&
            !state.selectedFiles.length
        ) {

            return;

        }


        state.sendingMessage =
            true;


        const sendButton =
            $("sendMessageButton");

        if (sendButton) {

            sendButton.disabled =
                true;

        }


        try {

            const supabase =
                client();


            const {
                data: message,
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
                            text || null,

                        message_type:
                            state.selectedFiles.length
                                ? "file"
                                : "text"

                    })
                    .select()
                    .single();


            if (error) {

                throw error;

            }


            if (
                state.selectedFiles.length
            ) {

                await uploadAttachments(
                    message.id,
                    state.selectedFiles
                );

            }


            if (input) {

                input.value =
                    "";

            }


            state.selectedFiles =
                [];

            renderAttachmentPreview();

            autoResizeInput();


            if (
                !state.messageSubscription
            ) {

                await loadMessages();

            }

        } catch (error) {

            console.error(
                "Send message error:",
                error
            );

            toast(
                "Unable to send message."
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


    /* =====================================================
       DELETE MESSAGE
       ===================================================== */

    async function deleteMessage(
        messageId
    ) {

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
            state.user?.id
        ) {

            toast(
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


        const supabase =
            client();


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
                        new Date()
                            .toISOString(),

                    updated_at:
                        new Date()
                            .toISOString()

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

            toast(
                "Unable to delete message."
            );

            return;

        }


        toast(
            "Message deleted."
        );

    }


    /* =====================================================
       ATTACHMENTS
       ===================================================== */

    function openFilePicker() {

        const input =
            $("communityFileInput");

        if (!input) return;

        input.click();

    }


    function handleFiles(
        event
    ) {

        const files =
            Array.from(
                event.target.files || []
            );


        if (!files.length) {

            return;

        }


        const maxSize =
            20 * 1024 * 1024;


        const accepted =
            files.filter(
                file => {

                    if (
                        file.size >
                        maxSize
                    ) {

                        toast(
                            `${file.name} is larger than 20 MB.`
                        );

                        return false;

                    }

                    return true;

                }
            );


        state.selectedFiles =
            [
                ...state.selectedFiles,
                ...accepted
            ];


        renderAttachmentPreview();


        event.target.value =
            "";

    }


    function renderAttachmentPreview() {

        const preview =
            $("attachmentPreview");

        if (!preview) return;


        preview.innerHTML = "";


        if (
            !state.selectedFiles.length
        ) {

            preview.classList.add(
                "hidden"
            );

            return;

        }


        preview.classList.remove(
            "hidden"
        );


        state.selectedFiles
            .forEach(
                (file, index) => {

                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "attachment-preview-item";


                    const icon =
                        document.createElement(
                            "span"
                        );

                    icon.textContent =
                        getFileIcon(
                            file.type,
                            file.name
                        );


                    const name =
                        document.createElement(
                            "span"
                        );

                    name.textContent =
                        file.name;


                    const remove =
                        document.createElement(
                            "button"
                        );

                    remove.type =
                        "button";

                    remove.className =
                        "remove-attachment";

                    remove.textContent =
                        "×";

                    remove.title =
                        "Remove file";


                    remove.addEventListener(
                        "click",
                        () => {

                            state.selectedFiles
                                .splice(
                                    index,
                                    1
                                );

                            renderAttachmentPreview();

                        }
                    );


                    item.appendChild(
                        icon
                    );

                    item.appendChild(
                        name
                    );

                    item.appendChild(
                        remove
                    );


                    preview.appendChild(
                        item
                    );

                }
            );

    }


    async function uploadAttachments(
        messageId,
        files
    ) {

        const supabase =
            client();


        for (
            const file of files
        ) {

            const safeName =
                sanitizeFileName(
                    file.name
                );


            const path =
                `${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;


            const {
                error:
                    uploadError
            } =
                await supabase
                    .storage
                    .from(
                        "chat-attachments"
                    )
                    .upload(
                        path,
                        file,
                        {
                            upsert:
                                false,

                            contentType:
                                file.type ||
                                "application/octet-stream"
                        }
                    );


            if (
                uploadError
            ) {

                console.error(
                    "File upload error:",
                    uploadError
                );

                toast(
                    `Could not upload ${file.name}.`
                );

                continue;

            }


            const {
                data:
                    publicData
            } =
                supabase
                    .storage
                    .from(
                        "chat-attachments"
                    )
                    .getPublicUrl(
                        path
                    );


            const fileUrl =
                publicData?.publicUrl ||
                null;


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
                            null,

                        file_size:
                            file.size

                    });


            if (
                attachmentError
            ) {

                console.error(
                    "Attachment record error:",
                    attachmentError
                );

            }

        }

    }


    function sanitizeFileName(
        name
    ) {

        return String(name || "file")
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            )
            .slice(
                0,
                180
            );

    }


    function getFileIcon(
        mime,
        name
    ) {

        const type =
            String(mime || "")
                .toLowerCase();

        const extension =
            String(name || "")
                .split(".")
                .pop()
                .toLowerCase();


        if (
            type.startsWith(
                "image/"
            )
        ) {

            return "🖼️";

        }

        if (
            type.includes(
                "pdf"
            ) ||
            extension === "pdf"
        ) {

            return "📕";

        }

        if (
            type.includes(
                "word"
            ) ||
            ["doc", "docx"]
                .includes(
                    extension
                )
        ) {

            return "📘";

        }

        if (
            type.includes(
                "spreadsheet"
            ) ||
            ["xls", "xlsx", "csv"]
                .includes(
                    extension
                )
        ) {

            return "📗";

        }

        if (
            type.includes(
                "presentation"
            ) ||
            ["ppt", "pptx"]
                .includes(
                    extension
                )
        ) {

            return "📙";

        }

        if (
            ["zip", "rar", "7z"]
                .includes(
                    extension
                )
        ) {

            return "🗜️";

        }

        return "📄";

    }


    function formatBytes(
        bytes
    ) {

        if (
            !bytes ||
            Number(bytes) <= 0
        ) {

            return "File";

        }


        const units =
            [
                "B",
                "KB",
                "MB",
                "GB"
            ];


        let size =
            Number(bytes);

        let index =
            0;


        while (
            size >= 1024 &&
            index < units.length - 1
        ) {

            size /=
                1024;

            index++;

        }


        return (
            `${size.toFixed(index ? 1 : 0)} ${units[index]}`
        );

    }


    /* =====================================================
       REACTIONS
       ===================================================== */

    async function addReaction(
        messageId,
        reaction
    ) {

        if (!state.user) {

            return;

        }


        const supabase =
            client();


        const {
            data: existing,
            error:
                findError
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

            await supabase
                .from(
                    "chat_message_reactions"
                )
                .delete()
                .eq(
                    "id",
                    existing.id
                );

            return;

        }


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
                "Reaction error:",
                error
            );

        }

    }


    /* =====================================================
       EMOJI
       ===================================================== */

    const EMOJIS = [

        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😗","😙","😚","😋","😛","😝","😜",
        "🤪","🤨","🧐","🤓","😎","🥳","🤩","🥸",

        "😏","😒","😞","😔","😟","😕","🙁","☹️",
        "😣","😖","😫","😩","🥺","😢","😭","😤",
        "😠","😡","🤬","🤯","😳","🥵","🥶","😱",
        "😨","😰","😥","😓","🤗","🤔","🤭","🤫",

        "🤥","😶","😐","😑","😬","🙄","😯","😦",
        "😧","😮","😲","🥱","😴","🤤","😪","😵",
        "🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕",

        "👍","👎","👏","🙌","👐","🤝","🙏","💪",
        "👋","🤟","✌️","🤞","🤙","👌","🤌","🤏",
        "👈","👉","👆","👇","☝️","✋","🤚","🖐️",
        "💯","🔥","✨","⭐","🌟","❤️","💚","💙",

        "🎓","📚","📖","📝","✏️","🔬","🧪","🧬",
        "🩺","💊","🧫","🦠","🧠","🫀","🫁","🩸",
        "🏥","🚑","💉","🔍","📊","📈","💡","🎯",

        "😂","🤣","😅","😎","🤔","😴","😭","😱",
        "🥳","🤩","🙃","😈","👻","💀","🤖","👽",

        "🎮","🎯","🏆","⚽","🏀","🎲","🕹️","🎮",

        "🌍","🌎","🌏","🌞","🌙","⭐","☀️","🌧️",
        "🌈","🌊","🌱","🌿","🍀","🌸","🌻","🌺",

        "🍎","🍌","🍕","🍔","🍟","🌮","🍿","☕",
        "🍵","🥤","🎂","🍰","🍪","🍫","🍓","🍉"

    ];


    function setupEmojiPicker() {

        const grid =
            $("emojiGrid");

        if (!grid) return;

        grid.innerHTML = "";


        EMOJIS.forEach(
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

                button.title =
                    emoji;

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


    function openEmojiPicker() {

        const picker =
            $("emojiPicker");

        const button =
            $("emojiButton");

        if (!picker) return;


        picker.classList.remove(
            "hidden"
        );


        button?.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function closeEmojiPicker() {

        const picker =
            $("emojiPicker");

        const button =
            $("emojiButton");


        if (!picker) return;


        picker.classList.add(
            "hidden"
        );


        button?.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    function toggleEmojiPicker() {

        const picker =
            $("emojiPicker");

        if (!picker) return;


        if (
            picker.classList.contains(
                "hidden"
            )
        ) {

            openEmojiPicker();

        } else {

            closeEmojiPicker();

        }

    }


    function insertEmoji(
        emoji
    ) {

        const input =
            $("messageInput");

        if (!input) return;


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


    /* =====================================================
       INPUT
       ===================================================== */

    function autoResizeInput() {

        const input =
            $("messageInput");

        if (!input) return;


        input.style.height =
            "auto";


        input.style.height =
            Math.min(
                input.scrollHeight,
                130
            ) +
            "px";

    }


    function handleMessageKeydown(
        event
    ) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatTime(
        value
    ) {

        if (!value) {

            return "";

        }


        const date =
            new Date(
                value
            );


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
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );

    }


    /* =====================================================
       SCROLL
       ===================================================== */

    function scrollMessagesToBottom() {

        const list =
            $("messageList");

        if (!list) return;


        requestAnimationFrame(
            () => {

                list.scrollTop =
                    list.scrollHeight;

            }
        );

    }


    /* =====================================================
       UI EVENTS
       ===================================================== */

    function setupEvents() {

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
                event => {

                    renderCommunityModal(
                        event.target.value
                    );

                }
            );


        $("channelSearchInput")
            ?.addEventListener(
                "input",
                event => {

                    renderChannels(
                        event.target.value
                    );

                }
            );


        $("messageForm")
            ?.addEventListener(
                "submit",
                sendMessage
            );


        $("messageInput")
            ?.addEventListener(
                "keydown",
                handleMessageKeydown
            );


        $("messageInput")
            ?.addEventListener(
                "input",
                autoResizeInput
            );


        $("attachButton")
            ?.addEventListener(
                "click",
                openFilePicker
            );


        $("communityFileInput")
            ?.addEventListener(
                "change",
                handleFiles
            );


        $("emojiButton")
            ?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleEmojiPicker();

                }
            );


        $("closeEmojiButton")
            ?.addEventListener(
                "click",
                closeEmojiPicker
            );


        $("welcomeStartButton")
            ?.addEventListener(
                "click",
                openCommunityModal
            );


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


        $("railProfileButton")
            ?.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "./dashboard.html";

                }
            );


        $("sidebarProfileButton")
            ?.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "./dashboard.html";

                }
            );


        document.addEventListener(
            "click",
            event => {

                const picker =
                    $("emojiPicker");

                const button =
                    $("emojiButton");


                if (!picker) {

                    return;

                }


                if (
                    picker.classList.contains(
                        "hidden"
                    )
                ) {

                    return;

                }


                if (
                    picker.contains(
                        event.target
                    ) ||
                    button?.contains(
                        event.target
                    )
                ) {

                    return;

                }


                closeEmojiPicker();

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

                    closeCommunityModal();

                    const callModal =
                        $("generalCallModal");

                    if (
                        callModal &&
                        !callModal.classList.contains(
                            "hidden"
                        )
                    ) {

                        callModal.classList.add(
                            "hidden"
                        );

                        callModal.setAttribute(
                            "aria-hidden",
                            "true"
                        );

                    }

                }

            }
        );


        $("communityModal")
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        $("communityModal")
                    ) {

                        closeCommunityModal();

                    }

                }
            );


        /*
         * We intentionally DO NOT add a listener to
         * generalCallButton.
         *
         * The independent call engine owns it.
         */

    }


    /* =====================================================
       AUTH STATE
       ===================================================== */

    function subscribeToAuth() {

        const supabase =
            client();


        supabase.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {

                state.user =
                    session?.user ||
                    null;


                setProfileUI();


                if (
                    event ===
                    "SIGNED_IN"
                ) {

                    await loadCommunities();

                }


                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    state.user =
                        null;

                    state.communities =
                        [];

                    state.channels =
                        [];

                    state.currentCommunity =
                        null;

                    state.currentChannel =
                        null;

                    renderCommunityRail();

                    renderNoCommunities();

                }

            }
        );

    }


    /* =====================================================
       CLEANUP
       ===================================================== */

    function cleanupSubscriptions() {

        const supabase =
            getSupabase();

        if (!supabase) {

            return;

        }


        if (
            state.messageSubscription
        ) {

            supabase.removeChannel(
                state.messageSubscription
            );

            state.messageSubscription =
                null;

        }


        if (
            state.communitySubscription
        ) {

            supabase.removeChannel(
                state.communitySubscription
            );

            state.communitySubscription =
                null;

        }


        if (
            state.channelSubscription
        ) {

            supabase.removeChannel(
                state.channelSubscription
            );

            state.channelSubscription =
                null;

        }

    }


    /* =====================================================
       COMMUNITY REALTIME
       ===================================================== */

    function subscribeToCommunityChanges() {

        const supabase =
            client();


        if (
            state.communitySubscription
        ) {

            supabase.removeChannel(
                state.communitySubscription
            );

        }


        state.communitySubscription =
            supabase
                .channel(
                    "mwaniki-community-updates"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "chat_communities"
                    },
                    () => {

                        loadCommunities();

                    }
                )
                .subscribe();

    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function initialize() {

        console.log(
            "🚀 Mwaniki Scholars Community loading..."
        );


        try {

            /*
             * supabase.js is a module, so wait briefly
             * for its global client if necessary.
             */

            let attempts =
                0;


            while (
                !getSupabase() &&
                attempts < 50
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            100
                        )
                );

                attempts++;

            }


            if (!getSupabase()) {

                throw new Error(
                    "Supabase client was not found."
                );

            }


            await loadUser();

            setProfileUI();

            setupEvents();

            setupEmojiPicker();

            subscribeToAuth();

            subscribeToCommunityChanges();

            await loadCommunities();


            console.log(
                "✅ Mwaniki Scholars Community ready"
            );


            announce(
                "Community loaded"
            );

        } catch (error) {

            console.error(
                "Community initialization error:",
                error
            );

            toast(
                "Community failed to initialize."
            );

        }

    }


    /* =====================================================
       PAGE CLEANUP
       ===================================================== */

    window.addEventListener(
        "beforeunload",
        cleanupSubscriptions
    );


    /* =====================================================
       START
       ===================================================== */

    initialize();


})();
