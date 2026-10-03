/* =========================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ---------------------------------------------------------
   Responsibilities:
   - Authentication
   - Profile loading
   - Communities
   - Channels
   - Messages
   - Reactions
   - Message deletion
   - Attachments
   - GIFs
   - Emoji picker
   - Voice notes
   - Rules gate
   - Realtime messaging
   - General-call event bridge

   WebRTC / voice calls / video calls / screen sharing
   remain inside call.js.
   ========================================================= */

"use strict";

/* =========================================================
   SUPABASE
   ========================================================= */

const supabase =
    window.supabaseClient ||
    window.supabase ||
    window.sb ||
    window.mwanikiSupabase;

if (!supabase) {
    console.error("❌ Supabase client not found.");
}

/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {
    storageBucket: "chat-attachments",

    rulesStorageKey:
        "mwaniki-community-rules-v3",

    selectedCommunityKey:
        "mwanikiSelectedCommunity",

    selectedChannelPrefix:
        "mwanikiSelectedChannel_",

    messagePageSize: 50,

    maxFileSize:
        50 * 1024 * 1024,

    defaultCommunityId:
        "9044c031-71da-496d-9166-ff19ed4fcb62",

    defaultCommunityName:
        "Mwaniki Scholars"
};

/* =========================================================
   STATE
   ========================================================= */

const state = {

    user: null,

    profile: null,

    communities: [],

    channels: [],

    messages: [],

    reactions: [],

    attachments: [],

    publicProfiles: new Map(),

    selectedCommunity: null,

    selectedChannel: null,

    messageOffset: 0,

    hasMoreMessages: false,

    realtimeMessages: null,

    realtimeReactions: null,

    realtimeAttachments: null,

    mediaRecorder: null,

    mediaStream: null,

    recordingChunks: [],

    recordingTimer: null,

    recordingStartedAt: null,

    recordingMimeType: "",

    gifUrl: "",

    callMode: "voice",

    replyToMessage: null,

    initialized: false
};

/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return Array.from(
        document.querySelectorAll(selector)
    );
}

/* =========================================================
   GENERAL UTILITIES
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function safeUrl(value) {

    if (!value) {
        return "#";
    }

    try {

        const url =
            new URL(String(value));

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {
            return url.href;
        }

    } catch (_) {}

    return "#";
}

function formatFileSize(bytes) {

    const value =
        Number(bytes || 0);

    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${(
        value /
        (1024 * 1024)
    ).toFixed(1)} MB`;
}

function formatTime(value) {

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

function formatDate(value) {

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleDateString(
        [],
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}

function getInitials(name) {

    const value =
        String(
            name || "Student"
        ).trim();

    if (!value) {
        return "MS";
    }

    return value
        .split(/\s+/)
        .slice(0, 2)
        .map(
            part =>
                part.charAt(0)
        )
        .join("")
        .toUpperCase();
}

function announce(message) {

    const element =
        $("#accessibilityAnnouncer");

    if (element) {
        element.textContent =
            message;
    }
}

/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(message) {

    const toast =
        $("#communityToast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(
            () => {
                toast.classList.remove(
                    "show"
                );
            },
            3000
        );
}

/* =========================================================
   COMMUNITY ICONS
   ========================================================= */

function getCommunityIcon(community) {

    const name =
        String(
            community?.name || ""
        ).toLowerCase();

    if (name.includes("gaming")) {
        return "🎮";
    }

    if (
        name.includes("meme") ||
        name.includes("fun")
    ) {
        return "😂";
    }

    if (
        name.includes("scholar") ||
        name.includes("academic")
    ) {
        return "🎓";
    }

    return "🌐";
}

function getChannelIcon(channel) {

    return (
        channel?.icon ||
        "#"
    );
}

/* =========================================================
   RULES
   ========================================================= */

function rulesAccepted() {

    try {

        return (
            localStorage.getItem(
                CONFIG.rulesStorageKey
            ) === "true"
        );

    } catch (_) {

        return false;
    }
}

function saveRulesAccepted() {

    try {

        localStorage.setItem(
            CONFIG.rulesStorageKey,
            "true"
        );

    } catch (_) {}

    hideRulesGate();
}

function hideRulesGate() {

    const gate =
        $("#rulesGate");

    if (!gate) {
        return;
    }

    gate.classList.add("hidden");

    gate.style.display =
        "none";

    gate.setAttribute(
        "aria-hidden",
        "true"
    );
}

function showRulesGate() {

    const gate =
        $("#rulesGate");

    if (!gate) {
        return;
    }

    gate.classList.remove("hidden");

    gate.style.display =
        "grid";

    gate.setAttribute(
        "aria-hidden",
        "false"
    );

    const checkbox =
        $("#communityRulesAgreement");

    const button =
        $("#acceptRulesButton");

    const message =
        $("#rulesGateMessage");

    if (!checkbox || !button) {
        return;
    }

    button.disabled =
        !checkbox.checked;

    checkbox.onchange = () => {

        button.disabled =
            !checkbox.checked;

        if (message) {
            message.textContent =
                "";
        }
    };

    button.onclick = event => {

        event.preventDefault();

        if (!checkbox.checked) {

            if (message) {
                message.textContent =
                    "Please confirm that you have read and agree to the community rules.";
            }

            return;
        }

        saveRulesAccepted();

        announce(
            "Community rules accepted."
        );

        showToast(
            "Welcome to Mwaniki Scholars Community."
        );
    };
}

function initializeRules() {

    if (rulesAccepted()) {
        hideRulesGate();
    } else {
        showRulesGate();
    }
}

/* =========================================================
   AUTH
   ========================================================= */

async function getCurrentUser() {

    if (!supabase) {
        return null;
    }

    try {

        const {
            data,
            error
        } =
            await supabase.auth.getUser();

        if (error) {
            console.error(
                "Auth lookup error:",
                error
            );
            return null;
        }

        return data?.user || null;

    } catch (error) {

        console.error(
            "Auth exception:",
            error
        );

        return null;
    }
}

/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {

    if (!state.user) {
        return;
    }

    /*
       We deliberately use only the columns that the
       community profile table is expected to expose.
    */

    let profile = null;

    const result =
        await supabase
            .from("students")
            .select("*")
            .eq(
                "id",
                state.user.id
            )
            .maybeSingle();

    if (!result.error) {
        profile = result.data;
    }

    /*
       If students does not contain a row, create a safe
       local profile from the authenticated account.
    */

    state.profile =
        profile || {
            id: state.user.id,

            full_name:
                state.user.user_metadata?.full_name ||
                state.user.user_metadata?.name ||
                state.user.email ||
                "Student",

            photo_url:
                state.user.user_metadata?.avatar_url ||
                state.user.user_metadata?.photo_url ||
                ""
        };

    updateProfileUI();
}

function getProfileName(profile) {

    return (
        profile?.full_name ||
        profile?.name ||
        profile?.student_name ||
        "Student"
    );
}

function getProfilePhoto(profile) {

    return (
        profile?.photo_url ||
        profile?.avatar_url ||
        profile?.profile_image ||
        ""
    );
}

function updateProfileUI() {

    const profile =
        state.profile;

    const name =
        getProfileName(profile);

    const photo =
        getProfilePhoto(profile);

    const nameElements = [
        "#sidebarProfileName",
        "#profileName",
        "#currentUserName"
    ];

    nameElements.forEach(
        selector => {

            const element =
                $(selector);

            if (element) {
                element.textContent =
                    name;
            }
        }
    );

    const avatarElements = [
        "#sidebarProfileAvatar",
        "#railProfileAvatar",
        "#profileAvatar",
        "#headerProfileAvatar"
    ];

    avatarElements.forEach(
        avatar => {

            const element =
                typeof avatar === "string"
                    ? $(avatar)
                    : avatar;

            if (!element) {
                return;
            }

            if (photo) {

                if (
                    element.tagName
                        .toLowerCase() ===
                    "img"
                ) {

                    element.src =
                        safeUrl(photo);

                } else {

                    element.style.backgroundImage =
                        `url("${safeUrl(photo)}")`;
                }

            } else {

                if (
                    element.tagName
                        .toLowerCase() ===
                    "img"
                ) {

                    element.removeAttribute(
                        "src"
                    );

                    element.alt =
                        getInitials(name);

                } else {

                    element.textContent =
                        getInitials(name);
                }
            }
        }
    );
}

/* =========================================================
   COMMUNITIES
   ========================================================= */

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

        showToast(
            "Could not load communities."
        );

        return;
    }

    state.communities =
        data || [];

    if (!state.communities.length) {

        showToast(
            "No active communities found."
        );

        return;
    }

    let selected = null;

    const savedId =
        localStorage.getItem(
            CONFIG.selectedCommunityKey
        );

    /*
       Priority:
       1. Previously selected community
       2. Mwaniki Scholars default
       3. First community
    */

    if (savedId) {

        selected =
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    String(savedId)
            );
    }

    if (!selected) {

        selected =
            state.communities.find(
                community =>
                    String(
                        community.id
                    ) ===
                    CONFIG.defaultCommunityId
            );
    }

    if (!selected) {

        selected =
            state.communities.find(
                community =>
                    String(
                        community.name
                    ).toLowerCase() ===
                    CONFIG.defaultCommunityName
                        .toLowerCase()
            );
    }

    if (!selected) {
        selected =
            state.communities[0];
    }

    renderCommunityRail();

    renderCommunityModal();

    await selectCommunity(
        selected,
        false
    );
}

async function selectCommunity(
    community,
    save = true
) {

    if (!community) {
        return;
    }

    state.selectedCommunity =
        community;

    if (save) {

        try {

            localStorage.setItem(
                CONFIG.selectedCommunityKey,
                String(community.id)
            );

        } catch (_) {}
    }

    updateSelectedCommunityUI();

    renderCommunityRail();

    renderCommunityModal();

    await loadChannels();
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

    const brand =
        $("#communityBrandTitle");

    if (icon) {

        if (community.icon_url) {

            icon.innerHTML = `
                <img
                    src="${escapeHtml(
                        safeUrl(
                            community.icon_url
                        )
                    )}"
                    alt=""
                >
            `;

        } else {

            icon.textContent =
                getCommunityIcon(
                    community
                );
        }
    }

    if (name) {
        name.textContent =
            community.name;
    }

    if (description) {

        description.textContent =
            community.description ||
            "Academic Community";
    }

    if (brand) {
        brand.textContent =
            community.name;
    }
}

/* =========================================================
   COMMUNITY RAIL
   ========================================================= */

function renderCommunityRail() {

    const container =
        $("#communityRailList");

    if (!container) {
        return;
    }

    container.innerHTML =
        state.communities
            .map(
                community => {

                    const active =
                        String(
                            community.id
                        ) ===
                        String(
                            state.selectedCommunity?.id
                        );

                    const icon =
                        community.icon_url
                            ? `
                                <img
                                    src="${escapeHtml(
                                        safeUrl(
                                            community.icon_url
                                        )
                                    )}"
                                    alt=""
                                >
                              `
                            :
                              escapeHtml(
                                  getCommunityIcon(
                                      community
                                  )
                              );

                    return `
                        <button
                            type="button"
                            class="community-rail-item ${
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
                            ${icon}
                        </button>
                    `;
                }
            )
            .join("");

    $$("#communityRailList [data-community-id]")
        .forEach(
            button => {

                button.onclick =
                    async () => {

                        const community =
                            state.communities.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset
                                            .communityId
                                    )
                            );

                        if (!community) {
                            return;
                        }

                        await selectCommunity(
                            community
                        );
                    };
            }
        );
}

/* =========================================================
   COMMUNITY MODAL
   ========================================================= */

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

                return (
                    String(
                        community.name || ""
                    )
                        .toLowerCase()
                        .includes(term) ||

                    String(
                        community.description || ""
                    )
                        .toLowerCase()
                        .includes(term)
                );
            }
        );

    if (!communities.length) {

        container.innerHTML = `
            <div class="message-empty-state">
                <div class="empty-icon">🔎</div>
                <h2>No communities found</h2>
            </div>
        `;

        return;
    }

    container.innerHTML =
        communities
            .map(
                community => {

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

                                ${
                                    community.icon_url
                                        ? `
                                            <img
                                                src="${escapeHtml(
                                                    safeUrl(
                                                        community.icon_url
                                                    )
                                                )}"
                                                alt=""
                                            >
                                          `
                                        :
                                          escapeHtml(
                                              getCommunityIcon(
                                                  community
                                              )
                                          )
                                }

                            </div>

                            <div class="community-choice-info">

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

                            </div>

                        </button>
                    `;
                }
            )
            .join("");

    $$("#communityChoiceList [data-community-id]")
        .forEach(
            button => {

                button.onclick =
                    async () => {

                        const community =
                            state.communities.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset
                                            .communityId
                                    )
                            );

                        if (!community) {
                            return;
                        }

                        await selectCommunity(
                            community
                        );

                        closeCommunityModal();
                    };
            }
        );
}

function openCommunityModal() {

    const modal =
        $("#communityModal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );

    renderCommunityModal();

    $("#communityModalSearch")
        ?.focus();
}

function closeCommunityModal() {

    $("#communityModal")
        ?.classList.add(
            "hidden"
        );
}

/* =========================================================
   CHANNELS
   ========================================================= */

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
                created_at
            `)
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
            .eq(
                "is_private",
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

        showToast(
            "Could not load channels."
        );

        return;
    }

    state.channels =
        data || [];

    renderChannels();

    const storageKey =
        CONFIG.selectedChannelPrefix +
        state.selectedCommunity.id;

    let savedId = null;

    try {

        savedId =
            localStorage.getItem(
                storageKey
            );

    } catch (_) {}

    let selected =
        state.channels.find(
            channel =>
                String(
                    channel.id
                ) ===
                String(savedId)
        );

    if (!selected) {

        selected =
            state.channels.find(
                channel =>
                    channel.slug ===
                    "general-chat" ||
                    String(
                        channel.name || ""
                    ).toLowerCase() ===
                    "general"
            );
    }

    if (!selected) {
        selected =
            state.channels[0];
    }

    if (selected) {

        await selectChannel(
            selected,
            false
        );

    } else {

        state.selectedChannel =
            null;

        state.messages = [];

        renderMessages();
    }
}

function renderChannels(
    search = ""
) {

    const container =
        $("#channelList");

    if (!container) {
        return;
    }

    const term =
        String(search)
            .trim()
            .toLowerCase();

    const channels =
        state.channels.filter(
            channel => {

                if (!term) {
                    return true;
                }

                return (
                    String(
                        channel.name || ""
                    )
                        .toLowerCase()
                        .includes(term) ||

                    String(
                        channel.description || ""
                    )
                        .toLowerCase()
                        .includes(term)
                );
            }
        );

    if (!channels.length) {

        container.innerHTML = `
            <div class="channel-empty">
                No channels found.
            </div>
        `;

        return;
    }

    container.innerHTML =
        channels
            .map(
                channel => {

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
                            class="channel-button ${
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
                                    channel.name
                                )}
                            </span>

                        </button>
                    `;
                }
            )
            .join("");

    $$("#channelList [data-channel-id]")
        .forEach(
            button => {

                button.onclick =
                    async () => {

                        const channel =
                            state.channels.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset
                                            .channelId
                                    )
                            );

                        if (!channel) {
                            return;
                        }

                        await selectChannel(
                            channel
                        );
                    };
            }
        );
}

async function selectChannel(
    channel,
    save = true
) {

    if (!channel) {
        return;
    }

    unsubscribeRealtime();

    state.selectedChannel =
        channel;

    state.messages = [];

    state.reactions = [];

    state.attachments = [];

    state.messageOffset = 0;

    state.hasMoreMessages =
        false;

    if (
        save &&
        state.selectedCommunity
    ) {

        try {

            localStorage.setItem(
                CONFIG.selectedChannelPrefix +
                    state.selectedCommunity.id,
                String(channel.id)
            );

        } catch (_) {}
    }

    renderChannels();

    updateChannelHeader();

    await loadMessages();

    subscribeToMessages();
}

function updateChannelHeader() {

    const channel =
        state.selectedChannel;

    if (!channel) {
        return;
    }

    const icon =
        $("#mainChannelIcon");

    const title =
        $("#mainChannelTitle");

    const description =
        $("#mainChannelDescription");

    if (icon) {
        icon.textContent =
            getChannelIcon(channel);
    }

    if (title) {
        title.textContent =
            channel.name;
    }

    if (description) {

        description.textContent =
            channel.description ||
            `Discussion in ${channel.name}`;
    }

    const activeName =
        $("#activeChannelName");

    const activeDescription =
        $("#activeChannelDescription");

    if (activeName) {
        activeName.textContent =
            channel.name;
    }

    if (activeDescription) {

        activeDescription.textContent =
            channel.description ||
            `Discussion in ${channel.name}`;
    }
}

/* =========================================================
   MESSAGES
   ========================================================= */

async function loadMessages(
    older = false
) {

    if (!state.selectedChannel) {
        return;
    }

    let from;
    let to;

    if (older) {

        from =
            state.messageOffset;

        to =
            state.messageOffset +
            CONFIG.messagePageSize -
            1;

    } else {

        from = 0;

        to =
            CONFIG.messagePageSize -
            1;
    }

    const {
        data,
        error
    } =
        await supabase
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
                state.selectedChannel.id
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
            "Message loading error:",
            error
        );

        showToast(
            "Could not load messages."
        );

        return;
    }

    const messages =
        (data || []).reverse();

    if (older) {

        state.messages = [
            ...messages,
            ...state.messages
        ];

    } else {

        state.messages =
            messages;

        state.messageOffset = 0;
    }

    state.messageOffset +=
        messages.length;

    state.hasMoreMessages =
        messages.length ===
        CONFIG.messagePageSize;

    await loadMessageRelatedData();

    await loadPublicProfiles();

    renderMessages();

    if (!older) {
        scrollMessagesToBottom();
    }
}

async function loadMessageRelatedData() {

    if (!state.messages.length) {

        state.reactions = [];

        state.attachments = [];

        return;
    }

    const ids =
        state.messages
            .map(
                message =>
                    message.id
            )
            .filter(Boolean);

    const [
        reactionsResult,
        attachmentsResult
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

    if (
        !reactionsResult.error
    ) {

        state.reactions =
            reactionsResult.data || [];

    } else {

        console.warn(
            "Reaction loading:",
            reactionsResult.error
        );

        state.reactions = [];
    }

    if (
        !attachmentsResult.error
    ) {

        state.attachments =
            attachmentsResult.data || [];

    } else {

        console.warn(
            "Attachment loading:",
            attachmentsResult.error
        );

        state.attachments = [];
    }
}

/* =========================================================
   PROFILE LOOKUP
   ========================================================= */

async function loadPublicProfiles() {

    const ids =
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

    const missing =
        ids.filter(
            id =>
                id !== state.user?.id &&
                !state.publicProfiles.has(id)
        );

    if (!missing.length) {
        return;
    }

    /*
       chat_public_profiles is preferred because the
       community should not need to expose the full
       students table to every user.
    */

    const result =
        await supabase
            .from("chat_public_profiles")
            .select(`
                id,
                full_name,
                photo_url
            `)
            .in(
                "id",
                missing
            );

    if (
        !result.error &&
        result.data
    ) {

        result.data.forEach(
            profile => {

                state.publicProfiles.set(
                    profile.id,
                    profile
                );
            }
        );
    }
}

function getMessageProfile(
    userId
) {

    if (
        userId ===
        state.user?.id
    ) {
        return state.profile;
    }

    return state.publicProfiles.get(
        userId
    );
}

/* =========================================================
   REACTIONS
   ========================================================= */

function getMessageReactions(
    messageId
) {

    return state.reactions.filter(
        reaction =>
            String(
                reaction.message_id
            ) ===
            String(messageId)
    );
}

function getReactionCounts(
    reactions
) {

    return reactions.reduce(
        (
            result,
            reaction
        ) => {

            const value =
                reaction.reaction ||
                "👍";

            result[value] =
                (
                    result[value] ||
                    0
                ) + 1;

            return result;
        },
        {}
    );
}

async function toggleReaction(
    messageId,
    reaction = "👍"
) {

    if (!state.user) {
        showToast(
            "Please sign in first."
        );
        return;
    }

    const existing =
        state.reactions.find(
            item =>
                String(
                    item.message_id
                ) ===
                String(messageId) &&
                item.user_id ===
                state.user.id &&
                item.reaction ===
                reaction
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
                "Reaction delete:",
                error
            );

            showToast(
                "Could not remove reaction."
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
                "Reaction insert:",
                error
            );

            showToast(
                "Could not add reaction."
            );

            return;
        }
    }

    await loadMessageRelatedData();

    renderMessages();
}

/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function renderMessages() {

    const list =
        $("#messageList");

    const empty =
        $("#messageEmptyState");

    const olderButton =
        $("#loadOlderMessagesButton");

    if (!list) {
        return;
    }

    if (!state.messages.length) {

        list.innerHTML = "";

        empty?.classList.remove(
            "hidden"
        );

        olderButton?.classList.add(
            "hidden"
        );

        return;
    }

    empty?.classList.add(
        "hidden"
    );

    olderButton?.classList.toggle(
        "hidden",
        !state.hasMoreMessages
    );

    list.innerHTML =
        state.messages
            .map(
                message =>
                    renderMessage(
                        message
                    )
            )
            .join("");

    attachMessageHandlers();
}

function renderMessage(
    message
) {

    const own =
        message.user_id ===
        state.user?.id;

    const deleted =
        Boolean(
            message.is_deleted
        );

    const profile =
        getMessageProfile(
            message.user_id
        );

    const author =
        getProfileName(
            profile
        );

    const photo =
        getProfilePhoto(
            profile
        );

    const reactions =
        getMessageReactions(
            message.id
        );

    const attachments =
        state.attachments.filter(
            attachment =>
                String(
                    attachment.message_id
                ) ===
                String(message.id)
        );

    const reactionCounts =
        getReactionCounts(
            reactions
        );

    return `
        <article
            class="message ${
                own ? "own-message" : ""
            } ${
                deleted ? "deleted" : ""
            }"
            data-message-id="${escapeHtml(
                message.id
            )}"
        >

            <div class="message-avatar-wrap">

                ${
                    photo
                        ? `
                            <img
                                class="message-avatar"
                                src="${escapeHtml(
                                    safeUrl(
                                        photo
                                    )
                                )}"
                                alt=""
                                loading="lazy"
                            >
                          `
                        : `
                            <div
                                class="message-avatar message-avatar-fallback"
                                aria-hidden="true"
                            >
                                ${escapeHtml(
                                    getInitials(
                                        author
                                    )
                                )}
                            </div>
                          `
                }

            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong class="message-author">
                        ${escapeHtml(
                            author
                        )}
                    </strong>

                    <span class="message-time">
                        ${formatDate(
                            message.created_at
                        )}
                        ·
                        ${formatTime(
                            message.created_at
                        )}
                    </span>

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

                <div class="message-content">

                    ${
                        deleted
                            ? `
                                <span class="deleted-message">
                                    This message was deleted.
                                </span>
                              `
                            :
                              renderMessageContent(
                                  message
                              )
                    }

                </div>

                ${
                    !deleted
                        ? renderAttachments(
                            attachments
                        )
                        : ""
                }

                ${
                    !deleted &&
                    Object.keys(
                        reactionCounts
                    ).length
                        ? `
                            <div class="reaction-list">

                                ${Object.entries(
                                    reactionCounts
                                )
                                    .map(
                                        ([
                                            reaction,
                                            count
                                        ]) => `
                                            <button
                                                type="button"
                                                class="reaction"
                                                data-reaction="${escapeHtml(
                                                    reaction
                                                )}"
                                                title="React with ${escapeHtml(
                                                    reaction
                                                )}"
                                            >
                                                ${escapeHtml(
                                                    reaction
                                                )}
                                                ${count}
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
                            <div class="message-actions">

                                <button
                                    type="button"
                                    class="message-action"
                                    data-action="react"
                                >
                                    😊
                                </button>

                                ${
                                    own
                                        ? `
                                            <button
                                                type="button"
                                                class="message-action danger"
                                                data-action="delete"
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

    const content =
        String(
            message.content || ""
        );

    if (
        message.message_type ===
        "gif"
    ) {

        const url =
            safeUrl(content);

        if (url === "#") {
            return "";
        }

        return `
            <img
                class="message-gif"
                src="${escapeHtml(url)}"
                alt="GIF"
                loading="lazy"
            >
        `;
    }

    return escapeHtml(
        content
    );
}

function renderAttachments(
    attachments
) {

    if (!attachments.length) {
        return "";
    }

    return attachments
        .map(
            attachment => {

                const url =
                    safeUrl(
                        attachment.file_url
                    );

                const mime =
                    String(
                        attachment.mime_type ||
                        ""
                    );

                if (
                    mime.startsWith(
                        "image/"
                    )
                ) {

                    return `
                        <div class="message-attachment image-attachment">

                            <a
                                href="${escapeHtml(
                                    url
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >

                                <img
                                    class="message-image"
                                    src="${escapeHtml(
                                        url
                                    )}"
                                    alt="${escapeHtml(
                                        attachment.file_name
                                    )}"
                                    loading="lazy"
                                >

                            </a>

                        </div>
                    `;
                }

                if (
                    mime.startsWith(
                        "audio/"
                    )
                ) {

                    return `
                        <div class="message-attachment audio-attachment">

                            <audio
                                controls
                                preload="metadata"
                                src="${escapeHtml(
                                    url
                                )}"
                            ></audio>

                        </div>
                    `;
                }

                return `
                    <div class="message-attachment file-attachment">

                        <a
                            class="message-file"
                            href="${escapeHtml(
                                url
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
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
                                    ${formatFileSize(
                                        attachment.file_size
                                    )}
                                </small>

                            </span>

                        </a>

                    </div>
                `;
            }
        )
        .join("");
}

/* =========================================================
   MESSAGE HANDLERS
   ========================================================= */

function attachMessageHandlers() {

    $$("#messageList [data-action='delete']")
        .forEach(
            button => {

                button.onclick =
                    async event => {

                        event.preventDefault();

                        const messageElement =
                            event.target.closest(
                                "[data-message-id]"
                            );

                        if (!messageElement) {
                            return;
                        }

                        await deleteMessage(
                            messageElement.dataset
                                .messageId
                        );
                    };
            }
        );

    $$("#messageList [data-action='react']")
        .forEach(
            button => {

                button.onclick =
                    async event => {

                        event.preventDefault();

                        const messageElement =
                            event.target.closest(
                                "[data-message-id]"
                            );

                        if (!messageElement) {
                            return;
                        }

                        await toggleReaction(
                            messageElement.dataset
                                .messageId,
                            "👍"
                        );
                    };
            }
        );

    $$("#messageList .reaction")
        .forEach(
            button => {

                button.onclick =
                    async event => {

                        event.preventDefault();

                        const messageElement =
                            event.target.closest(
                                "[data-message-id]"
                            );

                        if (!messageElement) {
                            return;
                        }

                        await toggleReaction(
                            messageElement.dataset
                                .messageId,
                            button.dataset
                                .reaction
                        );
                    };
            }
        );
}

/* =========================================================
   DELETE MESSAGE
   ========================================================= */

async function deleteMessage(
    messageId
) {

    if (!state.user) {
        showToast(
            "Please sign in first."
        );
        return;
    }

    const message =
        state.messages.find(
            item =>
                String(
                    item.id
                ) ===
                String(messageId)
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

    const {
        error
    } =
        await supabase
            .from("chat_messages")
            .update({
                is_deleted: true,

                deleted_at:
                    new Date()
                        .toISOString(),

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
            "Delete message error:",
            error
        );

        showToast(
            "Could not delete message."
        );

        return;
    }

    const index =
        state.messages.findIndex(
            item =>
                String(
                    item.id
                ) ===
                String(messageId)
        );

    if (index >= 0) {

        state.messages[index] = {
            ...state.messages[index],

            is_deleted: true,

            content: "",

            deleted_at:
                new Date()
                    .toISOString()
        };
    }

    renderMessages();

    showToast(
        "Message deleted."
    );
}

/* =========================================================
   SEND TEXT
   ========================================================= */

async function sendTextMessage() {

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

    if (!state.user) {

        showToast(
            "Please sign in first."
        );

        return;
    }

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first."
        );

        return;
    }

    const button =
        $("#sendMessageButton");

    if (button) {
        button.disabled = true;
    }

    const payload = {
        channel_id:
            state.selectedChannel.id,

        user_id:
            state.user.id,

        content,

        message_type:
            "text"
    };

    /*
       parent_message_id is used for replies.
       It is included only when a reply is active.
    */

    if (
        state.replyToMessage?.id
    ) {

        payload.parent_message_id =
            state.replyToMessage.id;
    }

    const {
        data,
        error
    } =
        await supabase
            .from("chat_messages")
            .insert(payload)
            .select()
            .single();

    if (button) {
        button.disabled = false;
    }

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

    input.value = "";

    autoResizeTextarea();

    clearReply();

    if (data) {

        const exists =
            state.messages.some(
                message =>
                    String(
                        message.id
                    ) ===
                    String(data.id)
            );

        if (!exists) {
            state.messages.push(
                data
            );
        }
    }

    renderMessages();

    scrollMessagesToBottom();

    input.focus();
}

/* =========================================================
   REPLY SUPPORT
   ========================================================= */

function setReplyMessage(
    messageId
) {

    const message =
        state.messages.find(
            item =>
                String(
                    item.id
                ) ===
                String(messageId)
        );

    if (!message) {
        return;
    }

    state.replyToMessage =
        message;

    const preview =
        $("#replyPreview");

    if (!preview) {
        return;
    }

    preview.classList.remove(
        "hidden"
    );

    preview.innerHTML = `
        <div class="reply-preview-content">

            <strong>
                Replying to
            </strong>

            <span>
                ${escapeHtml(
                    message.content ||
                    "Attachment"
                )}
            </span>

        </div>

        <button
            type="button"
            id="cancelReplyButton"
            aria-label="Cancel reply"
        >
            ×
        </button>
    `;

    $("#cancelReplyButton")
        ?.addEventListener(
            "click",
            clearReply
        );
}

function clearReply() {

    state.replyToMessage =
        null;

    const preview =
        $("#replyPreview");

    if (!preview) {
        return;
    }

    preview.classList.add(
        "hidden"
    );

    preview.innerHTML =
        "";
}

/* =========================================================
   FILE ATTACHMENTS
   ========================================================= */

async function uploadFile(
    file
) {

    if (!file) {
        return;
    }

    if (!state.user) {

        showToast(
            "Please sign in first."
        );

        return;
    }

    if (!state.selectedChannel) {

        showToast(
            "Select a channel first."
        );

        return;
    }

    if (
        file.size >
        CONFIG.maxFileSize
    ) {

        showToast(
            "File is larger than 50 MB."
        );

        return;
    }

    const isImage =
        String(
            file.type || ""
        ).startsWith(
            "image/"
        );

    const folder =
        isImage
            ? "images"
            : "documents";

    const safeName =
        file.name
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

    const path =
        `${state.user.id}/${folder}/${Date.now()}_${safeName}`;

    showToast(
        `Uploading ${file.name}...`
    );

    const {
        error: uploadError
    } =
        await supabase.storage
            .from(
                CONFIG.storageBucket
            )
            .upload(
                path,
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
            "Storage upload error:",
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
        supabase.storage
            .from(
                CONFIG.storageBucket
            )
            .getPublicUrl(
                path
            );

    const fileUrl =
        publicData?.publicUrl;

    if (!fileUrl) {

        showToast(
            "Could not create file URL."
        );

        return;
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
                    isImage
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

        showToast(
            "File uploaded but message creation failed."
        );

        return;
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

        console.error(
            "Attachment database error:",
            attachmentError
        );

        showToast(
            "File uploaded but attachment record failed."
        );

        return;
    }

    if (message) {

        state.messages.push(
            message
        );
    }

    await loadMessageRelatedData();

    renderMessages();

    scrollMessagesToBottom();

    showToast(
        "File sent successfully."
    );
}

/* =========================================================
   GIF
   ========================================================= */

function openGifPicker() {

    closeEmojiPicker();

    const picker =
        $("#gifPicker");

    if (!picker) {
        return;
    }

    picker.classList.remove(
        "hidden"
    );
}

function closeGifPicker() {

    const picker =
        $("#gifPicker");

    picker?.classList.add(
        "hidden"
    );

    state.gifUrl =
        "";

    const input =
        $("#gifUrlInput");

    const preview =
        $("#gifPreview");

    const sendButton =
        $("#sendGifButton");

    if (input) {
        input.value = "";
    }

    if (preview) {
        preview.innerHTML =
            "";
    }

    if (sendButton) {
        sendButton.disabled =
            true;
    }
}

function previewGif() {

    const input =
        $("#gifUrlInput");

    const preview =
        $("#gifPreview");

    const button =
        $("#sendGifButton");

    if (!input || !preview || !button) {
        return;
    }

    const url =
        input.value.trim();

    if (!url) {

        preview.innerHTML =
            "<p>Enter a GIF URL.</p>";

        button.disabled = true;

        return;
    }

    const safe =
        safeUrl(url);

    if (safe === "#") {

        preview.innerHTML =
            "<p>Invalid URL.</p>";

        button.disabled = true;

        return;
    }

    preview.innerHTML = `
        <img
            src="${escapeHtml(safe)}"
            alt="GIF preview"
        >
    `;

    const image =
        preview.querySelector(
            "img"
        );

    image.onerror =
        () => {

            state.gifUrl =
                "";

            preview.innerHTML =
                "<p>Could not load this image.</p>";

            button.disabled =
                true;
        };

    image.onload =
        () => {

            state.gifUrl =
                safe;

            button.disabled =
                false;
        };
}

async function sendGif() {

    if (!state.gifUrl) {
        return;
    }

    if (!state.user) {
        showToast(
            "Please sign in first."
        );
        return;
    }

    if (!state.selectedChannel) {
        showToast(
            "Select a channel first."
        );
        return;
    }

    const {
        data,
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
                    state.gifUrl,

                message_type:
                    "gif"
            })
            .select()
            .single();

    if (error) {

        console.error(
            "GIF send error:",
            error
        );

        showToast(
            "Could not send GIF."
        );

        return;
    }

    if (data) {
        state.messages.push(
            data
        );
    }

    closeGifPicker();

    renderMessages();

    scrollMessagesToBottom();
}

/* =========================================================
   EMOJI
   ========================================================= */

function openEmojiPicker() {

    closeGifPicker();

    const picker =
        $("#emojiPicker");

    const button =
        $("#emojiButton");

    if (!picker) {
        return;
    }

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
        $("#emojiPicker");

    const button =
        $("#emojiButton");

    picker?.classList.add(
        "hidden"
    );

    button?.setAttribute(
        "aria-expanded",
        "false"
    );
}

function insertEmoji(
    emoji
) {

    const input =
        $("#messageInput");

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

    autoResizeTextarea();
}

/* =========================================================
   VOICE NOTES
   ========================================================= */

function getSupportedRecordingType() {

    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4"
    ];

    for (
        const type of types
    ) {

        if (
            typeof MediaRecorder !==
                "undefined" &&
            MediaRecorder.isTypeSupported(
                type
            )
        ) {
            return type;
        }
    }

    return "";
}

async function startVoiceRecording() {

    if (
        typeof MediaRecorder ===
        "undefined"
    ) {

        showToast(
            "Voice recording is not supported by this browser."
        );

        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showToast(
            "Microphone access is not supported."
        );

        return;
    }

    if (state.mediaRecorder) {

        showToast(
            "A voice recording is already active."
        );

        return;
    }

    try {

        state.mediaStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });

        state.recordingChunks =
            [];

        state.recordingMimeType =
            getSupportedRecordingType();

        state.mediaRecorder =
            state.recordingMimeType
                ? new MediaRecorder(
                    state.mediaStream,
                    {
                        mimeType:
                            state.recordingMimeType
                    }
                  )
                : new MediaRecorder(
                    state.mediaStream
                  );

        state.mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    state.recordingChunks.push(
                        event.data
                    );
                }
            };

        state.mediaRecorder.onerror =
            event => {

                console.error(
                    "MediaRecorder error:",
                    event
                );

                showToast(
                    "Voice recording failed."
                );

                cleanupRecording();
            };

        state.mediaRecorder.onstop =
            uploadVoiceRecording;

        state.mediaRecorder.start();

        state.recordingStartedAt =
            Date.now();

        $("#voiceRecorderBar")
            ?.classList.remove(
                "hidden"
            );

        $("#voiceUploadStatus")
            ?.classList.add(
                "hidden"
            );

        updateRecordingTimer();

        state.recordingTimer =
            setInterval(
                updateRecordingTimer,
                1000
            );

        showToast(
            "Recording started."
        );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        cleanupRecording();

        showToast(
            "Microphone permission was not granted."
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

    const minutes =
        String(
            Math.floor(
                seconds / 60
            )
        ).padStart(
            2,
            "0"
        );

    const remainder =
        String(
            seconds % 60
        ).padStart(
            2,
            "0"
        );

    const timer =
        $("#voiceRecorderTimer");

    if (timer) {
        timer.textContent =
            `${minutes}:${remainder}`;
    }
}

function stopVoiceRecording() {

    clearInterval(
        state.recordingTimer
    );

    state.recordingTimer =
        null;

    if (
        state.mediaRecorder &&
        state.mediaRecorder.state !==
            "inactive"
    ) {

        state.mediaRecorder.stop();

    } else {

        cleanupRecording();
    }
}

function cancelVoiceRecording() {

    clearInterval(
        state.recordingTimer
    );

    state.recordingTimer =
        null;

    if (
        state.mediaRecorder &&
        state.mediaRecorder.state !==
            "inactive"
    ) {

        state.mediaRecorder.onstop =
            () => {

                cleanupRecording();
            };

        state.mediaRecorder.stop();

    } else {

        cleanupRecording();
    }

    showToast(
        "Recording cancelled."
    );
}

function cleanupRecording() {

    clearInterval(
        state.recordingTimer
    );

    state.recordingTimer =
        null;

    if (state.mediaStream) {

        state.mediaStream
            .getTracks()
            .forEach(
                track => {
                    track.stop();
                }
            );
    }

    state.mediaStream =
        null;

    state.mediaRecorder =
        null;

    state.recordingChunks =
        [];

    state.recordingStartedAt =
        null;

    state.recordingMimeType =
        "";

    $("#voiceRecorderBar")
        ?.classList.add(
            "hidden"
        );
}

async function uploadVoiceRecording() {

    const chunks =
        state.recordingChunks;

    if (!chunks.length) {

        cleanupRecording();

        return;
    }

    const mimeType =
        state.recordingMimeType ||
        "audio/webm";

    const blob =
        new Blob(
            chunks,
            {
                type: mimeType
            }
        );

    if (
        !state.user ||
        !state.selectedChannel
    ) {

        cleanupRecording();

        return;
    }

    const extension =
        mimeType.includes(
            "mp4"
        )
            ? "m4a"
            : mimeType.includes(
                "ogg"
              )
                ? "ogg"
                : "webm";

    const path =
        `${state.user.id}/voice-notes/${Date.now()}.${extension}`;

    const status =
        $("#voiceUploadStatus");

    status?.classList.remove(
        "hidden"
    );

    if (status) {
        status.textContent =
            "Uploading voice note...";
    }

    const {
        error: uploadError
    } =
        await supabase.storage
            .from(
                CONFIG.storageBucket
            )
            .upload(
                path,
                blob,
                {
                    contentType:
                        mimeType,

                    upsert: false
                }
            );

    if (uploadError) {

        console.error(
            "Voice upload error:",
            uploadError
        );

        if (status) {
            status.textContent =
                "Voice upload failed.";
        }

        cleanupRecording();

        return;
    }

    const {
        data: publicData
    } =
        supabase.storage
            .from(
                CONFIG.storageBucket
            )
            .getPublicUrl(
                path
            );

    const fileUrl =
        publicData?.publicUrl;

    if (!fileUrl) {

        cleanupRecording();

        return;
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
                    "Voice note",

                message_type:
                    "voice"
            })
            .select()
            .single();

    if (messageError) {

        console.error(
            "Voice message error:",
            messageError
        );

        if (status) {
            status.textContent =
                "Voice message failed.";
        }

        cleanupRecording();

        return;
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
                    `voice-note-${Date.now()}.${extension}`,

                file_path:
                    path,

                file_url:
                    fileUrl,

                mime_type:
                    mimeType,

                file_size:
                    blob.size
            });

    if (attachmentError) {

        console.error(
            "Voice attachment error:",
            attachmentError
        );
    }

    if (message) {
        state.messages.push(
            message
        );
    }

    await loadMessageRelatedData();

    renderMessages();

    scrollMessagesToBottom();

    if (status) {

        status.classList.remove(
            "hidden"
        );

        status.textContent =
            attachmentError
                ? "Voice note sent, but attachment record failed."
                : "Voice note sent.";

        setTimeout(
            () => {

                status.classList.add(
                    "hidden"
                );

            },
            1800
        );
    }

    cleanupRecording();
}

/* =========================================================
   TEXTAREA
   ========================================================= */

function autoResizeTextarea() {

    const textarea =
        $("#messageInput");

    if (!textarea) {
        return;
    }

    textarea.style.height =
        "auto";

    textarea.style.height =
        `${Math.min(
            textarea.scrollHeight,
            150
        )}px`;
}

function scrollMessagesToBottom() {

    const area =
        $("#messageArea");

    if (!area) {
        return;
    }

    requestAnimationFrame(
        () => {

            area.scrollTop =
                area.scrollHeight;
        }
    );
}

/* =========================================================
   REALTIME
   ========================================================= */

function unsubscribeRealtime() {

    if (
        state.realtimeMessages
    ) {

        supabase.removeChannel(
            state.realtimeMessages
        );

        state.realtimeMessages =
            null;
    }

    if (
        state.realtimeReactions
    ) {

        supabase.removeChannel(
            state.realtimeReactions
        );

        state.realtimeReactions =
            null;
    }

    if (
        state.realtimeAttachments
    ) {

        supabase.removeChannel(
            state.realtimeAttachments
        );

        state.realtimeAttachments =
            null;
    }
}

function subscribeToMessages() {

    unsubscribeRealtime();

    if (!state.selectedChannel) {
        return;
    }

    const channelId =
        state.selectedChannel.id;

    state.realtimeMessages =
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

                        const exists =
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload.new.id
                                    )
                            );

                        if (!exists) {

                            state.messages.push(
                                payload.new
                            );

                            state.messages.sort(
                                (
                                    a,
                                    b
                                ) =>
                                    new Date(
                                        a.created_at
                                    ) -
                                    new Date(
                                        b.created_at
                                    )
                            );

                            await loadMessageRelatedData();

                            await loadPublicProfiles();

                            renderMessages();

                            scrollMessagesToBottom();
                        }

                    } else if (
                        payload.eventType ===
                        "UPDATE"
                    ) {

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

                        if (index >= 0) {

                            state.messages[index] =
                                payload.new;

                        } else {

                            state.messages.push(
                                payload.new
                            );
                        }

                        await loadMessageRelatedData();

                        renderMessages();
                    }
                }
            )
            .subscribe(
                status => {

                    console.log(
                        "Community messages realtime:",
                        status
                    );
                }
            );

    state.realtimeReactions =
        supabase
            .channel(
                `community-reactions-${channelId}`
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

                    const affectedId =
                        payload.new?.message_id ||
                        payload.old?.message_id;

                    if (
                        affectedId &&
                        !state.messages.some(
                            message =>
                                String(
                                    message.id
                                ) ===
                                String(
                                    affectedId
                                )
                        )
                    ) {
                        return;
                    }

                    await loadMessageRelatedData();

                    renderMessages();
                }
            )
            .subscribe();

    state.realtimeAttachments =
        supabase
            .channel(
                `community-attachments-${channelId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "*",

                    schema: "public",

                    table:
                        "chat_attachments"
                },
                async payload => {

                    const affectedId =
                        payload.new?.message_id ||
                        payload.old?.message_id;

                    if (
                        affectedId &&
                        !state.messages.some(
                            message =>
                                String(
                                    message.id
                                ) ===
                                String(
                                    affectedId
                                )
                        )
                    ) {
                        return;
                    }

                    await loadMessageRelatedData();

                    renderMessages();
                }
            )
            .subscribe();
}

/* =========================================================
   GENERAL CALL BRIDGE
   ========================================================= */

function openGeneralCallModal() {

    const modal =
        $("#generalCallModal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );

    setCallMode(
        "voice"
    );

    $("#generalCallUserInput")
        ?.focus();
}

function closeGeneralCallModal() {

    $("#generalCallModal")
        ?.classList.add(
            "hidden"
        );
}

function setCallMode(
    mode
) {

    state.callMode =
        mode === "video"
            ? "video"
            : "voice";

    $("#generalVoiceCallButton")
        ?.classList.toggle(
            "active",
            state.callMode ===
                "voice"
        );

    $("#generalVideoCallButton")
        ?.classList.toggle(
            "active",
            state.callMode ===
                "video"
        );
}

function startGeneralCall() {

    if (!state.user) {

        showToast(
            "Please sign in first."
        );

        return;
    }

    const input =
        $("#generalCallUserInput");

    const message =
        $("#generalCallMessage");

    const targetUserId =
        input?.value.trim();

    if (!targetUserId) {

        if (message) {

            message.textContent =
                "Select or enter a user before starting the call.";
        }

        return;
    }

    if (
        targetUserId ===
        state.user.id
    ) {

        if (message) {

            message.textContent =
                "You cannot call yourself.";
        }

        return;
    }

    closeGeneralCallModal();

    /*
       call.js owns the actual call.

       community.js only dispatches the request.
    */

    window.dispatchEvent(
        new CustomEvent(
            "mwaniki:general-call",
            {
                detail: {
                    targetUserId,

                    mode:
                        state.callMode
                }
            }
        )
    );

    showToast(
        "Starting call..."
    );
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function goDashboard() {

    window.location.href =
        "./dashboard.html";
}

function openProfile() {

    window.location.href =
        "./profile.html";
}

/* =========================================================
   MODAL HELPERS
   ========================================================= */

function closeOnBackdrop(
    event,
    modalId,
    closeFunction
) {

    if (
        event.target &&
        event.target.id ===
        modalId
    ) {

        closeFunction();
    }
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function initializeEventListeners() {

    initializeRules();

    /* -----------------------------------------------------
       Community
       ----------------------------------------------------- */

    $("#openCommunityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("#headerCommunityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("#closeCommunityModal")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );

    $("#communityModal")
        ?.addEventListener(
            "click",
            event => {

                closeOnBackdrop(
                    event,
                    "communityModal",
                    closeCommunityModal
                );
            }
        );

    $("#communityModalSearch")
        ?.addEventListener(
            "input",
            event => {

                renderCommunityModal(
                    event.target.value
                );
            }
        );

    /* -----------------------------------------------------
       Channels
       ----------------------------------------------------- */

    $("#channelSearchInput")
        ?.addEventListener(
            "input",
            event => {

                renderChannels(
                    event.target.value
                );
            }
        );

    /* -----------------------------------------------------
       Navigation
       ----------------------------------------------------- */

    [
        "#dashboardButton",
        "#homeButton",
        "#railHomeButton"
    ]
        .forEach(
            selector => {

                $(selector)
                    ?.addEventListener(
                        "click",
                        goDashboard
                    );
            }
        );

    [
        "#railProfileButton",
        "#sidebarProfileButton",
        "#profileButton"
    ]
        .forEach(
            selector => {

                $(selector)
                    ?.addEventListener(
                        "click",
                        openProfile
                    );
            }
        );

    /* -----------------------------------------------------
       Welcome
       ----------------------------------------------------- */

    $("#welcomeStartButton")
        ?.addEventListener(
            "click",
            () => {

                $("#messageInput")
                    ?.focus();
            }
        );

    /* -----------------------------------------------------
       Message form
       ----------------------------------------------------- */

    $("#messageForm")
        ?.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await sendTextMessage();
            }
        );

    $("#sendMessageButton")
        ?.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await sendTextMessage();
            }
        );

    $("#messageInput")
        ?.addEventListener(
            "input",
            autoResizeTextarea
        );

    $("#messageInput")
        ?.addEventListener(
            "keydown",
            async event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    await sendTextMessage();
                }
            }
        );

    /* -----------------------------------------------------
       Older messages
       ----------------------------------------------------- */

    $("#loadOlderMessagesButton")
        ?.addEventListener(
            "click",
            async () => {

                await loadMessages(
                    true
                );
            }
        );

    /* -----------------------------------------------------
       Attachments
       ----------------------------------------------------- */

    $("#attachButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                $("#attachmentInput")
                    ?.click();
            }
        );

    $("#attachmentButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                $("#attachmentInput")
                    ?.click();
            }
        );

    $("#attachmentInput")
        ?.addEventListener(
            "change",
            async event => {

                const files =
                    Array.from(
                        event.target.files ||
                        []
                    );

                for (
                    const file of files
                ) {

                    await uploadFile(
                        file
                    );
                }

                event.target.value =
                    "";
            }
        );

    /* -----------------------------------------------------
       GIF
       ----------------------------------------------------- */

    $("#gifButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                openGifPicker();
            }
        );

    $("#closeGifButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeGifPicker();
            }
        );

    $("#previewGifButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                previewGif();
            }
        );

    $("#sendGifButton")
        ?.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await sendGif();
            }
        );

    /* -----------------------------------------------------
       Emoji
       ----------------------------------------------------- */

    $("#emojiButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();

                const picker =
                    $("#emojiPicker");

                if (
                    picker?.classList.contains(
                        "hidden"
                    )
                ) {

                    openEmojiPicker();

                } else {

                    closeEmojiPicker();
                }
            }
        );

    $("#closeEmojiButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();

                closeEmojiPicker();
            }
        );

    const emojiElement =
        document.querySelector(
            "emoji-picker"
        );

    emojiElement
        ?.addEventListener(
            "emoji-click",
            event => {

                const emoji =
                    event.detail?.unicode;

                if (emoji) {

                    insertEmoji(
                        emoji
                    );
                }
            }
        );

    /* -----------------------------------------------------
       Voice notes
       ----------------------------------------------------- */

    $("#voiceNoteButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                startVoiceRecording();
            }
        );

    $("#stopVoiceNoteButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                stopVoiceRecording();
            }
        );

    $("#cancelVoiceNoteButton")
        ?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                cancelVoiceRecording();
            }
        );

    /* -----------------------------------------------------
       General calls
       ----------------------------------------------------- */

    $("#generalCallButton")
        ?.addEventListener(
            "click",
            openGeneralCallModal
        );

    $("#closeGeneralCallModalButton")
        ?.addEventListener(
            "click",
            closeGeneralCallModal
        );

    $("#cancelGeneralCallButton")
        ?.addEventListener(
            "click",
            closeGeneralCallModal
        );

    $("#generalVoiceCallButton")
        ?.addEventListener(
            "click",
            () => {

                setCallMode(
                    "voice"
                );
            }
        );

    $("#generalVideoCallButton")
        ?.addEventListener(
            "click",
            () => {

                setCallMode(
                    "video"
                );
            }
        );

    $("#startGeneralCallButton")
        ?.addEventListener(
            "click",
            startGeneralCall
        );

    $("#generalCallModal")
        ?.addEventListener(
            "click",
            event => {

                closeOnBackdrop(
                    event,
                    "generalCallModal",
                    closeGeneralCallModal
                );
            }
        );

    /* -----------------------------------------------------
       Click outside pickers
       ----------------------------------------------------- */

    document.addEventListener(
        "click",
        event => {

            const emojiPicker =
                $("#emojiPicker");

            const emojiButton =
                $("#emojiButton");

            if (
                emojiPicker &&
                !emojiPicker.contains(
                    event.target
                ) &&
                !emojiButton?.contains(
                    event.target
                )
            ) {

                closeEmojiPicker();
            }

            const gifPicker =
                $("#gifPicker");

            const gifButton =
                $("#gifButton");

            if (
                gifPicker &&
                !gifPicker.contains(
                    event.target
                ) &&
                !gifButton?.contains(
                    event.target
                )
            ) {

                closeGifPicker();
            }
        }
    );

    /* -----------------------------------------------------
       Escape
       ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            closeEmojiPicker();

            closeGifPicker();

            closeCommunityModal();

            closeGeneralCallModal();

            clearReply();
        }
    );
}

/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function initializeAuthListener() {

    if (!supabase) {
        return;
    }

    supabase.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            console.log(
                `🔐 Community auth: ${event}`
            );

            if (
                session?.user
            ) {

                const changedUser =
                    state.user?.id !==
                    session.user.id;

                state.user =
                    session.user;

                if (changedUser) {

                    await loadProfile();

                    await loadCommunities();
                }

            } else {

                state.user =
                    null;

                state.profile =
                    null;

                unsubscribeRealtime();
            }
        }
    );
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeCommunity() {

    if (
        state.initialized
    ) {
        return;
    }

    state.initialized =
        true;

    console.log(
        "🚀 Initializing Mwaniki Scholars Community..."
    );

    if (!supabase) {

        showToast(
            "Supabase is unavailable."
        );

        return;
    }

    initializeEventListeners();

    initializeAuthListener();

    state.user =
        await getCurrentUser();

    if (!state.user) {

        console.warn(
            "⚠️ No authenticated user."
        );

        showToast(
            "Please sign in to use the community."
        );

        return;
    }

    await loadProfile();

    await loadCommunities();

    autoResizeTextarea();

    console.log(
        "✅ Mwaniki Scholars Community initialized."
    );
}

/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        unsubscribeRealtime();

        if (
            state.mediaRecorder &&
            state.mediaRecorder.state !==
                "inactive"
        ) {

            try {
                state.mediaRecorder.stop();
            } catch (_) {}
        }

        if (state.mediaStream) {

            state.mediaStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }
    }
);

/* =========================================================
   PUBLIC API
   ---------------------------------------------------------
   Useful for call.js and future community features.
   ========================================================= */

window.MwanikiCommunity = {

    getState() {
        return state;
    },

    getCurrentUser() {
        return state.user;
    },

    getSelectedCommunity() {
        return state.selectedCommunity;
    },

    getSelectedChannel() {
        return state.selectedChannel;
    },

    refreshMessages() {
        return loadMessages();
    },

    closeEmojiPicker,

    closeGifPicker,

    closeCommunityModal,

    closeGeneralCallModal
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
        initializeCommunity,
        {
            once: true
        }
    );

} else {

    initializeCommunity();
}

console.log(
    "🚀 Mwaniki Scholars Community engine loaded."
);
