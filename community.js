/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   ---------------------------------------------------------
   - Supabase community/chat engine
   - Messages
   - Reactions
   - Attachments
   - GIFs
   - Emoji
   - Voice notes
   - Delete own messages
   - Realtime messages
   - Community switching
   - Channel switching
   - Rules gate
   - General-call event bridge
   ---------------------------------------------------------
   WebRTC/call engine belongs ONLY in call.js
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       CONFIG
       ===================================================== */

    const DEFAULT_DISCUSSION_ID =
        "9044c031-71da-496d-9166-ff19ed4fcb62";

    const DEFAULT_DISCUSSION_NAME =
        "Mwaniki Scholars";

    const STORAGE_BUCKET =
        "chat-attachments";

    const RULES_VERSION =
        "mwaniki-community-rules-v3";

    const MESSAGE_PAGE_SIZE =
        50;

    const MAX_FILE_SIZE =
        50 * 1024 * 1024;


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        supabase: null,

        user: null,

        profile: null,

        communities: [],

        channels: [],

        members: [],

        messages: [],

        reactions: [],

        attachments: [],

        publicProfiles: [],

        selectedCommunity: null,

        selectedChannel: null,

        selectedMessageForReply: null,

        messageOffset: 0,

        hasMoreMessages: true,

        loadingMessages: false,

        sendingMessage: false,

        selectedFiles: [],

        recording: false,

        mediaRecorder: null,

        recordedChunks: [],

        recordingStartedAt: 0,

        recordingTimer: null,

        realtimeChannel: null,

        emojiOpen: false,

        gifOpen: false,

        memberSidebarOpen: true,

        initialized: false

    };


    /* =====================================================
       DOM
       ===================================================== */

    const $ = (id) =>
        document.getElementById(id);


    /* =====================================================
       UTILITIES
       ===================================================== */

    function sleep(ms) {
        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );
    }


    async function waitForSupabase(timeout = 10000) {

        const started =
            Date.now();

        while (!window.supabase) {

            if (
                Date.now() - started >
                timeout
            ) {
                throw new Error(
                    "Supabase client was not available after 10 seconds."
                );
            }

            await sleep(100);

        }

        return window.supabase;
    }


    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function safeUrl(value) {

        try {

            const url =
                new URL(value);

            if (
                url.protocol === "http:" ||
                url.protocol === "https:"
            ) {
                return url.href;
            }

        } catch (_) {}

        return "";
    }


    function initials(name) {

        const value =
            String(name || "Student")
                .trim();

        if (!value) {
            return "S";
        }

        const parts =
            value
                .split(/\s+/)
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


    function formatFileSize(bytes) {

        const size =
            Number(bytes || 0);

        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }

        return `${(
            size /
            (1024 * 1024)
        ).toFixed(1)} MB`;
    }


    function formatTime(dateValue) {

        if (!dateValue) {
            return "";
        }

        const date =
            new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
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


    function formatRecordingTime(seconds) {

        const value =
            Math.max(0, Number(seconds || 0));

        const minutes =
            Math.floor(value / 60);

        const remaining =
            value % 60;

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(remaining).padStart(2, "0")
        );
    }


    function showToast(message) {

        const toast =
            $("communityToast");

        if (!toast) {
            return;
        }

        toast.textContent =
            message;

        toast.classList.remove("hidden");

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(() => {

                toast.classList.add(
                    "hidden"
                );

            }, 2800);
    }


    function setMessage(
        elementId,
        message
    ) {

        const element =
            $(elementId);

        if (element) {
            element.textContent =
                message || "";
        }
    }


    function closePickerMenus() {

        const emojiPicker =
            $("emojiPicker");

        const gifPicker =
            $("gifPicker");

        if (emojiPicker) {
            emojiPicker.classList.add(
                "hidden"
            );
        }

        if (gifPicker) {
            gifPicker.classList.add(
                "hidden"
            );
        }

        state.emojiOpen = false;
        state.gifOpen = false;
    }


    /* =====================================================
       COMMUNITY ICONS
       -----------------------------------------------------
       IMPORTANT:
       icon_url is intentionally NOT used here.
       ===================================================== */

    function communityIcon(community) {

        const name =
            String(
                community?.name || ""
            )
                .trim()
                .toLowerCase();

        if (
            name.includes("gaming") ||
            name.includes("game")
        ) {
            return "🎮";
        }

        if (
            name.includes("meme") ||
            name.includes("fun")
        ) {
            return "😂";
        }

        if (
            name.includes("mwaniki") ||
            name.includes("scholar") ||
            name.includes("academic")
        ) {
            return "🎓";
        }

        return "🌐";
    }


    function channelIcon(channel) {

        const icon =
            String(channel?.icon || "")
                .trim();

        if (icon) {
            return icon;
        }

        const type =
            String(
                channel?.channel_type || ""
            ).toLowerCase();

        if (type.includes("announcement")) {
            return "📢";
        }

        if (type.includes("study")) {
            return "📚";
        }

        if (type.includes("voice")) {
            return "🔊";
        }

        return "#";
    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function loadAuthenticatedUser() {

        const {
            data,
            error
        } =
            await state.supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!data?.user) {

            showToast(
                "Please sign in before entering the community."
            );

            throw new Error(
                "No authenticated Supabase user."
            );
        }

        state.user =
            data.user;

        return data.user;
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    async function loadProfile() {

        if (!state.user) {
            return;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from("students")
                .select("*")
                .eq(
                    "id",
                    state.user.id
                )
                .maybeSingle();

        if (error) {
            console.warn(
                "Profile query warning:",
                error
            );
        }

        state.profile =
            data || {
                id: state.user.id,
                full_name:
                    state.user.user_metadata
                        ?.full_name ||
                    state.user.email ||
                    "Student",
                email:
                    state.user.email || ""
            };

        renderCurrentUser();
    }


    function getCurrentUserName() {

        return (
            state.profile?.full_name ||
            state.profile?.name ||
            state.user?.user_metadata
                ?.full_name ||
            state.user?.email ||
            "Student"
        );
    }


    function getProfileAvatar(profile) {

        return (
            profile?.avatar_url ||
            profile?.profile_image ||
            profile?.photo_url ||
            profile?.image_url ||
            profile?.photo ||
            ""
        );
    }


    function renderCurrentUser() {

        const name =
            getCurrentUserName();

        const avatar =
            getProfileAvatar(
                state.profile
            );

        const avatarElement =
            $("currentUserAvatar");

        if (avatarElement) {

            if (safeUrl(avatar)) {

                avatarElement.innerHTML =
                    `<img src="${escapeHtml(
                        safeUrl(avatar)
                    )}" alt="">`;

            } else {

                avatarElement.textContent =
                    initials(name);
            }
        }

        const nameElement =
            $("currentUserName");

        if (nameElement) {
            nameElement.textContent =
                name;
        }

        const status =
            $("currentUserStatus");

        if (status) {
            status.textContent =
                "Online";
        }
    }


    /* =====================================================
       RULES
       ===================================================== */

    function rulesAccepted() {

        try {

            return (
                localStorage.getItem(
                    RULES_VERSION
                ) === "accepted"
            );

        } catch (_) {

            return false;

        }
    }


    function showRulesGate() {

        const gate =
            $("rulesGate");

        if (!gate) {
            return;
        }

        if (rulesAccepted()) {

            gate.classList.add(
                "hidden"
            );

            return;
        }

        gate.classList.remove(
            "hidden"
        );
    }


    function setupRules() {

        const checkbox =
            $("communityRulesAgreement");

        const button =
            $("acceptRulesButton");

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                if (
                    !checkbox ||
                    !checkbox.checked
                ) {

                    setMessage(
                        "rulesGateMessage",
                        "Please accept the community guidelines first."
                    );

                    return;
                }

                localStorage.setItem(
                    RULES_VERSION,
                    "accepted"
                );

                $("rulesGate")
                    ?.classList.add(
                        "hidden"
                    );

            }
        );

    }


    /* =====================================================
       COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        const {
            data,
            error
        } =
            await state.supabase
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
            `Community: ${state.communities.length} communities loaded.`
        );

        if (!state.communities.length) {
            throw new Error(
                "No active communities were found."
            );
        }

        selectInitialCommunity();

        renderCommunityRail();

        renderCommunityModal();

        updateSelectedCommunityUI();
    }


    function selectInitialCommunity() {

        let savedId = null;

        try {

            savedId =
                localStorage.getItem(
                    "mwanikiSelectedCommunity"
                );

        } catch (_) {}

        let selected =
            state.communities.find(
                community =>
                    String(community.id) ===
                    String(savedId)
            );

        if (!selected) {

            selected =
                state.communities.find(
                    community =>
                        String(
                            community.id
                        ) ===
                        DEFAULT_DISCUSSION_ID
                );
        }

        if (!selected) {

            selected =
                state.communities.find(
                    community =>
                        String(
                            community.name
                        ).toLowerCase() ===
                        DEFAULT_DISCUSSION_NAME.toLowerCase()
                );
        }

        if (!selected) {
            selected =
                state.communities[0];
        }

        state.selectedCommunity =
            selected;

        try {

            localStorage.setItem(
                "mwanikiSelectedCommunity",
                selected.id
            );

        } catch (_) {}
    }


    function renderCommunityRail() {

        const container =
            $("communityRailList");

        if (!container) {
            return;
        }

        container.innerHTML =
            state.communities
                .map(community => {

                    const active =
                        String(
                            community.id
                        ) ===
                        String(
                            state.selectedCommunity?.id
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
                                escapeHtml(
                                    community.id
                                )
                            }"
                            title="${
                                escapeHtml(
                                    community.name
                                )
                            }"
                        >
                            <span class="community-rail-icon">
                                ${communityIcon(community)}
                            </span>

                            <span class="community-rail-name">
                                ${escapeHtml(
                                    community.name
                                )}
                            </span>
                        </button>
                    `;

                })
                .join("");

        container
            .querySelectorAll(
                "[data-community-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const id =
                            button.dataset.communityId;

                        await switchCommunity(id);

                    }
                );

            });
    }


    function renderCommunityModal() {

        const container =
            $("communityChoiceList");

        if (!container) {
            return;
        }

        container.innerHTML =
            state.communities
                .map(community => {

                    return `
                        <button
                            type="button"
                            class="community-choice"
                            data-community-choice="${
                                escapeHtml(
                                    community.id
                                )
                            }"
                        >
                            <span class="community-choice-icon">
                                ${communityIcon(community)}
                            </span>

                            <span class="community-choice-info">
                                <strong>
                                    ${escapeHtml(
                                        community.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        community.description ||
                                        "Community"
                                    )}
                                </span>
                            </span>
                        </button>
                    `;

                })
                .join("");

        container
            .querySelectorAll(
                "[data-community-choice]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await switchCommunity(
                            button.dataset.communityChoice
                        );

                        closeCommunityModal();

                    }
                );

            });
    }


    async function switchCommunity(id) {

        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!community) {
            return;
        }

        state.selectedCommunity =
            community;

        try {

            localStorage.setItem(
                "mwanikiSelectedCommunity",
                community.id
            );

        } catch (_) {}

        renderCommunityRail();

        updateSelectedCommunityUI();

        await loadChannels();

    }


    function updateSelectedCommunityUI() {

        const community =
            state.selectedCommunity;

        if (!community) {
            return;
        }

        const icon =
            $("selectedCommunityIcon");

        if (icon) {
            icon.textContent =
                communityIcon(community);
        }

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
                "Mwaniki Scholars Community";
        }
    }


    /* =====================================================
       CHANNELS
       ===================================================== */

    async function loadChannels() {

        if (!state.selectedCommunity) {
            return;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    state.selectedCommunity.id
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
            `Community: ${state.channels.length} channels loaded automatically.`
        );

        renderChannels();

        selectInitialChannel();

        await loadChannelData();
    }


    function selectInitialChannel() {

        if (!state.channels.length) {

            state.selectedChannel =
                null;

            updateSelectedChannelUI();

            return;
        }

        let savedId = null;

        try {

            savedId =
                localStorage.getItem(
                    "mwanikiSelectedChannel"
                );

        } catch (_) {}

        let channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(savedId)
            );

        if (!channel) {

            channel =
                state.channels.find(
                    item =>
                        String(
                            item.name
                        ).toLowerCase() ===
                        "general"
                );
        }

        if (!channel) {
            channel =
                state.channels[0];
        }

        state.selectedChannel =
            channel;

        try {

            localStorage.setItem(
                "mwanikiSelectedChannel",
                channel.id
            );

        } catch (_) {}
    }


    function renderChannels(
        filter = ""
    ) {

        const container =
            $("channelList");

        if (!container) {
            return;
        }

        const query =
            String(filter || "")
                .trim()
                .toLowerCase();

        const channels =
            state.channels.filter(
                channel =>
                    !query ||
                    String(
                        channel.name || ""
                    )
                        .toLowerCase()
                        .includes(query)
            );

        if (!channels.length) {

            container.innerHTML =
                `<div class="channel-empty">
                    No channels found.
                </div>`;

            return;
        }

        container.innerHTML =
            channels
                .map(channel => {

                    const active =
                        String(
                            channel.id
                        ) ===
                        String(
                            state.selectedChannel?.id
                        );

                    return `
                        <button
                            type="button"
                            class="channel-item ${
                                active
                                    ? "active"
                                    : ""
                            }"
                            data-channel-id="${
                                escapeHtml(
                                    channel.id
                                )
                            }"
                        >
                            <span class="channel-icon">
                                ${escapeHtml(
                                    channelIcon(
                                        channel
                                    )
                                )}
                            </span>

                            <span class="channel-name">
                                ${escapeHtml(
                                    channel.name
                                )}
                            </span>
                        </button>
                    `;

                })
                .join("");

        container
            .querySelectorAll(
                "[data-channel-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await switchChannel(
                            button.dataset.channelId
                        );

                    }
                );

            });
    }


    async function switchChannel(id) {

        const channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!channel) {
            return;
        }

        state.selectedChannel =
            channel;

        try {

            localStorage.setItem(
                "mwanikiSelectedChannel",
                channel.id
            );

        } catch (_) {}

        renderChannels();

        updateSelectedChannelUI();

        await loadChannelData();

        subscribeToRealtime();

        scrollMessagesToBottom();

    }


    function updateSelectedChannelUI() {

        const channel =
            state.selectedChannel;

        if (!channel) {

            $("selectedChannelName")
                && (
                    $("selectedChannelName")
                        .textContent =
                        "No channel"
                );

            $("selectedChannelDescription")
                && (
                    $("selectedChannelDescription")
                        .textContent =
                        "No active channel is available."
                );

            return;
        }

        const icon =
            $("selectedChannelIcon");

        if (icon) {
            icon.textContent =
                channelIcon(channel);
        }

        const name =
            $("selectedChannelName");

        if (name) {
            name.textContent =
                channel.name;
        }

        const description =
            $("selectedChannelDescription");

        if (description) {
            description.textContent =
                channel.description ||
                "Community discussion channel";
        }

        const welcomeTitle =
            $("messageWelcomeTitle");

        if (welcomeTitle) {
            welcomeTitle.textContent =
                `Welcome to ${channel.name}`;
        }

        const welcomeText =
            $("messageWelcomeText");

        if (welcomeText) {
            welcomeText.textContent =
                channel.description ||
                "This is the beginning of this channel.";
        }

        const input =
            $("messageInput");

        if (input) {

            input.placeholder =
                `Message #${channel.name}`;
        }
    }


    /* =====================================================
       CHANNEL DATA
       ===================================================== */

    async function loadChannelData() {

        if (!state.selectedChannel) {

            clearMessages();

            return;
        }

        state.messageOffset = 0;
        state.hasMoreMessages = true;

        await loadMessages(true);

        await loadReactions();

        await loadAttachments();

        await loadMembers();

        renderMessages();

        subscribeToRealtime();

    }


    /* =====================================================
       MESSAGES
       ===================================================== */

    async function loadMessages(reset = false) {

        if (
            state.loadingMessages ||
            !state.selectedChannel
        ) {
            return;
        }

        if (
            !reset &&
            !state.hasMoreMessages
        ) {
            return;
        }

        state.loadingMessages = true;

        $("messageLoading")
            ?.classList.remove(
                "hidden"
            );

        try {

            const from =
                reset
                    ? 0
                    : state.messageOffset;

            const to =
                from +
                MESSAGE_PAGE_SIZE -
                1;

            const {
                data,
                error
            } =
                await state.supabase
                    .from("chat_messages")
                    .select("*")
                    .eq(
                        "channel_id",
                        state.selectedChannel.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    )
                    .range(
                        from,
                        to
                    );

            if (error) {
                throw error;
            }

            const rows =
                data || [];

            if (reset) {

                state.messages =
                    rows;

            } else {

                state.messages =
                    [
                        ...rows,
                        ...state.messages
                    ];
            }

            state.messageOffset =
                from + rows.length;

            state.hasMoreMessages =
                rows.length ===
                MESSAGE_PAGE_SIZE;

            await loadProfilesForMessages(
                rows
            );

            renderMessages();

        } catch (error) {

            console.error(
                "Message load failed:",
                error
            );

            showToast(
                "Unable to load messages."
            );

        } finally {

            state.loadingMessages =
                false;

            $("messageLoading")
                ?.classList.add(
                    "hidden"
                );
        }
    }


    async function loadProfilesForMessages(
        messages
    ) {

        const ids =
            [
                ...new Set(
                    messages
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
            await state.supabase
                .from("students")
                .select("*")
                .in(
                    "id",
                    ids
                );

        if (error) {

            console.warn(
                "Student profiles warning:",
                error
            );

            return;
        }

        const existing =
            new Map(
                state.publicProfiles.map(
                    profile =>
                        [
                            String(profile.id),
                            profile
                        ]
                )
            );

        for (
            const profile of
            data || []
        ) {

            existing.set(
                String(profile.id),
                profile
            );

        }

        state.publicProfiles =
            Array.from(
                existing.values()
            );
    }


    function getMessageProfile(
        userId
    ) {

        return state.publicProfiles
            .find(
                profile =>
                    String(profile.id) ===
                    String(userId)
            );
    }


    function clearMessages() {

        state.messages = [];
        state.reactions = [];
        state.attachments = [];

        const list =
            $("messageList");

        if (list) {
            list.innerHTML = "";
        }
    }


    /* =====================================================
       REACTIONS
       ===================================================== */

    async function loadReactions() {

        if (!state.selectedChannel) {
            return;
        }

        const ids =
            state.messages
                .map(
                    message =>
                        message.id
                )
                .filter(Boolean);

        if (!ids.length) {

            state.reactions = [];

            return;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_message_reactions"
                )
                .select("*")
                .in(
                    "message_id",
                    ids
                );

        if (error) {

            console.warn(
                "Reaction load warning:",
                error
            );

            return;
        }

        state.reactions =
            data || [];
    }


    function renderMessageReactions(
        messageId
    ) {

        const reactions =
            state.reactions.filter(
                reaction =>
                    String(
                        reaction.message_id
                    ) ===
                    String(messageId)
            );

        if (!reactions.length) {
            return "";
        }

        const grouped =
            new Map();

        for (
            const reaction of
            reactions
        ) {

            const key =
                reaction.reaction ||
                "👍";

            if (!grouped.has(key)) {
                grouped.set(
                    key,
                    []
                );
            }

            grouped.get(key).push(
                reaction
            );
        }

        return `
            <div class="message-reactions">
                ${Array.from(
                    grouped.entries()
                )
                    .map(
                        ([emoji, rows]) => {

                            const mine =
                                rows.some(
                                    row =>
                                        String(
                                            row.user_id
                                        ) ===
                                        String(
                                            state.user?.id
                                        )
                                );

                            return `
                                <button
                                    type="button"
                                    class="reaction-button ${
                                        mine
                                            ? "active"
                                            : ""
                                    }"
                                    data-reaction-message="${
                                        escapeHtml(
                                            messageId
                                        )
                                    }"
                                    data-reaction="${
                                        escapeHtml(
                                            emoji
                                        )
                                    }"
                                >
                                    ${escapeHtml(
                                        emoji
                                    )}
                                    <span>
                                        ${rows.length}
                                    </span>
                                </button>
                            `;

                        }
                    )
                    .join("")}
            </div>
        `;
    }


    async function toggleReaction(
        messageId,
        reaction
    ) {

        if (!state.user) {
            return;
        }

        const existing =
            state.reactions.find(
                row =>
                    String(
                        row.message_id
                    ) ===
                    String(messageId) &&
                    String(
                        row.user_id
                    ) ===
                    String(state.user.id) &&
                    row.reaction ===
                    reaction
            );

        if (existing) {

            const {
                error
            } =
                await state.supabase
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
            } =
                await state.supabase
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

        await loadReactions();

        renderMessages();
    }


    /* =====================================================
       ATTACHMENTS
       ===================================================== */

    async function loadAttachments() {

        const ids =
            state.messages
                .map(
                    message =>
                        message.id
                )
                .filter(Boolean);

        if (!ids.length) {

            state.attachments = [];

            return;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from("chat_attachments")
                .select("*")
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

            console.warn(
                "Attachment load warning:",
                error
            );

            return;
        }

        state.attachments =
            data || [];
    }


    function renderMessageAttachments(
        messageId
    ) {

        const files =
            state.attachments.filter(
                file =>
                    String(
                        file.message_id
                    ) ===
                    String(messageId)
            );

        if (!files.length) {
            return "";
        }

        return `
            <div class="message-attachments">
                ${files
                    .map(file => {

                        const url =
                            safeUrl(
                                file.file_url
                            );

                        const mime =
                            String(
                                file.mime_type ||
                                ""
                            ).toLowerCase();

                        if (
                            mime.startsWith(
                                "image/"
                            ) &&
                            url
                        ) {

                            return `
                                <a
                                    href="${escapeHtml(url)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <img
                                        class="message-image"
                                        src="${escapeHtml(url)}"
                                        alt="${escapeHtml(
                                            file.file_name
                                        )}"
                                        loading="lazy"
                                    >
                                </a>
                            `;
                        }

                        return `
                            <a
                                class="attachment-card"
                                href="${escapeHtml(
                                    url
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span class="attachment-icon">
                                    📎
                                </span>

                                <span class="attachment-details">

                                    <span class="attachment-name">
                                        ${escapeHtml(
                                            file.file_name
                                        )}
                                    </span>

                                    <span class="attachment-size">
                                        ${formatFileSize(
                                            file.file_size
                                        )}
                                    </span>

                                </span>
                            </a>
                        `;

                    })
                    .join("")}
            </div>
        `;
    }


    /* =====================================================
       MESSAGE RENDERING
       ===================================================== */

    function renderMessages() {

        const list =
            $("messageList");

        if (!list) {
            return;
        }

        if (!state.messages.length) {

            list.innerHTML =
                `
                <div class="channel-empty">
                    No messages yet. Start the conversation.
                </div>
                `;

            return;
        }

        const html =
            state.messages
                .map(message =>
                    renderMessage(message)
                )
                .join("");

        list.innerHTML =
            html;

        bindMessageActions();
    }


    function renderMessage(
        message
    ) {

        const profile =
            getMessageProfile(
                message.user_id
            );

        const name =
            profile?.full_name ||
            profile?.name ||
            (
                String(
                    message.user_id
                ) ===
                String(state.user?.id)
                    ? getCurrentUserName()
                    : "Student"
            );

        const avatar =
            getProfileAvatar(
                profile
            );

        const own =
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

        const content =
            deleted
                ? `<span class="message-deleted">
                    This message was deleted.
                   </span>`
                : renderMessageContent(
                    message
                );

        const role =
            profile?.role ||
            profile?.user_role ||
            "";

        return `
            <article
                class="message-group ${
                    own ? "own" : ""
                }"
                data-message-id="${
                    escapeHtml(
                        message.id
                    )
                }"
            >

                <div class="message-avatar">

                    ${
                        safeUrl(avatar)
                            ? `
                                <img
                                    src="${escapeHtml(
                                        safeUrl(avatar)
                                    )}"
                                    alt=""
                                    loading="lazy"
                                >
                            `
                            : escapeHtml(
                                initials(name)
                            )
                    }

                </div>


                <div class="message-content">

                    <div class="message-meta">

                        <span class="message-author">
                            ${escapeHtml(name)}
                        </span>

                        ${
                            role
                                ? `
                                    <span class="message-role">
                                        ${escapeHtml(
                                            role
                                        )}
                                    </span>
                                `
                                : ""
                        }

                        <span class="message-time">
                            ${escapeHtml(
                                formatTime(
                                    message.created_at
                                )
                            )}
                        </span>

                    </div>


                    <div class="message-text">

                        ${content}

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


                    ${renderMessageAttachments(
                        message.id
                    )}

                    ${renderMessageReactions(
                        message.id
                    )}


                    ${
                        !deleted
                            ? `
                                <div class="message-actions">

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-message-reply="${
                                            escapeHtml(
                                                message.id
                                            )
                                        }"
                                    >
                                        Reply
                                    </button>

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-message-reaction="${
                                            escapeHtml(
                                                message.id
                                            )
                                        }"
                                    >
                                        😊
                                    </button>

                                    ${
                                        own
                                            ? `
                                                <button
                                                    type="button"
                                                    class="message-action delete"
                                                    data-message-delete="${
                                                        escapeHtml(
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
                            `
                            : ""
                    }

                </div>

            </article>
        `;
    }


    function renderMessageContent(
        message
    ) {

        const type =
            String(
                message.message_type ||
                "text"
            ).toLowerCase();

        if (
            type === "gif" &&
            safeUrl(message.content)
        ) {

            return `
                <img
                    class="message-image"
                    src="${escapeHtml(
                        safeUrl(message.content)
                    )}"
                    alt="GIF"
                    loading="lazy"
                >
            `;
        }

        if (type === "voice") {

            const url =
                safeUrl(
                    message.content
                );

            if (url) {

                return `
                    <audio
                        controls
                        preload="metadata"
                        src="${escapeHtml(url)}"
                    ></audio>
                `;
            }
        }

        return escapeHtml(
            message.content || ""
        );
    }


    function bindMessageActions() {

        document
            .querySelectorAll(
                "[data-message-delete]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await deleteMessage(
                            button.dataset.messageDelete
                        );

                    }
                );

            });


        document
            .querySelectorAll(
                "[data-message-reaction]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const messageId =
                            button.dataset.messageReaction;

                        const reaction =
                            window.prompt(
                                "Enter one emoji:",
                                "👍"
                            );

                        if (!reaction) {
                            return;
                        }

                        try {

                            await toggleReaction(
                                messageId,
                                reaction.trim()
                            );

                        } catch (error) {

                            console.error(
                                error
                            );

                            showToast(
                                "Unable to update reaction."
                            );
                        }

                    }
                );

            });


        document
            .querySelectorAll(
                "[data-reaction-message]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        try {

                            await toggleReaction(
                                button.dataset.reactionMessage,
                                button.dataset.reaction
                            );

                        } catch (error) {

                            console.error(
                                error
                            );

                            showToast(
                                "Unable to update reaction."
                            );
                        }

                    }
                );

            });


        document
            .querySelectorAll(
                "[data-message-reply]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        startReply(
                            button.dataset.messageReply
                        );

                    }
                );

            });

    }


    /* =====================================================
       DELETE
       ===================================================== */

    async function deleteMessage(
        messageId
    ) {

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
            String(message.user_id) !==
            String(state.user?.id)
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
            await state.supabase
                .from("chat_messages")
                .update({
                    is_deleted: true,
                    deleted_at:
                        new Date().toISOString(),
                    content: ""
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
                "Delete message failed:",
                error
            );

            showToast(
                "Message could not be deleted."
            );

            return;
        }

        const target =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (target) {

            target.is_deleted = true;
            target.content = "";
            target.deleted_at =
                new Date().toISOString();

        }

        renderMessages();

        showToast(
            "Message deleted."
        );
    }


    /* =====================================================
       REPLY
       ===================================================== */

    function startReply(
        messageId
    ) {

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) {
            return;
        }

        state.selectedMessageForReply =
            message;

        const profile =
            getMessageProfile(
                message.user_id
            );

        const name =
            profile?.full_name ||
            profile?.name ||
            "Student";

        $("replyPreviewName")
            && (
                $("replyPreviewName")
                    .textContent =
                    `Reply to ${name}`
            );

        $("replyPreviewText")
            && (
                $("replyPreviewText")
                    .textContent =
                    message.content || ""
            );

        $("replyPreview")
            ?.classList.remove(
                "hidden"
            );

        $("messageInput")
            ?.focus();
    }


    function cancelReply() {

        state.selectedMessageForReply =
            null;

        $("replyPreview")
            ?.classList.add(
                "hidden"
            );
    }


    /* =====================================================
       SEND MESSAGE
       ===================================================== */

    async function sendMessage() {

        if (
            state.sendingMessage ||
            !state.user ||
            !state.selectedChannel
        ) {
            return;
        }

        const input =
            $("messageInput");

        const text =
            input?.value.trim() || "";

        if (
            !text &&
            !state.selectedFiles.length
        ) {
            return;
        }

        state.sendingMessage = true;

        const button =
            $("sendMessageButton");

        if (button) {
            button.disabled = true;
        }

        try {

            if (text) {

                await insertMessage({
                    content: text,
                    message_type: "text"
                });

            }

            if (state.selectedFiles.length) {

                for (
                    const file of
                    state.selectedFiles
                ) {

                    await uploadFileAsMessage(
                        file
                    );

                }

            }

            if (input) {
                input.value = "";
                autoResizeTextarea(input);
            }

            state.selectedFiles = [];

            renderAttachmentPreview();

            cancelReply();

            await loadChannelData();

            scrollMessagesToBottom();

        } catch (error) {

            console.error(
                "Send message failed:",
                error
            );

            showToast(
                error.message ||
                "Unable to send message."
            );

        } finally {

            state.sendingMessage =
                false;

            if (button) {
                button.disabled = false;
            }
        }
    }


    async function insertMessage({
        content,
        message_type
    }) {

        const payload = {

            channel_id:
                state.selectedChannel.id,

            user_id:
                state.user.id,

            content:
                content || "",

            message_type:
                message_type || "text"

        };

        if (
            state.selectedMessageForReply?.id
        ) {

            payload.parent_message_id =
                state.selectedMessageForReply.id;
        }

        const {
            error
        } =
            await state.supabase
                .from("chat_messages")
                .insert(payload);

        if (error) {
            throw error;
        }
    }


    /* =====================================================
       FILE UPLOAD
       ===================================================== */

    function setupFileUpload() {

        const attach =
            $("attachButton");

        const input =
            $("attachmentInput");

        if (!attach || !input) {
            return;
        }

        attach.addEventListener(
            "click",
            () => {

                input.value = "";

                input.click();

            }
        );

        input.addEventListener(
            "change",
            () => {

                const files =
                    Array.from(
                        input.files || []
                    );

                if (!files.length) {
                    return;
                }

                const accepted = [];

                for (
                    const file of
                    files
                ) {

                    if (
                        file.size >
                        MAX_FILE_SIZE
                    ) {

                        showToast(
                            `${file.name} is larger than 50 MB.`
                        );

                        continue;
                    }

                    accepted.push(file);

                }

                state.selectedFiles =
                    accepted;

                renderAttachmentPreview();

            }
        );
    }


    function renderAttachmentPreview() {

        const container =
            $("attachmentPreview");

        if (!container) {
            return;
        }

        if (!state.selectedFiles.length) {

            container.innerHTML = "";

            container.classList.add(
                "hidden"
            );

            return;
        }

        container.classList.remove(
            "hidden"
        );

        container.innerHTML =
            state.selectedFiles
                .map(
                    (file, index) => `
                        <div class="attachment-preview-item">

                            <span>
                                📎
                                ${escapeHtml(
                                    file.name
                                )}
                            </span>

                            <button
                                type="button"
                                data-remove-file="${index}"
                            >
                                ×
                            </button>

                        </div>
                    `
                )
                .join("");

        container
            .querySelectorAll(
                "[data-remove-file]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset.removeFile
                            );

                        state.selectedFiles
                            .splice(
                                index,
                                1
                            );

                        renderAttachmentPreview();

                    }
                );

            });
    }


    async function uploadFileAsMessage(
        file
    ) {

        const extension =
            file.name.includes(".")
                ? file.name
                    .split(".")
                    .pop()
                    .toLowerCase()
                : "bin";

        const folder =
            file.type.startsWith("image/")
                ? "images"
                : "documents";

        const filePath =
            [
                state.user.id,
                folder,
                `${crypto.randomUUID()}.${extension}`
            ].join("/");

        const {
            error: uploadError
        } =
            await state.supabase.storage
                .from(STORAGE_BUCKET)
                .upload(
                    filePath,
                    file,
                    {
                        cacheControl:
                            "3600",
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
        } =
            state.supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(
                    filePath
                );

        const fileUrl =
            publicData?.publicUrl || "";

        const messageContent =
            file.type.startsWith(
                "image/"
            )
                ? ""
                : file.name;

        const {
            data: message,
            error: messageError
        } =
            await state.supabase
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.selectedChannel.id,
                    user_id:
                        state.user.id,
                    content:
                        messageContent,
                    message_type:
                        "file"
                })
                .select("id")
                .single();

        if (messageError) {
            throw messageError;
        }

        const {
            error: attachmentError
        } =
            await state.supabase
                .from("chat_attachments")
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
            throw attachmentError;
        }
    }


    /* =====================================================
       GIF
       ===================================================== */

    function setupGif() {

        const button =
            $("gifButton");

        const picker =
            $("gifPicker");

        const close =
            $("closeGifButton");

        const search =
            $("gifSearchInput");

        if (!button || !picker) {
            return;
        }

        button.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const emoji =
                    $("emojiPicker");

                emoji?.classList.add(
                    "hidden"
                );

                state.emojiOpen = false;

                const isHidden =
                    picker.classList.contains(
                        "hidden"
                    );

                picker.classList.toggle(
                    "hidden",
                    !isHidden
                );

                state.gifOpen =
                    isHidden;

                if (isHidden) {
                    search?.focus();
                }

            }
        );

        close?.addEventListener(
            "click",
            () => {

                picker.classList.add(
                    "hidden"
                );

                state.gifOpen = false;

            }
        );

        search?.addEventListener(
            "input",
            debounce(
                () => {

                    loadGifs(
                        search.value.trim()
                    );

                },
                450
            )
        );

        loadGifs("popular");
    }


    async function loadGifs(
        query
    ) {

        const container =
            $("gifResults");

        if (!container) {
            return;
        }

        /*
         * This intentionally uses Tenor's public endpoint
         * only when a configured key exists.
         * Without a key the picker stays usable but does
         * not make an invalid request.
         */

        const key =
            window.MWANIKI_TENOR_API_KEY ||
            "";

        if (!key) {

            container.innerHTML =
                `
                <div
                    class="channel-empty"
                    style="grid-column:1/-1"
                >
                    Add a Tenor API key to enable GIF search.
                </div>
                `;

            return;
        }

        try {

            const response =
                await fetch(
                    `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(
                        query || "popular"
                    )}&key=${encodeURIComponent(
                        key
                    )}&limit=12&media_filter=gif`
                );

            if (!response.ok) {
                throw new Error(
                    "GIF request failed."
                );
            }

            const data =
                await response.json();

            const results =
                data.results || [];

            container.innerHTML =
                results
                    .map(result => {

                        const url =
                            result?.media_formats
                                ?.gif
                                ?.url ||
                            result?.media_formats
                                ?.tinygif
                                ?.url ||
                            "";

                        if (!safeUrl(url)) {
                            return "";
                        }

                        return `
                            <button
                                type="button"
                                class="gif-result"
                                data-gif-url="${
                                    escapeHtml(
                                        url
                                    )
                                }"
                            >
                                <img
                                    src="${escapeHtml(url)}"
                                    alt="GIF"
                                    loading="lazy"
                                >
                            </button>
                        `;

                    })
                    .join("");

            container
                .querySelectorAll(
                    "[data-gif-url]"
                )
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            await sendGif(
                                button.dataset.gifUrl
                            );

                            $("gifPicker")
                                ?.classList.add(
                                    "hidden"
                                );

                            state.gifOpen =
                                false;

                        }
                    );

                });

        } catch (error) {

            console.error(
                "GIF load failed:",
                error
            );

            container.innerHTML =
                `
                <div
                    class="channel-empty"
                    style="grid-column:1/-1"
                >
                    GIFs are temporarily unavailable.
                </div>
                `;
        }
    }


    async function sendGif(
        url
    ) {

        if (!safeUrl(url)) {
            return;
        }

        try {

            await insertMessage({
                content:
                    safeUrl(url),
                message_type:
                    "gif"
            });

            await loadChannelData();

            scrollMessagesToBottom();

        } catch (error) {

            console.error(
                "GIF send failed:",
                error
            );

            showToast(
                "Unable to send GIF."
            );
        }
    }


    /* =====================================================
       EMOJI
       ===================================================== */

    function setupEmoji() {

        const button =
            $("emojiButton");

        const picker =
            $("emojiPicker");

        if (!button || !picker) {
            return;
        }

        button.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const gif =
                    $("gifPicker");

                gif?.classList.add(
                    "hidden"
                );

                state.gifOpen = false;

                const hidden =
                    picker.classList.contains(
                        "hidden"
                    );

                picker.classList.toggle(
                    "hidden",
                    !hidden
                );

                state.emojiOpen =
                    hidden;

            }
        );

        const emojiElement =
            picker.querySelector(
                "emoji-picker"
            );

        emojiElement?.addEventListener(
            "emoji-click",
            event => {

                const emoji =
                    event.detail?.unicode ||
                    event.detail?.emoji?.unicode ||
                    "";

                if (!emoji) {
                    return;
                }

                insertEmoji(
                    emoji
                );

            }
        );
    }


    function insertEmoji(
        emoji
    ) {

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

        autoResizeTextarea(
            input
        );
    }


    /* =====================================================
       VOICE NOTES
       ===================================================== */

    function setupVoiceRecording() {

        const button =
            $("voiceNoteButton");

        const cancel =
            $("cancelVoiceButton");

        const stop =
            $("stopVoiceButton");

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            startVoiceRecording
        );

        cancel?.addEventListener(
            "click",
            cancelVoiceRecording
        );

        stop?.addEventListener(
            "click",
            stopVoiceRecording
        );
    }


    async function startVoiceRecording() {

        if (state.recording) {
            return;
        }

        if (
            !navigator.mediaDevices?.getUserMedia
        ) {

            showToast(
                "Voice recording is not supported by this browser."
            );

            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            const mimeType =
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
                    ? "audio/webm;codecs=opus"
                    : "audio/webm";

            state.mediaRecorder =
                new MediaRecorder(
                    stream,
                    {
                        mimeType
                    }
                );

            state.recordedChunks =
                [];

            state.recording =
                true;

            state.recordingStartedAt =
                Date.now();

            state.mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size > 0
                    ) {

                        state.recordedChunks
                            .push(
                                event.data
                            );

                    }

                };

            state.mediaRecorder.onstop =
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    if (
                        !state.recordedChunks.length
                    ) {
                        finishRecordingUI();
                        return;
                    }

                    const blob =
                        new Blob(
                            state.recordedChunks,
                            {
                                type:
                                    mimeType
                            }
                        );

                    finishRecordingUI();

                    await uploadVoiceNote(
                        blob
                    );

                };

            state.mediaRecorder.start();

            $("voiceRecorderBar")
                ?.classList.remove(
                    "hidden"
                );

            updateRecordingTimer();

            state.recordingTimer =
                setInterval(
                    updateRecordingTimer,
                    1000
                );

        } catch (error) {

            console.error(
                "Voice recording failed:",
                error
            );

            showToast(
                "Microphone access was not available."
            );
        }
    }


    function updateRecordingTimer() {

        if (!state.recordingStartedAt) {
            return;
        }

        const seconds =
            Math.floor(
                (
                    Date.now() -
                    state.recordingStartedAt
                ) / 1000
            );

        const timer =
            $("recordingTimer");

        if (timer) {
            timer.textContent =
                formatRecordingTime(
                    seconds
                );
        }
    }


    function stopVoiceRecording() {

        if (
            state.mediaRecorder &&
            state.recording
        ) {

            state.mediaRecorder.stop();

        }
    }


    function cancelVoiceRecording() {

        if (
            state.mediaRecorder &&
            state.recording
        ) {

            state.recordedChunks = [];

            state.mediaRecorder.stop();

        }
    }


    function finishRecordingUI() {

        state.recording =
            false;

        state.mediaRecorder =
            null;

        state.recordingStartedAt =
            0;

        clearInterval(
            state.recordingTimer
        );

        state.recordingTimer =
            null;

        $("voiceRecorderBar")
            ?.classList.add(
                "hidden"
            );

        $("recordingTimer")
            && (
                $("recordingTimer")
                    .textContent =
                    "00:00"
            );
    }


    async function uploadVoiceNote(
        blob
    ) {

        if (!state.user) {
            return;
        }

        const filePath =
            [
                state.user.id,
                "voice-notes",
                `${crypto.randomUUID()}.webm`
            ].join("/");

        try {

            const {
                error: uploadError
            } =
                await state.supabase.storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .upload(
                        filePath,
                        blob,
                        {
                            cacheControl:
                                "3600",
                            upsert: false,
                            contentType:
                                "audio/webm"
                        }
                    );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data
            } =
                state.supabase.storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .getPublicUrl(
                        filePath
                    );

            const url =
                data?.publicUrl;

            if (!url) {
                throw new Error(
                    "Voice note URL was not created."
                );
            }

            await insertMessage({
                content: url,
                message_type: "voice"
            });

            await loadChannelData();

            scrollMessagesToBottom();

        } catch (error) {

            console.error(
                "Voice note upload failed:",
                error
            );

            showToast(
                "Voice note could not be uploaded."
            );
        }
    }


    /* =====================================================
       MEMBERS
       ===================================================== */

    async function loadMembers() {

        if (!state.selectedCommunity) {
            return;
        }

        const {
            data,
            error
        } =
            await state.supabase
                .from(
                    "chat_community_members"
                )
                .select("*")
                .eq(
                    "community_id",
                    state.selectedCommunity.id
                )
                .eq(
                    "is_banned",
                    false
                );

        if (error) {

            console.warn(
                "Member load warning:",
                error
            );

            return;
        }

        state.members =
            data || [];

        await loadMemberProfiles();

        renderMembers();
    }


    async function loadMemberProfiles() {

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
        } =
            await state.supabase
                .from("students")
                .select("*")
                .in(
                    "id",
                    ids
                );

        if (error) {

            console.warn(
                "Member profiles warning:",
                error
            );

            return;
        }

        const map =
            new Map(
                state.publicProfiles.map(
                    profile =>
                        [
                            String(profile.id),
                            profile
                        ]
                )
            );

        for (
            const profile of
            data || []
        ) {

            map.set(
                String(profile.id),
                profile
            );

        }

        state.publicProfiles =
            Array.from(
                map.values()
            );
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
                `${state.members.length} ${
                    state.members.length === 1
                        ? "member"
                        : "members"
                }`;

        }

        list.innerHTML =
            state.members
                .map(member => {

                    const profile =
                        getMessageProfile(
                            member.user_id
                        );

                    const name =
                        profile?.full_name ||
                        profile?.name ||
                        member.nickname ||
                        "Student";

                    const avatar =
                        getProfileAvatar(
                            profile
                        );

                    const isCurrent =
                        String(
                            member.user_id
                        ) ===
                        String(
                            state.user?.id
                        );

                    return `
                        <div class="member-item">

                            <div class="member-avatar">

                                ${
                                    safeUrl(avatar)
                                        ? `
                                            <img
                                                src="${escapeHtml(
                                                    safeUrl(avatar)
                                                )}"
                                                alt=""
                                            >
                                        `
                                        : escapeHtml(
                                            initials(name)
                                        )
                                }

                            </div>

                            <div class="member-details">

                                <strong>
                                    ${escapeHtml(
                                        isCurrent
                                            ? `${name} (You)`
                                            : name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        member.role ||
                                        "Student"
                                    )}
                                </span>

                            </div>

                            <span class="online-dot"></span>

                        </div>
                    `;

                })
                .join("");
    }


    /* =====================================================
       REALTIME
       ===================================================== */

    function subscribeToRealtime() {

        if (!state.supabase) {
            return;
        }

        if (!state.selectedChannel) {
            return;
        }

        if (state.realtimeChannel) {

            state.supabase.removeChannel(
                state.realtimeChannel
            );

            state.realtimeChannel =
                null;
        }

        const channelName =
            `community-chat-${state.selectedChannel.id}`;

        state.realtimeChannel =
            state.supabase
                .channel(channelName)

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.selectedChannel.id}`
                    },
                    async payload => {

                        console.log(
                            "Community message realtime:",
                            payload.eventType
                        );

                        await loadChannelData();

                        scrollMessagesToBottom();

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

                        await loadReactions();

                        renderMessages();

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

                        await loadAttachments();

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


    /* =====================================================
       GENERAL CALL BRIDGE
       -----------------------------------------------------
       community.js does not perform WebRTC.
       It only tells call.js what the user requested.
       ===================================================== */

    function setupGeneralCall() {

        const button =
            $("generalCallButton");

        const modal =
            $("generalCallModal");

        if (!button || !modal) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                modal.classList.remove(
                    "hidden"
                );

                $("generalCallUserInput")
                    ?.focus();

            }
        );


        $("closeGeneralCallModal")
            ?.addEventListener(
                "click",
                closeGeneralCallModal
            );


        $("cancelGeneralCallButton")
            ?.addEventListener(
                "click",
                closeGeneralCallModal
            );


        $("startGeneralVoiceCall")
            ?.addEventListener(
                "click",
                () => {

                    requestGeneralCall(
                        "voice"
                    );

                }
            );


        $("startGeneralVideoCall")
            ?.addEventListener(
                "click",
                () => {

                    requestGeneralCall(
                        "video"
                    );

                }
            );
    }


    function closeGeneralCallModal() {

        $("generalCallModal")
            ?.classList.add(
                "hidden"
            );

        setMessage(
            "generalCallMessage",
            ""
        );
    }


    function requestGeneralCall(
        mode
    ) {

        const input =
            $("generalCallUserInput");

        const targetUserId =
            input?.value.trim() || "";

        if (!targetUserId) {

            setMessage(
                "generalCallMessage",
                "Enter the recipient user ID."
            );

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:general-call",
                {
                    detail: {
                        targetUserId,
                        mode
                    }
                }
            )
        );

        closeGeneralCallModal();

    }


    /* =====================================================
       UI EVENTS
       ===================================================== */

    function setupUI() {

        $("openCommunityModal")
            ?.addEventListener(
                "click",
                openCommunityModal
            );

        $("closeCommunityModal")
            ?.addEventListener(
                "click",
                closeCommunityModal
            );

        $("openCommunityMenu")
            ?.addEventListener(
                "click",
                openCommunityModal
            );


        $("toggleMembersButton")
            ?.addEventListener(
                "click",
                toggleMembers
            );

        $("closeMembersButton")
            ?.addEventListener(
                "click",
                closeMembers
            );


        $("profileButton")
            ?.addEventListener(
                "click",
                () => {

                    window.location.href =
                        "./profile.html";

                }
            );


        $("channelSearch")
            ?.addEventListener(
                "input",
                event => {

                    renderChannels(
                        event.target.value
                    );

                }
            );


        $("sendMessageButton")
            ?.addEventListener(
                "click",
                sendMessage
            );


        $("messageInput")
            ?.addEventListener(
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


        $("messageInput")
            ?.addEventListener(
                "input",
                event => {

                    autoResizeTextarea(
                        event.target
                    );

                }
            );


        $("cancelReplyButton")
            ?.addEventListener(
                "click",
                cancelReply
            );


        document.addEventListener(
            "click",
            event => {

                const emoji =
                    $("emojiPicker");

                const gif =
                    $("gifPicker");

                const emojiButton =
                    $("emojiButton");

                const gifButton =
                    $("gifButton");

                if (
                    emoji &&
                    !emoji.classList.contains(
                        "hidden"
                    ) &&
                    !emoji.contains(
                        event.target
                    ) &&
                    event.target !==
                        emojiButton
                ) {

                    emoji.classList.add(
                        "hidden"
                    );

                    state.emojiOpen =
                        false;
                }

                if (
                    gif &&
                    !gif.classList.contains(
                        "hidden"
                    ) &&
                    !gif.contains(
                        event.target
                    ) &&
                    event.target !==
                        gifButton
                ) {

                    gif.classList.add(
                        "hidden"
                    );

                    state.gifOpen =
                        false;
                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    closePickerMenus();

                    closeCommunityModal();

                    closeGeneralCallModal();

                    cancelReply();

                }

            }
        );


        $("messageList")
            ?.addEventListener(
                "scroll",
                async event => {

                    const element =
                        event.currentTarget;

                    if (
                        element.scrollTop <
                            100 &&
                        state.hasMoreMessages &&
                        !state.loadingMessages
                    ) {

                        const previousHeight =
                            element.scrollHeight;

                        await loadMessages(
                            false
                        );

                        const newHeight =
                            element.scrollHeight;

                        element.scrollTop =
                            newHeight -
                            previousHeight;

                    }

                }
            );


        $("channelCallButton")
            ?.addEventListener(
                "click",
                () => {

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:channel-call",
                            {
                                detail: {
                                    communityId:
                                        state.selectedCommunity
                                            ?.id,
                                    channelId:
                                        state.selectedChannel
                                            ?.id,
                                    mode:
                                        "voice"
                                }
                            }
                        )
                    );

                }
            );


        $("channelSearchButton")
            ?.addEventListener(
                "click",
                () => {

                    $("channelSearch")
                        ?.focus();

                }
            );

    }


    function autoResizeTextarea(
        textarea
    ) {

        if (!textarea) {
            return;
        }

        textarea.style.height =
            "auto";

        textarea.style.height =
            Math.min(
                textarea.scrollHeight,
                140
            ) + "px";
    }


    function toggleMembers() {

        const sidebar =
            $("memberSidebar");

        if (!sidebar) {
            return;
        }

        state.memberSidebarOpen =
            !state.memberSidebarOpen;

        if (
            window.innerWidth <= 1200
        ) {

            sidebar.style.display =
                state.memberSidebarOpen
                    ? "flex"
                    : "none";
        }

    }


    function closeMembers() {

        const sidebar =
            $("memberSidebar");

        if (!sidebar) {
            return;
        }

        if (
            window.innerWidth <= 1200
        ) {

            sidebar.style.display =
                "none";
        }
    }


    /* =====================================================
       MODALS
       ===================================================== */

    function openCommunityModal() {

        $("communityModal")
            ?.classList.remove(
                "hidden"
            );
    }


    function closeCommunityModal() {

        $("communityModal")
            ?.classList.add(
                "hidden"
            );
    }


    /* =====================================================
       SCROLL
       ===================================================== */

    function scrollMessagesToBottom() {

        const list =
            $("messageList");

        if (!list) {
            return;
        }

        requestAnimationFrame(
            () => {

                list.scrollTop =
                    list.scrollHeight;

            }
        );
    }


    /* =====================================================
       DEBOUNCE
       ===================================================== */

    function debounce(
        callback,
        delay
    ) {

        let timer = null;

        return (...args) => {

            clearTimeout(timer);

            timer =
                setTimeout(
                    () => callback(...args),
                    delay
                );

        };
    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function initialize() {

        if (state.initialized) {
            return;
        }

        state.initialized =
            true;

        console.log(
            "Community starting"
        );

        try {

            state.supabase =
                await waitForSupabase();

            console.log(
                "Supabase client ready"
            );

            setupUI();

            setupRules();

            setupFileUpload();

            setupEmoji();

            setupGif();

            setupVoiceRecording();

            setupGeneralCall();

            await loadAuthenticatedUser();

            await loadProfile();

            await loadCommunities();

            showRulesGate();

            console.log(
                "Community loaded"
            );

        } catch (error) {

            console.error(
                "Community initialization failed:",
                error
            );

            showToast(
                error.message ||
                "Community could not be loaded."
            );
        }
    }


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
