/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   community.js
   ---------------------------------------------------------
   Handles:
   - Authentication
   - Community loading
   - Community switching
   - Channel loading
   - Messages
   - Message pagination
   - Attachments
   - Images/documents
   - GIFs
   - Emoji picker
   - Voice notes
   - Reactions
   - Delete own messages
   - Realtime messages/reactions/attachments
   - Rules gate
   - General-call event dispatch
   ---------------------------------------------------------
   WebRTC is intentionally NOT implemented here.
   WebRTC lives in call.js.
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

    const MESSAGE_PAGE_SIZE = 50;

    const MAX_FILE_SIZE =
        50 * 1024 * 1024;

    const GIF_LIMIT = 24;

    const GIPHY_API_KEY =
        "YOUR_GIPHY_API_KEY";

    /* =====================================================
       SUPABASE
       ===================================================== */

    let supabase = null;

    function getSupabase() {

        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        if (window.supabase) {
            return window.supabase;
        }

        if (window.sb) {
            return window.sb;
        }

        if (window.mwanikiSupabase) {
            return window.mwanikiSupabase;
        }

        return null;
    }

    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        user: null,

        profile: null,

        communities: [],

        channels: [],

        messages: [],

        reactions: [],

        attachments: [],

        profiles: new Map(),

        selectedCommunity: null,

        selectedChannel: null,

        messageLoading: false,

        olderMessagesLoading: false,

        hasMoreMessages: true,

        oldestMessageCreatedAt: null,

        rulesAccepted: false,

        realtimeChannels: [],

        recording: false,

        mediaRecorder: null,

        recordedChunks: [],

        gifSearchTimeout: null,

        currentGifQuery: "",

        initialized: false

    };

    /* =====================================================
       DOM HELPER
       ===================================================== */

    function $(selector) {
        return document.querySelector(selector);
    }

    function $all(selector) {
        return Array.from(
            document.querySelectorAll(selector)
        );
    }

    /* =====================================================
       HTML ESCAPING
       ===================================================== */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function safeUrl(value) {

        if (!value) {
            return "";
        }

        try {

            const url =
                new URL(value, window.location.href);

            const allowed =
                [
                    "http:",
                    "https:",
                    "blob:",
                    "data:"
                ];

            if (!allowed.includes(url.protocol)) {
                return "";
            }

            return url.href;

        } catch {

            return "";
        }
    }

    /* =====================================================
       COMMUNITY ICONS
       ===================================================== */

    function getCommunityIcon(community) {

        const name =
            String(
                community?.name || ""
            )
                .trim()
                .toLowerCase();

        if (name.includes("gaming")) {
            return "🎮";
        }

        if (name.includes("meme")) {
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

    function getChannelIcon(channel) {

        return channel?.icon || "#";
    }

    /* =====================================================
       DATE / FILE HELPERS
       ===================================================== */

    function formatMessageTime(value) {

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

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function formatMessageDate(value) {

        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        return date.toLocaleDateString(
            [],
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    }

    function formatFileSize(bytes) {

        const size =
            Number(bytes || 0);

        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(
                size / 1024
            ).toFixed(1)} KB`;
        }

        if (size < 1024 * 1024 * 1024) {
            return `${(
                size /
                (1024 * 1024)
            ).toFixed(1)} MB`;
        }

        return `${(
            size /
            (1024 * 1024 * 1024)
        ).toFixed(1)} GB`;
    }

    function initials(name) {

        const text =
            String(
                name || "Student"
            )
                .trim();

        if (!text) {
            return "S";
        }

        const parts =
            text.split(/\s+/);

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

    /* =====================================================
       TOAST
       ===================================================== */

    function toast(message, type = "info") {

        let element =
            $("#communityToast");

        if (!element) {

            element =
                document.createElement(
                    "div"
                );

            element.id =
                "communityToast";

            element.className =
                "community-toast";

            document.body.appendChild(
                element
            );
        }

        element.textContent =
            message;

        element.dataset.type =
            type;

        element.classList.add(
            "show"
        );

        clearTimeout(
            element._timer
        );

        element._timer =
            setTimeout(() => {

                element.classList.remove(
                    "show"
                );

            }, 3000);
    }

    /* =====================================================
       AUTHENTICATION
       ===================================================== */

    async function getCurrentUser() {

        supabase =
            getSupabase();

        if (!supabase) {

            console.error(
                "Supabase client is not available."
            );

            return null;
        }

        const {
            data,
            error
        } =
            await supabase.auth.getSession();

        if (error) {

            console.error(
                "Session error:",
                error
            );

            return null;
        }

        return data?.session?.user || null;
    }

    async function requireAuthentication() {

        state.user =
            await getCurrentUser();

        if (!state.user) {

            toast(
                "You must be signed in to use the community.",
                "error"
            );

            return false;
        }

        return true;
    }

    /* =====================================================
       PROFILE
       ===================================================== */

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

            return;
        }

        state.profile =
            data || {};

        updateOwnProfileUI();
    }

    function getProfileName(profile) {

        if (!profile) {
            return "Student";
        }

        return (
            profile.full_name ||
            profile.name ||
            profile.display_name ||
            profile.username ||
            state.user?.email ||
            "Student"
        );
    }

    function getProfileAvatar(profile) {

        if (!profile) {
            return "";
        }

        return (
            profile.avatar_url ||
            profile.profile_image ||
            profile.photo_url ||
            profile.image_url ||
            ""
        );
    }

    function updateOwnProfileUI() {

        const name =
            getProfileName(
                state.profile
            );

        const avatar =
            getProfileAvatar(
                state.profile
            );

        const headerAvatar =
            $("#headerProfileAvatar");

        const profileAvatar =
            $("#profileLargeAvatar");

        if (headerAvatar) {

            if (avatar) {

                headerAvatar.innerHTML = `
                    <img
                        src="${escapeHtml(
                            safeUrl(avatar)
                        )}"
                        alt=""
                    >
                `;

            } else {

                headerAvatar.textContent =
                    initials(name);
            }
        }

        if (profileAvatar) {

            if (avatar) {

                profileAvatar.innerHTML = `
                    <img
                        src="${escapeHtml(
                            safeUrl(avatar)
                        )}"
                        alt=""
                    >
                `;

            } else {

                profileAvatar.textContent =
                    initials(name);
            }
        }
    }

    /* =====================================================
       RULES
       ===================================================== */

    function rulesStorageKey() {

        if (!state.user) {
            return null;
        }

        return `
            ${RULES_VERSION}:
            ${state.user.id}
        `.replace(/\s+/g, "");
    }

    function checkRulesAccepted() {

        const key =
            rulesStorageKey();

        if (!key) {
            return false;
        }

        return (
            localStorage.getItem(key) ===
            "accepted"
        );
    }

    function showRulesGate() {

        const gate =
            $("#rulesGate");

        if (!gate) {
            return;
        }

        gate.classList.remove(
            "hidden"
        );

        gate.style.display =
            "flex";

        const checkbox =
            $("#communityRulesAgreement");

        if (checkbox) {
            checkbox.checked = false;
        }
    }

    function hideRulesGate() {

        const gate =
            $("#rulesGate");

        if (!gate) {
            return;
        }

        gate.classList.add(
            "hidden"
        );

        gate.style.display =
            "none";
    }

    function setupRules() {

        state.rulesAccepted =
            checkRulesAccepted();

        if (state.rulesAccepted) {

            hideRulesGate();

            return;
        }

        showRulesGate();

        const checkbox =
            $("#communityRulesAgreement");

        const button =
            $("#acceptRulesButton");

        if (!button) {
            return;
        }

        button.onclick =
            () => {

                if (
                    checkbox &&
                    !checkbox.checked
                ) {

                    const message =
                        $("#rulesGateMessage");

                    if (message) {

                        message.textContent =
                            "Please agree to the community rules first.";

                    }

                    return;
                }

                const key =
                    rulesStorageKey();

                localStorage.setItem(
                    key,
                    "accepted"
                );

                state.rulesAccepted =
                    true;

                hideRulesGate();
            };
    }

    /* =====================================================
       COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

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

            console.error(
                "Community loading error:",
                error
            );

            toast(
                "Could not load communities.",
                "error"
            );

            return;
        }

        state.communities =
            data || [];

        renderCommunityRail();

        const savedId =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        let selected =
            state.communities.find(
                community =>
                    community.id ===
                    savedId
            );

        if (!selected) {

            selected =
                state.communities.find(
                    community =>
                        community.id ===
                        DEFAULT_DISCUSSION_ID
                );
        }

        if (!selected) {

            selected =
                state.communities.find(
                    community =>
                        String(
                            community.name || ""
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

        if (selected) {
            await selectCommunity(
                selected
            );
        }

        console.log(
            `${state.communities.length} community(s) loaded.`
        );
    }

    async function selectCommunity(
        community
    ) {

        if (!community) {
            return;
        }

        state.selectedCommunity =
            community;

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            community.id
        );

        updateSelectedCommunityUI();

        renderCommunityRail();

        await loadChannels();

        openCommunityModal(false);
    }

    function updateSelectedCommunityUI() {

        const community =
            state.selectedCommunity;

        if (!community) {
            return;
        }

        const icon =
            $("#selectedCommunityIcon");

        const name =
            $("#selectedCommunityName");

        const description =
            $("#selectedCommunityDescription");

        if (icon) {

            icon.innerHTML = `
                <span class="selected-community-emoji">
                    ${getCommunityIcon(
                        community
                    )}
                </span>
            `;
        }

        if (name) {

            name.textContent =
                community.name ||
                DEFAULT_DISCUSSION_NAME;
        }

        if (description) {

            description.textContent =
                community.description ||
                "Academic Community";
        }
    }

    function renderCommunityRail() {

        const container =
            $("#communityRailList");

        if (!container) {
            return;
        }

        container.innerHTML =
            state.communities
                .map(community => {

                    const active =
                        community.id ===
                        state.selectedCommunity?.id;

                    return `
                        <button
                            type="button"
                            class="community-rail-button ${
                                active
                                    ? "active"
                                    : ""
                            }"
                            data-community-id="${escapeHtml(
                                community.id
                            )}"
                            title="${escapeHtml(
                                community.name
                            )}"
                            aria-label="${escapeHtml(
                                community.name
                            )}"
                        >
                            <span
                                class="community-rail-icon"
                                aria-hidden="true"
                            >
                                ${getCommunityIcon(
                                    community
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

                        const community =
                            state.communities.find(
                                item =>
                                    item.id ===
                                    button.dataset
                                        .communityId
                            );

                        if (!community) {
                            return;
                        }

                        await selectCommunity(
                            community
                        );
                    }
                );
            });
    }

    /* =====================================================
       COMMUNITY MODAL
       ===================================================== */

    function openCommunityModal(
        show = true
    ) {

        const modal =
            $("#communityModal");

        if (!modal) {
            return;
        }

        if (show) {

            modal.classList.add(
                "open"
            );

            modal.classList.remove(
                "hidden"
            );

            modal.style.display =
                "flex";

            renderCommunityModal();

        } else {

            closeCommunityModal();
        }
    }

    function closeCommunityModal() {

        const modal =
            $("#communityModal");

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open"
        );

        modal.classList.add(
            "hidden"
        );

        modal.style.display =
            "none";
    }

    function renderCommunityModal(
        search = ""
    ) {

        const container =
            $("#communityChoiceList");

        if (!container) {
            return;
        }

        const term =
            String(search)
                .trim()
                .toLowerCase();

        const communities =
            state.communities.filter(
                community => {

                    if (!term) {
                        return true;
                    }

                    const name =
                        String(
                            community.name ||
                            ""
                        ).toLowerCase();

                    const description =
                        String(
                            community.description ||
                            ""
                        ).toLowerCase();

                    return (
                        name.includes(term) ||
                        description.includes(term)
                    );
                }
            );

        if (!communities.length) {

            container.innerHTML = `
                <div class="community-empty">
                    <div>🔎</div>
                    <strong>
                        No communities found
                    </strong>
                </div>
            `;

            return;
        }

        container.innerHTML =
            communities
                .map(community => {

                    const active =
                        community.id ===
                        state.selectedCommunity?.id;

                    return `
                        <button
                            type="button"
                            class="community-choice ${
                                active
                                    ? "active"
                                    : ""
                            }"
                            data-community-id="${escapeHtml(
                                community.id
                            )}"
                        >

                            <div class="community-choice-icon">

                                <span
                                    class="community-choice-emoji"
                                    aria-hidden="true"
                                >
                                    ${getCommunityIcon(
                                        community
                                    )}
                                </span>

                            </div>

                            <div class="community-choice-info">

                                <strong>
                                    ${escapeHtml(
                                        community.name ||
                                        "Community"
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        community.description ||
                                        "Academic Community"
                                    )}
                                </span>

                            </div>

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

                        const community =
                            state.communities.find(
                                item =>
                                    item.id ===
                                    button.dataset
                                        .communityId
                            );

                        if (!community) {
                            return;
                        }

                        closeCommunityModal();

                        await selectCommunity(
                            community
                        );
                    }
                );
            });
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
            await supabase
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

            console.error(
                "Channel loading error:",
                error
            );

            toast(
                "Could not load channels.",
                "error"
            );

            return;
        }

        state.channels =
            data || [];

        renderChannels();

        const savedId =
            localStorage.getItem(
                `mwanikiSelectedChannel_${state.selectedCommunity.id}`
            );

        let channel =
            state.channels.find(
                item =>
                    item.id === savedId
            );

        if (!channel) {

            channel =
                state.channels.find(
                    item =>
                        String(
                            item.name || ""
                        )
                            .toLowerCase() ===
                        "general"
                );
        }

        if (!channel) {
            channel =
                state.channels[0] ||
                null;
        }

        if (channel) {
            await selectChannel(
                channel
            );
        }

        console.log(
            `${state.channels.length} channel(s) loaded automatically`
        );
    }

    function renderChannels() {

        const container =
            $("#channelList");

        if (!container) {
            return;
        }

        if (!state.channels.length) {

            container.innerHTML = `
                <div class="channel-empty">
                    No channels available.
                </div>
            `;

            return;
        }

        const grouped =
            new Map();

        state.channels.forEach(
            channel => {

                const type =
                    channel.channel_type ||
                    "text";

                if (!grouped.has(type)) {
                    grouped.set(
                        type,
                        []
                    );
                }

                grouped
                    .get(type)
                    .push(channel);
            }
        );

        let html = "";

        grouped.forEach(
            (channels, type) => {

                html += `
                    <div class="channel-group">

                        <div class="channel-group-title">
                            ${escapeHtml(
                                formatChannelGroup(
                                    type
                                )
                            )}
                        </div>
                `;

                channels.forEach(
                    channel => {

                        const active =
                            channel.id ===
                            state.selectedChannel?.id;

                        html += `
                            <button
                                type="button"
                                class="channel-item ${
                                    active
                                        ? "active"
                                        : ""
                                }"
                                data-channel-id="${escapeHtml(
                                    channel.id
                                )}"
                            >

                                <span class="channel-icon">
                                    ${escapeHtml(
                                        getChannelIcon(
                                            channel
                                        )
                                    )}
                                </span>

                                <span class="channel-name">
                                    ${escapeHtml(
                                        channel.name ||
                                        "channel"
                                    )}
                                </span>

                            </button>
                        `;
                    }
                );

                html += `
                    </div>
                `;
            }
        );

        container.innerHTML =
            html;

        container
            .querySelectorAll(
                "[data-channel-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const channel =
                            state.channels.find(
                                item =>
                                    item.id ===
                                    button.dataset
                                        .channelId
                            );

                        if (!channel) {
                            return;
                        }

                        await selectChannel(
                            channel
                        );
                    }
                );
            });
    }

    function formatChannelGroup(type) {

        const value =
            String(type || "")
                .toLowerCase();

        if (
            value.includes("voice")
        ) {
            return "VOICE CHANNELS";
        }

        if (
            value.includes("announcement")
        ) {
            return "ANNOUNCEMENTS";
        }

        return "TEXT CHANNELS";
    }

    async function selectChannel(channel) {

        if (!channel) {
            return;
        }

        state.selectedChannel =
            channel;

        localStorage.setItem(
            `mwanikiSelectedChannel_${state.selectedCommunity.id}`,
            channel.id
        );

        updateSelectedChannelUI();

        renderChannels();

        await loadMessages();

        subscribeToChannel();
    }

    function updateSelectedChannelUI() {

        const channel =
            state.selectedChannel;

        if (!channel) {
            return;
        }

        const name =
            $("#selectedChannelName");

        const description =
            $("#selectedChannelDescription");

        if (name) {

            name.textContent =
                channel.name ||
                "general";
        }

        if (description) {

            description.textContent =
                channel.description ||
                "Community discussion";
        }
    }

    /* =====================================================
       MESSAGES
       ===================================================== */

    async function loadMessages() {

        if (!state.selectedChannel) {
            return;
        }

        state.messageLoading =
            true;

        state.hasMoreMessages =
            true;

        state.oldestMessageCreatedAt =
            null;

        const {
            data,
            error
        } =
            await supabase
                .from("chat_messages")
                .select("*")
                .eq(
                    "channel_id",
                    state.selectedChannel.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(
                    MESSAGE_PAGE_SIZE
                );

        state.messageLoading =
            false;

        if (error) {

            console.error(
                "Message loading error:",
                error
            );

            toast(
                "Could not load messages.",
                "error"
            );

            return;
        }

        state.messages =
            (data || [])
                .reverse();

        if (
            state.messages.length <
            MESSAGE_PAGE_SIZE
        ) {
            state.hasMoreMessages =
                false;
        }

        if (state.messages.length) {

            state.oldestMessageCreatedAt =
                state.messages[0]
                    .created_at;
        }

        await loadMessageRelatedData();

        renderMessages();

        scrollMessagesToBottom();
    }

    async function loadOlderMessages() {

        if (
            state.olderMessagesLoading ||
            !state.hasMoreMessages ||
            !state.selectedChannel ||
            !state.oldestMessageCreatedAt
        ) {
            return;
        }

        state.olderMessagesLoading =
            true;

        const container =
            $("#messageList");

        const oldHeight =
            container?.scrollHeight || 0;

        const oldTop =
            container?.scrollTop || 0;

        const {
            data,
            error
        } =
            await supabase
                .from("chat_messages")
                .select("*")
                .eq(
                    "channel_id",
                    state.selectedChannel.id
                )
                .lt(
                    "created_at",
                    state.oldestMessageCreatedAt
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(
                    MESSAGE_PAGE_SIZE
                );

        state.olderMessagesLoading =
            false;

        if (error) {

            console.error(
                "Older messages error:",
                error
            );

            return;
        }

        const older =
            (data || [])
                .reverse();

        if (
            older.length <
            MESSAGE_PAGE_SIZE
        ) {
            state.hasMoreMessages =
                false;
        }

        if (older.length) {

            state.messages =
                [
                    ...older,
                    ...state.messages
                ];

            state.oldestMessageCreatedAt =
                older[0].created_at;

            await loadMessageRelatedData();

            renderMessages();

            if (container) {

                const newHeight =
                    container.scrollHeight;

                container.scrollTop =
                    oldTop +
                    (
                        newHeight -
                        oldHeight
                    );
            }
        }
    }

    async function loadMessageRelatedData() {

        const ids =
            state.messages
                .map(
                    message =>
                        message.id
                )
                .filter(Boolean);

        if (!ids.length) {
            state.reactions = [];
            state.attachments = [];
            return;
        }

        const [
            reactionResult,
            attachmentResult
        ] =
            await Promise.all([

                supabase
                    .from(
                        "chat_message_reactions"
                    )
                    .select("*")
                    .in(
                        "message_id",
                        ids
                    ),

                supabase
                    .from(
                        "chat_attachments"
                    )
                    .select("*")
                    .in(
                        "message_id",
                        ids
                    )

            ]);

        if (!reactionResult.error) {

            state.reactions =
                reactionResult.data ||
                [];
        }

        if (!attachmentResult.error) {

            state.attachments =
                attachmentResult.data ||
                [];
        }

        await loadMessageProfiles();
    }

    async function loadMessageProfiles() {

        const userIds =
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

        if (!userIds.length) {
            return;
        }

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "students"
                )
                .select("*")
                .in(
                    "id",
                    userIds
                );

        if (error) {

            console.warn(
                "Student profile lookup failed:",
                error
            );

            return;
        }

        (data || []).forEach(
            profile => {

                state.profiles.set(
                    profile.id,
                    profile
                );
            }
        );
    }

    /* =====================================================
       MESSAGE RENDERING
       ===================================================== */

    function renderMessages() {

        const container =
            $("#messageList");

        if (!container) {
            return;
        }

        if (!state.messages.length) {

            container.innerHTML = `
                <div class="message-empty-state">
                    <div class="empty-icon">💬</div>
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

        let html = "";

        let previousDate = "";

        state.messages.forEach(
            message => {

                const date =
                    formatMessageDate(
                        message.created_at
                    );

                if (date !== previousDate) {

                    html += `
                        <div class="message-date-divider">
                            <span>
                                ${escapeHtml(
                                    date
                                )}
                            </span>
                        </div>
                    `;

                    previousDate =
                        date;
                }

                html +=
                    renderMessage(
                        message
                    );
            }
        );

        container.innerHTML =
            html;

        attachMessageActions();
    }

    function renderMessage(message) {

        const profile =
            state.profiles.get(
                message.user_id
            );

        const name =
            getProfileName(
                profile
            );

        const avatar =
            getProfileAvatar(
                profile
            );

        const own =
            message.user_id ===
            state.user?.id;

        const deleted =
            Boolean(
                message.is_deleted
            );

        const reactions =
            getMessageReactions(
                message.id
            );

        const attachments =
            state.attachments.filter(
                item =>
                    item.message_id ===
                    message.id
            );

        let avatarHtml = "";

        if (avatar) {

            avatarHtml = `
                <img
                    src="${escapeHtml(
                        safeUrl(avatar)
                    )}"
                    alt=""
                    class="message-avatar-image"
                >
            `;

        } else {

            avatarHtml = `
                <span class="message-avatar-initials">
                    ${escapeHtml(
                        initials(name)
                    )}
                </span>
            `;
        }

        let content = "";

        if (deleted) {

            content = `
                <div class="message-deleted">
                    This message was deleted.
                </div>
            `;

        } else {

            content +=
                renderMessageContent(
                    message
                );

            content +=
                renderAttachments(
                    attachments
                );
        }

        return `
            <article
                class="message-row ${
                    own ? "own" : ""
                }"
                data-message-id="${escapeHtml(
                    message.id
                )}"
            >

                <div class="message-avatar">
                    ${avatarHtml}
                </div>

                <div class="message-main">

                    <div class="message-header">

                        <strong class="message-author">
                            ${escapeHtml(
                                name
                            )}
                        </strong>

                        <time>
                            ${escapeHtml(
                                formatMessageTime(
                                    message.created_at
                                )
                            )}
                        </time>

                    </div>

                    <div class="message-content">
                        ${content}
                    </div>

                    ${
                        deleted
                            ? ""
                            : renderReactions(
                                message.id,
                                reactions
                            )
                    }

                    ${
                        deleted
                            ? ""
                            : `
                                <div class="message-actions">

                                    <button
                                        type="button"
                                        data-action="react"
                                        data-reaction="👍"
                                        title="Like"
                                    >
                                        👍
                                    </button>

                                    <button
                                        type="button"
                                        data-action="react"
                                        data-reaction="❤️"
                                        title="Heart"
                                    >
                                        ❤️
                                    </button>

                                    ${
                                        own
                                            ? `
                                                <button
                                                    type="button"
                                                    data-action="delete"
                                                    title="Delete message"
                                                >
                                                    🗑️
                                                </button>
                                            `
                                            : ""
                                    }

                                </div>
                            `
                    }

                </div>

            </article>
        `;
    }

    function renderMessageContent(message) {

        const type =
            message.message_type ||
            "text";

        if (
            type === "gif"
        ) {

            const url =
                safeUrl(
                    message.content
                );

            if (!url) {
                return "";
            }

            return `
                <div class="message-gif">
                    <img
                        src="${escapeHtml(url)}"
                        alt="GIF"
                        loading="lazy"
                    >
                </div>
            `;
        }

        if (
            type === "voice"
        ) {

            const url =
                safeUrl(
                    message.content
                );

            if (!url) {
                return "";
            }

            return `
                <div class="message-audio">
                    <audio
                        controls
                        preload="metadata"
                        src="${escapeHtml(url)}"
                    ></audio>
                </div>
            `;
        }

        return `
            <div class="message-text">
                ${formatMessageText(
                    message.content
                )}
            </div>
        `;
    }

    function formatMessageText(value) {

        let text =
            escapeHtml(
                value || ""
            );

        text =
            text.replace(
                /\n/g,
                "<br>"
            );

        return text;
    }

    function renderAttachments(
        attachments
    ) {

        if (!attachments.length) {
            return "";
        }

        return `
            <div class="message-attachments">

                ${attachments
                    .map(
                        attachment =>
                            renderAttachment(
                                attachment
                            )
                    )
                    .join("")}

            </div>
        `;
    }

    function renderAttachment(
        attachment
    ) {

        const url =
            safeUrl(
                attachment.file_url
            );

        if (!url) {
            return "";
        }

        const mime =
            String(
                attachment.mime_type || ""
            ).toLowerCase();

        if (
            mime.startsWith(
                "image/"
            )
        ) {

            return `
                <a
                    class="message-image-attachment"
                    href="${escapeHtml(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src="${escapeHtml(url)}"
                        alt="${escapeHtml(
                            attachment.file_name
                        )}"
                        loading="lazy"
                    >
                </a>
            `;
        }

        return `
            <a
                class="message-file-attachment"
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noopener noreferrer"
                download
            >

                <span class="file-icon">
                    📄
                </span>

                <span class="file-info">

                    <strong>
                        ${escapeHtml(
                            attachment.file_name
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            formatFileSize(
                                attachment.file_size
                            )
                        )}
                    </small>

                </span>

            </a>
        `;
    }

    /* =====================================================
       REACTIONS
       ===================================================== */

    function getMessageReactions(
        messageId
    ) {

        return state.reactions.filter(
            reaction =>
                reaction.message_id ===
                messageId
        );
    }

    function renderReactions(
        messageId,
        reactions
    ) {

        if (!reactions.length) {
            return "";
        }

        const grouped =
            new Map();

        reactions.forEach(
            reaction => {

                const value =
                    reaction.reaction ||
                    "👍";

                if (!grouped.has(value)) {

                    grouped.set(
                        value,
                        {
                            count: 0,
                            own: false
                        }
                    );
                }

                const item =
                    grouped.get(value);

                item.count++;

                if (
                    reaction.user_id ===
                    state.user?.id
                ) {

                    item.own = true;
                }
            }
        );

        return `
            <div class="message-reactions">

                ${[
                    ...grouped.entries()
                ]
                    .map(
                        ([emoji, item]) => `
                            <button
                                type="button"
                                class="reaction-chip ${
                                    item.own
                                        ? "own"
                                        : ""
                                }"
                                data-action="react"
                                data-reaction="${escapeHtml(
                                    emoji
                                )}"
                            >
                                ${escapeHtml(
                                    emoji
                                )}
                                <span>
                                    ${item.count}
                                </span>
                            </button>
                        `
                    )
                    .join("")}

            </div>
        `;
    }

    async function toggleReaction(
        messageId,
        reactionValue
    ) {

        if (!state.user) {
            return;
        }

        const existing =
            state.reactions.find(
                reaction =>
                    reaction.message_id ===
                        messageId &&
                    reaction.user_id ===
                        state.user.id &&
                    reaction.reaction ===
                        reactionValue
            );

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
                    "Reaction removal error:",
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

                        reaction:
                            reactionValue
                    });

            if (error) {

                console.error(
                    "Reaction error:",
                    error
                );

                return;
            }
        }

        await loadMessageRelatedData();

        renderMessages();
    }

    /* =====================================================
       MESSAGE ACTIONS
       ===================================================== */

    function attachMessageActions() {

        $all(
            "[data-action='react']"
        )
            .forEach(button => {

                button.onclick =
                    async event => {

                        event.stopPropagation();

                        const message =
                            button.closest(
                                "[data-message-id]"
                            );

                        if (!message) {
                            return;
                        }

                        await toggleReaction(
                            message.dataset
                                .messageId,
                            button.dataset
                                .reaction ||
                                "👍"
                        );
                    };
            });

        $all(
            "[data-action='delete']"
        )
            .forEach(button => {

                button.onclick =
                    async event => {

                        event.stopPropagation();

                        const message =
                            button.closest(
                                "[data-message-id]"
                            );

                        if (!message) {
                            return;
                        }

                        await deleteMessage(
                            message.dataset
                                .messageId
                        );
                    };
            });
    }

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

        const {
            error
        } =
            await supabase
                .from("chat_messages")
                .update({
                    is_deleted: true,
                    deleted_at:
                        new Date().toISOString(),
                    content:
                        ""
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
                "Could not delete the message.",
                "error"
            );

            return;
        }

        const target =
            state.messages.find(
                item =>
                    item.id ===
                    messageId
            );

        if (target) {

            target.is_deleted =
                true;

            target.deleted_at =
                new Date().toISOString();

            target.content =
                "";
        }

        renderMessages();
    }

    /* =====================================================
       SEND MESSAGE
       ===================================================== */

    async function sendMessage() {

        if (!state.rulesAccepted) {

            showRulesGate();

            return;
        }

        if (
            !state.user ||
            !state.selectedChannel
        ) {
            return;
        }

        const input =
            $("#messageInput");

        if (!input) {
            return;
        }

        const content =
            input.value.trim();

        if (!content) {
            return;
        }

        input.disabled =
            true;

        const {
            error
        } =
            await supabase
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.selectedChannel.id,

                    user_id:
                        state.user.id,

                    content,

                    message_type:
                        "text"
                });

        input.disabled =
            false;

        if (error) {

            console.error(
                "Send message error:",
                error
            );

            toast(
                "Could not send message.",
                "error"
            );

            return;
        }

        input.value = "";

        resizeMessageInput();

        scrollMessagesToBottom();
    }

    function resizeMessageInput() {

        const input =
            $("#messageInput");

        if (!input) {
            return;
        }

        input.style.height =
            "auto";

        input.style.height =
            Math.min(
                input.scrollHeight,
                180
            ) + "px";
    }

    /* =====================================================
       ATTACHMENTS
       ===================================================== */

    function setupAttachmentInput() {

        let input =
            $("#communityFileInput");

        if (!input) {

            input =
                document.createElement(
                    "input"
                );

            input.type =
                "file";

            input.id =
                "communityFileInput";

            input.hidden =
                true;

            input.multiple =
                true;

            input.accept =
                [
                    "image/*",
                    ".pdf",
                    ".txt",
                    ".csv",
                    ".doc",
                    ".docx",
                    ".ppt",
                    ".pptx",
                    ".xls",
                    ".xlsx"
                ].join(",");

            document.body.appendChild(
                input
            );
        }

        input.onchange =
            async () => {

                const files =
                    Array.from(
                        input.files || []
                    );

                input.value = "";

                for (
                    const file of files
                ) {

                    await uploadAttachment(
                        file
                    );
                }
            };
    }

    async function uploadAttachment(
        file
    ) {

        if (!state.user) {
            return;
        }

        if (!state.selectedChannel) {
            return;
        }

        if (
            file.size >
            MAX_FILE_SIZE
        ) {

            toast(
                `${file.name} is larger than 50 MB.`,
                "error"
            );

            return;
        }

        try {

            const extension =
                getFileExtension(
                    file.name
                );

            const folder =
                file.type.startsWith(
                    "image/"
                )
                    ? "images"
                    : "documents";

            const path =
                `${state.user.id}/${folder}/${Date.now()}-${cryptoRandom()}${extension}`;

            toast(
                `Uploading ${file.name}...`,
                "info"
            );

            const {
                error: uploadError
            } =
                await supabase
                    .storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .upload(
                        path,
                        file,
                        {
                            cacheControl:
                                "3600",

                            upsert:
                                false,

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
                supabase
                    .storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .getPublicUrl(
                        path
                    );

            const fileUrl =
                publicData?.publicUrl;

            if (!fileUrl) {
                throw new Error(
                    "Could not create public file URL."
                );
            }

            const {
                data: message,
                error: messageError
            } =
                await supabase
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.selectedChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            file.name,

                        message_type:
                            "file"
                    })
                    .select()
                    .single();

            if (messageError) {
                throw messageError;
            }

            const {
                error: attachmentError
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
                throw attachmentError;
            }

            toast(
                "File sent.",
                "success"
            );

        } catch (error) {

            console.error(
                "Attachment upload error:",
                error
            );

            toast(
                "File upload failed.",
                "error"
            );
        }
    }

    function getFileExtension(
        filename
    ) {

        const value =
            String(
                filename || ""
            );

        const index =
            value.lastIndexOf(".");

        if (index === -1) {
            return "";
        }

        return value.slice(
            index
        );
    }

    function cryptoRandom() {

        if (
            window.crypto &&
            crypto.getRandomValues
        ) {

            const values =
                new Uint32Array(2);

            crypto.getRandomValues(
                values
            );

            return (
                values[0].toString(16) +
                values[1].toString(16)
            );
        }

        return Math.random()
            .toString(36)
            .slice(2);
    }

    /* =====================================================
       GIFS
       ===================================================== */

    function setupGifPicker() {

        const button =
            $("#gifButton");

        const picker =
            $("#gifPicker");

        if (!button || !picker) {
            return;
        }

        button.onclick =
            event => {

                event.stopPropagation();

                const isOpen =
                    picker.classList.contains(
                        "open"
                    );

                closeEmojiPicker();

                if (isOpen) {

                    closeGifPicker();

                } else {

                    openGifPicker();
                }
            };

        document.addEventListener(
            "click",
            event => {

                if (
                    !picker.contains(
                        event.target
                    ) &&
                    event.target !== button
                ) {

                    closeGifPicker();
                }
            }
        );
    }

    function openGifPicker() {

        const picker =
            $("#gifPicker");

        if (!picker) {
            return;
        }

        picker.classList.add(
            "open"
        );

        picker.style.display =
            "block";

        renderGifPicker();
    }

    function closeGifPicker() {

        const picker =
            $("#gifPicker");

        if (!picker) {
            return;
        }

        picker.classList.remove(
            "open"
        );

        picker.style.display =
            "none";
    }

    function renderGifPicker(
        query = ""
    ) {

        const picker =
            $("#gifPicker");

        if (!picker) {
            return;
        }

        if (
            !GIPHY_API_KEY ||
            GIPHY_API_KEY ===
                "YOUR_GIPHY_API_KEY"
        ) {

            picker.innerHTML = `
                <div class="gif-placeholder">
                    Add a Giphy API key in
                    community.js to enable GIF search.
                </div>
            `;

            return;
        }

        picker.innerHTML = `
            <div class="gif-search-row">

                <input
                    type="search"
                    id="gifSearchInput"
                    placeholder="Search GIFs..."
                    value="${escapeHtml(
                        query
                    )}"
                >

            </div>

            <div
                class="gif-results"
                id="gifResults"
            >
                Loading GIFs...
            </div>
        `;

        const input =
            $("#gifSearchInput");

        if (input) {

            input.focus();

            input.oninput =
                () => {

                    clearTimeout(
                        state.gifSearchTimeout
                    );

                    state.gifSearchTimeout =
                        setTimeout(
                            () => {

                                loadGifs(
                                    input.value.trim()
                                );

                            },
                            400
                        );
                };
        }

        loadGifs(
            query
        );
    }

    async function loadGifs(
        query = ""
    ) {

        const results =
            $("#gifResults");

        if (!results) {
            return;
        }

        if (
            !GIPHY_API_KEY ||
            GIPHY_API_KEY ===
                "YOUR_GIPHY_API_KEY"
        ) {
            return;
        }

        try {

            const endpoint =
                query
                    ? "search"
                    : "trending";

            const url =
                `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${encodeURIComponent(
                    GIPHY_API_KEY
                )}&limit=${GIF_LIMIT}&rating=pg&lang=en${
                    query
                        ? `&q=${encodeURIComponent(
                              query
                          )}`
                        : ""
                }`;

            const response =
                await fetch(url);

            if (!response.ok) {
                throw new Error(
                    "GIF request failed."
                );
            }

            const json =
                await response.json();

            const gifs =
                json.data || [];

            if (!gifs.length) {

                results.innerHTML =
                    "No GIFs found.";

                return;
            }

            results.innerHTML =
                gifs
                    .map(gif => {

                        const original =
                            gif.images?.original
                                ?.url;

                        const preview =
                            gif.images?.fixed_width
                                ?.url ||
                            original;

                        if (!original) {
                            return "";
                        }

                        return `
                            <button
                                type="button"
                                class="gif-item"
                                data-gif-url="${escapeHtml(
                                    original
                                )}"
                            >
                                <img
                                    src="${escapeHtml(
                                        preview
                                    )}"
                                    alt="GIF"
                                    loading="lazy"
                                >
                            </button>
                        `;
                    })
                    .join("");

            results
                .querySelectorAll(
                    "[data-gif-url]"
                )
                .forEach(button => {

                    button.onclick =
                        async () => {

                            await sendGif(
                                button.dataset
                                    .gifUrl
                            );

                            closeGifPicker();
                        };
                });

        } catch (error) {

            console.error(
                "GIF error:",
                error
            );

            results.innerHTML =
                "Could not load GIFs.";
        }
    }

    async function sendGif(
        url
    ) {

        if (
            !url ||
            !state.selectedChannel ||
            !state.user
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
                        state.selectedChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        url,

                    message_type:
                        "gif"
                });

        if (error) {

            console.error(
                "GIF send error:",
                error
            );

            toast(
                "Could not send GIF.",
                "error"
            );
        }
    }

    /* =====================================================
       EMOJI
       ===================================================== */

    function setupEmojiPicker() {

        const button =
            $("#emojiButton");

        const picker =
            $("#emojiPicker");

        if (!button || !picker) {
            return;
        }

        button.onclick =
            event => {

                event.stopPropagation();

                const isOpen =
                    picker.classList.contains(
                        "open"
                    );

                closeGifPicker();

                if (isOpen) {

                    closeEmojiPicker();

                } else {

                    openEmojiPicker();
                }
            };

        picker.addEventListener(
            "emoji-click",
            event => {

                const emoji =
                    event.detail
                        ?.unicode;

                if (!emoji) {
                    return;
                }

                const input =
                    $("#messageInput");

                if (!input) {
                    return;
                }

                insertTextAtCursor(
                    input,
                    emoji
                );

                input.focus();
            }
        );

        document.addEventListener(
            "click",
            event => {

                if (
                    !picker.contains(
                        event.target
                    ) &&
                    event.target !== button
                ) {

                    closeEmojiPicker();
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
                }
            }
        );
    }

    function openEmojiPicker() {

        const picker =
            $("#emojiPicker");

        if (!picker) {
            return;
        }

        picker.classList.add(
            "open"
        );

        picker.style.display =
            "block";
    }

    function closeEmojiPicker() {

        const picker =
            $("#emojiPicker");

        if (!picker) {
            return;
        }

        picker.classList.remove(
            "open"
        );

        picker.style.display =
            "none";
    }

    function insertTextAtCursor(
        input,
        text
    ) {

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
            text +
            input.value.slice(
                end
            );

        const cursor =
            start +
            text.length;

        input.selectionStart =
            cursor;

        input.selectionEnd =
            cursor;

        resizeMessageInput();
    }

    /* =====================================================
       VOICE NOTES
       ===================================================== */

    function setupVoiceRecorder() {

        const button =
            $("#voiceNoteButton");

        if (!button) {
            return;
        }

        button.onclick =
            async () => {

                if (state.recording) {

                    stopVoiceRecording();

                } else {

                    await startVoiceRecording();
                }
            };
    }

    async function startVoiceRecording() {

        if (!navigator.mediaDevices) {

            toast(
                "Your browser does not support voice recording.",
                "error"
            );

            return;
        }

        try {

            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            let mimeType =
                "";

            if (
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/webm;codecs=opus";

            } else if (
                MediaRecorder.isTypeSupported(
                    "audio/webm"
                )
            ) {

                mimeType =
                    "audio/webm";
            }

            state.recordedChunks =
                [];

            state.mediaRecorder =
                new MediaRecorder(
                    stream,
                    mimeType
                        ? { mimeType }
                        : undefined
                );

            state.mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size
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

                    const type =
                        state.mediaRecorder
                            ?.mimeType ||
                        "audio/webm";

                    const blob =
                        new Blob(
                            state.recordedChunks,
                            {
                                type
                            }
                        );

                    state.mediaRecorder =
                        null;

                    state.recordedChunks =
                        [];

                    if (
                        blob.size > 0
                    ) {

                        await uploadVoiceNote(
                            blob
                        );
                    }
                };

            state.mediaRecorder.start();

            state.recording =
                true;

            updateVoiceRecorderUI();

        } catch (error) {

            console.error(
                "Microphone error:",
                error
            );

            toast(
                "Microphone permission was not granted.",
                "error"
            );
        }
    }

    function stopVoiceRecording() {

        if (
            state.mediaRecorder &&
            state.recording
        ) {

            state.recording =
                false;

            state.mediaRecorder.stop();

            updateVoiceRecorderUI();
        }
    }

    function updateVoiceRecorderUI() {

        const button =
            $("#voiceNoteButton");

        const bar =
            $("#voiceRecorderBar");

        if (button) {

            button.classList.toggle(
                "recording",
                state.recording
            );

            button.setAttribute(
                "aria-label",
                state.recording
                    ? "Stop voice recording"
                    : "Record voice note"
            );
        }

        if (bar) {

            bar.classList.toggle(
                "active",
                state.recording
            );

            bar.style.display =
                state.recording
                    ? "flex"
                    : "none";
        }
    }

    async function uploadVoiceNote(
        blob
    ) {

        if (
            !state.user ||
            !state.selectedChannel
        ) {
            return;
        }

        try {

            const path =
                `${state.user.id}/voice-notes/${Date.now()}-${cryptoRandom()}.webm`;

            const {
                error: uploadError
            } =
                await supabase
                    .storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .upload(
                        path,
                        blob,
                        {
                            contentType:
                                "audio/webm",

                            cacheControl:
                                "3600",

                            upsert:
                                false
                        }
                    );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data
            } =
                supabase
                    .storage
                    .from(
                        STORAGE_BUCKET
                    )
                    .getPublicUrl(
                        path
                    );

            const url =
                data?.publicUrl;

            if (!url) {
                throw new Error(
                    "Voice URL unavailable."
                );
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
                            state.selectedChannel.id,

                        user_id:
                            state.user.id,

                        content:
                            url,

                        message_type:
                            "voice"
                    });

            if (error) {
                throw error;
            }

        } catch (error) {

            console.error(
                "Voice upload error:",
                error
            );

            toast(
                "Could not send voice note.",
                "error"
            );
        }
    }

    /* =====================================================
       REALTIME
       ===================================================== */

    function clearRealtime() {

        if (!supabase) {
            return;
        }

        state.realtimeChannels
            .forEach(
                channel => {

                    try {

                        supabase
                            .removeChannel(
                                channel
                            );

                    } catch {
                        // Ignore cleanup errors.
                    }
                }
            );

        state.realtimeChannels =
            [];
    }

    function subscribeToChannel() {

        if (
            !supabase ||
            !state.selectedChannel
        ) {
            return;
        }

        clearRealtime();

        const channelId =
            state.selectedChannel.id;

        const realtime =
            supabase
                .channel(
                    `community-${channelId}`
                )

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${channelId}`
                    },
                    async payload => {

                        if (
                            payload.eventType ===
                            "INSERT"
                        ) {

                            if (
                                !state.messages
                                    .some(
                                        message =>
                                            message.id ===
                                            payload.new.id
                                    )
                            ) {

                                state.messages
                                    .push(
                                        payload.new
                                    );

                                if (
                                    state.messages
                                        .length >
                                    MESSAGE_PAGE_SIZE *
                                        2
                                ) {

                                    state.messages =
                                        state.messages
                                            .slice(
                                                -MESSAGE_PAGE_SIZE *
                                                    2
                                            );
                                }

                                await loadMessageRelatedData();

                                renderMessages();

                                scrollMessagesToBottom();
                            }

                        } else if (
                            payload.eventType ===
                            "UPDATE"
                        ) {

                            const index =
                                state.messages
                                    .findIndex(
                                        message =>
                                            message.id ===
                                            payload.new.id
                                    );

                            if (
                                index !==
                                -1
                            ) {

                                state.messages[
                                    index
                                ] =
                                    payload.new;

                                await loadMessageRelatedData();

                                renderMessages();
                            }

                        } else if (
                            payload.eventType ===
                            "DELETE"
                        ) {

                            state.messages =
                                state.messages
                                    .filter(
                                        message =>
                                            message.id !==
                                            payload.old.id
                                    );

                            renderMessages();
                        }
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

                        await loadMessageRelatedData();

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

                        await loadMessageRelatedData();

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

        state.realtimeChannels
            .push(
                realtime
            );
    }

    /* =====================================================
       MESSAGE SCROLL
       ===================================================== */

    function scrollMessagesToBottom() {

        const container =
            $("#messageList");

        if (!container) {
            return;
        }

        requestAnimationFrame(
            () => {

                container.scrollTop =
                    container.scrollHeight;
            }
        );
    }

    function setupMessageScroll() {

        const container =
            $("#messageList");

        if (!container) {
            return;
        }

        container.addEventListener(
            "scroll",
            async () => {

                if (
                    container.scrollTop <
                    120
                ) {

                    await loadOlderMessages();
                }
            }
        );
    }

    /* =====================================================
       COMPOSER
       ===================================================== */

    function setupComposer() {

        const input =
            $("#messageInput");

        const sendButton =
            $("#sendMessageButton");

        if (input) {

            input.addEventListener(
                "input",
                resizeMessageInput
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

                        sendMessage();
                    }
                }
            );
        }

        if (sendButton) {

            sendButton.onclick =
                sendMessage;
        }
    }

    /* =====================================================
       ATTACH BUTTON
       ===================================================== */

    function setupAttachButton() {

        const button =
            $("#attachButton");

        if (!button) {
            return;
        }

        button.onclick =
            () => {

                const input =
                    $("#communityFileInput");

                if (input) {
                    input.click();
                }
            };
    }

    /* =====================================================
       GENERAL CALL
       ===================================================== */

    function setupGeneralCallButton() {

        const button =
            $("#generalCallButton");

        if (!button) {
            return;
        }

        button.onclick =
            () => {

                openGeneralCallModal();
            };
    }

    function openGeneralCallModal() {

        const modal =
            $("#generalCallModal");

        if (!modal) {
            return;
        }

        modal.classList.add(
            "open"
        );

        modal.classList.remove(
            "hidden"
        );

        modal.style.display =
            "flex";
    }

    function closeGeneralCallModal() {

        const modal =
            $("#generalCallModal");

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "open"
        );

        modal.classList.add(
            "hidden"
        );

        modal.style.display =
            "none";
    }

    function setupGeneralCallModal() {

        const cancel =
            $("#cancelGeneralCallButton");

        const close =
            $("#closeGeneralCallButton");

        if (cancel) {
            cancel.onclick =
                closeGeneralCallModal;
        }

        if (close) {
            close.onclick =
                closeGeneralCallModal;
        }

        const voice =
            $("#startGeneralVoiceCallButton");

        const video =
            $("#startGeneralVideoCallButton");

        if (voice) {

            voice.onclick =
                () =>
                    dispatchGeneralCall(
                        "audio"
                    );
        }

        if (video) {

            video.onclick =
                () =>
                    dispatchGeneralCall(
                        "video"
                    );
        }
    }

    function dispatchGeneralCall(
        mode
    ) {

        const input =
            $("#generalCallUserInput");

        const targetUserId =
            input?.value?.trim();

        if (!targetUserId) {

            toast(
                "Enter the user ID for now.",
                "error"
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
       NAVIGATION
       ===================================================== */

    function setupNavigation() {

        const dashboard =
            $("#backToDashboard");

        if (dashboard) {

            dashboard.onclick =
                () => {

                    window.location.href =
                        "./dashboard.html";
                };
        }

        const profile =
            $("#profileButton");

        if (profile) {

            profile.onclick =
                () => {

                    window.location.href =
                        "./profile.html";
                };
        }
    }

    /* =====================================================
       COMMUNITY MODAL BUTTON
       ===================================================== */

    function setupCommunityModal() {

        const openButton =
            $("#communitySwitcherButton") ||
            $("#selectedCommunityButton");

        if (openButton) {

            openButton.onclick =
                () =>
                    openCommunityModal(
                        true
                    );
        }

        const closeButton =
            $("#closeCommunityModal");

        if (closeButton) {

            closeButton.onclick =
                closeCommunityModal;
        }

        const search =
            $("#communitySearch");

        if (search) {

            search.oninput =
                () =>
                    renderCommunityModal(
                        search.value
                    );
        }

        const modal =
            $("#communityModal");

        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        closeCommunityModal();
                    }
                }
            );
        }
    }

    /* =====================================================
       OUTSIDE CLICK / ESCAPE
       ===================================================== */

    function setupGlobalKeyboard() {

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

                    closeGeneralCallModal();
                }
            }
        );
    }

    /* =====================================================
       AUTH STATE
       ===================================================== */

    function setupAuthListener() {

        if (!supabase) {
            return;
        }

        supabase.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {

                console.log(
                    "Community auth:",
                    event
                );

                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    clearRealtime();

                    state.user =
                        null;

                    return;
                }

                if (
                    event ===
                    "SIGNED_IN"
                ) {

                    state.user =
                        session?.user ||
                        null;
                }
            }
        );
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

        supabase =
            getSupabase();

        if (!supabase) {

            console.error(
                "Supabase client ready check failed."
            );

            toast(
                "Supabase is not available.",
                "error"
            );

            return;
        }

        console.log(
            "Supabase client ready"
        );

        const authenticated =
            await requireAuthentication();

        if (!authenticated) {
            return;
        }

        console.log(
            "Authenticated session"
        );

        await loadOwnProfile();

        setupRules();

        setupComposer();

        setupMessageScroll();

        setupAttachmentInput();

        setupAttachButton();

        setupEmojiPicker();

        setupGifPicker();

        setupVoiceRecorder();

        setupGeneralCallButton();

        setupGeneralCallModal();

        setupNavigation();

        setupCommunityModal();

        setupGlobalKeyboard();

        setupAuthListener();

        await loadCommunities();

        console.log(
            "Community loaded"
        );
    }

    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.MwanikiCommunity = {

        state,

        reloadCommunities:
            loadCommunities,

        reloadChannels:
            loadChannels,

        reloadMessages:
            loadMessages,

        sendMessage,

        sendGif,

        closeEmojiPicker,

        closeGifPicker,

        openCommunityModal,

        closeCommunityModal

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
