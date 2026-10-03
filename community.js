/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   Version: Clean Community Engine
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
    console.error(
        "❌ Supabase client was not found."
    );
}


/* =========================================================
   CONSTANTS
   ========================================================= */

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

    selectedCommunity: null,

    selectedChannel: null,

    rulesAccepted: false,

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

    gifUrl: "",

    callMode: "voice"

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector) =>
    document.querySelector(selector);


const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));


/* =========================================================
   UTILITIES
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function safeUrl(url) {

    try {

        const parsed =
            new URL(String(url));

        if (
            parsed.protocol === "https:" ||
            parsed.protocol === "http:"
        ) {
            return parsed.href;
        }

    } catch (_) {}

    return "#";
}


function formatFileSize(bytes) {

    const value = Number(bytes || 0);

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


function formatTime(dateValue) {

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
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


function formatDate(dateValue) {

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
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
        String(name || "Student")
            .trim();

    if (!value) {
        return "MS";
    }

    return value
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
}


function announce(message) {

    const element =
        $("#accessibilityAnnouncer");

    if (element) {
        element.textContent = message;
    }
}


let toastTimer = null;


function showToast(message) {

    const toast =
        $("#communityToast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 2800);
}


function communityIcon(community) {

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


function channelIcon(channel) {

    if (channel?.icon) {
        return channel.icon;
    }

    return "#";
}


/* =========================================================
   RULES
   ========================================================= */

function getRulesAccepted() {

    try {

        return (
            localStorage.getItem(
                RULES_VERSION
            ) === "true"
        );

    } catch (error) {

        console.warn(
            "Could not read community rules:",
            error
        );

        return false;
    }
}


function setRulesAccepted() {

    try {

        localStorage.setItem(
            RULES_VERSION,
            "true"
        );

    } catch (error) {

        console.warn(
            "Could not save community rules:",
            error
        );
    }

    state.rulesAccepted = true;
}


function closeRulesGate() {

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

        console.warn(
            "⚠️ #rulesGate was not found."
        );

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

        console.error(
            "❌ Community rules controls are missing."
        );

        return;
    }


    button.disabled =
        !checkbox.checked;


    checkbox.onchange = () => {

        button.disabled =
            !checkbox.checked;

        if (message) {
            message.textContent = "";
        }

    };


    button.onclick = event => {

        event.preventDefault();

        if (!checkbox.checked) {

            if (message) {

                message.textContent =
                    "Please confirm that you have read and agree to the rules.";

            }

            return;
        }


        setRulesAccepted();

        closeRulesGate();

        announce(
            "Community rules accepted."
        );

        showToast(
            "Welcome to Mwaniki Scholars Community."
        );

    };


    console.log(
        "✅ Community rules connected."
    );
}


function initializeRules() {

    state.rulesAccepted =
        getRulesAccepted();

    if (state.rulesAccepted) {

        closeRulesGate();

        return;
    }

    showRulesGate();
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function getCurrentUser() {

    if (!supabase) {
        return null;
    }

    const {
        data,
        error
    } =
        await supabase.auth.getUser();

    if (error) {

        console.warn(
            "Auth user lookup failed:",
            error
        );

        return null;
    }

    return data?.user || null;
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {

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
            .eq("id", state.user.id)
            .maybeSingle();


    if (error) {

        console.warn(
            "Student profile lookup:",
            error
        );

        return;
    }


    state.profile =
        data || {
            id: state.user.id,
            full_name:
                state.user.email ||
                "Student"
        };


    updateProfileUI();
}


function updateProfileUI() {

    const profile =
        state.profile || {};

    const name =
        profile.full_name ||
        profile.name ||
        state.user?.email ||
        "Student";


    const photo =
        profile.photo_url ||
        profile.avatar_url ||
        profile.profile_image ||
        "";


    const sidebarName =
        $("#sidebarProfileName");

    if (sidebarName) {
        sidebarName.textContent =
            name;
    }


    const avatarElements = [
        $("#sidebarProfileAvatar"),
        $("#railProfileAvatar")
    ].filter(Boolean);


    for (const avatar of avatarElements) {

        if (photo) {

            avatar.src =
                safeUrl(photo);

        } else {

            avatar.removeAttribute("src");

            avatar.alt =
                getInitials(name);

            avatar.style.background =
                "#e8f7f5";
        }
    }
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
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });


    if (error) {

        console.error(
            "❌ Could not load communities:",
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


    const savedCommunityId =
        localStorage.getItem(
            "mwanikiSelectedCommunity"
        );


    let selected =
        state.communities.find(
            community =>
                community.id ===
                DEFAULT_DISCUSSION_ID
        );


    if (!selected) {

        selected =
            state.communities.find(
                community =>
                    community.name ===
                    DEFAULT_DISCUSSION_NAME
            );
    }


    if (!selected && savedCommunityId) {

        selected =
            state.communities.find(
                community =>
                    community.id ===
                    savedCommunityId
            );
    }


    if (!selected) {
        selected =
            state.communities[0];
    }


    await selectCommunity(
        selected,
        false
    );


    renderCommunityRail();

    renderCommunityModal();
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

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            community.id
        );
    }


    updateSelectedCommunityUI();

    await loadChannels();

    renderCommunityRail();
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

    const brandTitle =
        $("#communityBrandTitle");


    if (icon) {

        if (community.icon_url) {

            icon.innerHTML =
                `<img src="${escapeHtml(
                    safeUrl(community.icon_url)
                )}" alt="">`;

        } else {

            icon.textContent =
                communityIcon(community);
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


    if (brandTitle) {
        brandTitle.textContent =
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
            .map(community => {

                const active =
                    community.id ===
                    state.selectedCommunity?.id;

                return `
                    <button
                        type="button"
                        class="${active ? "active" : ""}"
                        data-community-id="${escapeHtml(
                            community.id
                        )}"
                        title="${escapeHtml(
                            community.name
                        )}"
                    >
                        ${
                            community.icon_url
                                ? `<img
                                    src="${escapeHtml(
                                        safeUrl(
                                            community.icon_url
                                        )
                                    )}"
                                    alt=""
                                    style="
                                        width:100%;
                                        height:100%;
                                        object-fit:cover;
                                        border-radius:12px;
                                    "
                                  >`
                                : communityIcon(community)
                        }
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
                                button.dataset.communityId
                        );

                    if (community) {

                        await selectCommunity(
                            community
                        );

                    }
                }
            );

        });
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
                    community.name
                        ?.toLowerCase()
                        .includes(term) ||
                    community.description
                        ?.toLowerCase()
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
            .map(community => {

                const active =
                    community.id ===
                    state.selectedCommunity?.id;

                return `
                    <button
                        type="button"
                        class="community-choice ${
                            active ? "active" : ""
                        }"
                        data-community-id="${escapeHtml(
                            community.id
                        )}"
                    >

                        <div class="community-choice-icon">
                            ${
                                community.icon_url
                                    ? `<img
                                        src="${escapeHtml(
                                            safeUrl(
                                                community.icon_url
                                            )
                                        )}"
                                        alt=""
                                        style="
                                            width:100%;
                                            height:100%;
                                            object-fit:cover;
                                            border-radius:11px;
                                        "
                                      >`
                                    : communityIcon(
                                        community
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
                                button.dataset.communityId
                        );

                    if (!community) {
                        return;
                    }


                    await selectCommunity(
                        community
                    );

                    closeCommunityModal();

                }
            );

        });
}


function openCommunityModal() {

    const modal =
        $("#communityModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("hidden");

    renderCommunityModal();

    $("#communityModalSearch")
        ?.focus();
}


function closeCommunityModal() {

    $("#communityModal")
        ?.classList.add("hidden");
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
            .eq("is_active", true)
            .eq("is_archived", false)
            .eq("is_private", false)
            .order("position", {
                ascending: true
            })
            .order("created_at", {
                ascending: true
            });


    if (error) {

        console.error(
            "❌ Could not load channels:",
            error
        );

        showToast(
            "Could not load channels."
        );

        return;
    }


    state.channels =
        data || [];


    console.log(
        `✅ ${state.channels.length} channel(s) loaded automatically.`
    );


    renderChannels();


    const savedChannel =
        localStorage.getItem(
            `mwanikiSelectedChannel_${state.selectedCommunity.id}`
        );


    let selected =
        state.channels.find(
            channel =>
                channel.id === savedChannel
        );


    if (!selected) {

        selected =
            state.channels.find(
                channel =>
                    (
                        channel.slug ===
                        "general-chat"
                    ) ||
                    (
                        channel.name
                            ?.toLowerCase() ===
                        "general"
                    )
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
                    channel.name
                        ?.toLowerCase()
                        .includes(term) ||
                    channel.description
                        ?.toLowerCase()
                        .includes(term)
                );

            }
        );


    if (!channels.length) {

        container.innerHTML = `
            <div
                style="
                    padding:15px;
                    color:#71808a;
                    font-size:12px;
                "
            >
                No channels found.
            </div>
        `;

        return;
    }


    container.innerHTML =
        channels
            .map(channel => {

                const active =
                    channel.id ===
                    state.selectedChannel?.id;

                return `
                    <button
                        type="button"
                        class="channel-button ${
                            active ? "active" : ""
                        }"
                        data-channel-id="${escapeHtml(
                            channel.id
                        )}"
                    >

                        <span class="channel-icon">
                            ${escapeHtml(
                                channelIcon(channel)
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

                    const channel =
                        state.channels.find(
                            item =>
                                item.id ===
                                button.dataset.channelId
                        );

                    if (channel) {

                        await selectChannel(
                            channel
                        );

                    }

                }
            );

        });
}


async function selectChannel(
    channel,
    save = true
) {

    if (!channel) {
        return;
    }


    state.selectedChannel =
        channel;


    if (save) {

        localStorage.setItem(
            `mwanikiSelectedChannel_${state.selectedCommunity.id}`,
            channel.id
        );

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
            channelIcon(channel);
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


    const query =
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
                state.selectedChannel.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .range(
                older
                    ? state.messageOffset
                    : 0,
                older
                    ? state.messageOffset +
                        MESSAGE_PAGE_SIZE -
                        1
                    : MESSAGE_PAGE_SIZE - 1
            );


    const {
        data,
        error
    } = await query;


    if (error) {

        console.error(
            "❌ Could not load messages:",
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

        state.messageOffset =
            0;
    }


    state.messageOffset +=
        messages.length;

    state.hasMoreMessages =
        messages.length ===
        MESSAGE_PAGE_SIZE;


    await loadMessageRelatedData();

    renderMessages();


    const area =
        $("#messageArea");

    if (
        area &&
        !older
    ) {

        requestAnimationFrame(
            () => {

                area.scrollTop =
                    area.scrollHeight;

            }
        );

    }
}


async function loadMessageRelatedData() {

    if (!state.messages.length) {

        state.reactions = [];
        state.attachments = [];

        return;
    }


    const ids =
        state.messages.map(
            message => message.id
        );


    const [
        reactionsResult,
        attachmentsResult
    ] =
        await Promise.all([

            supabase
                .from("chat_message_reactions")
                .select("*")
                .in("message_id", ids),

            supabase
                .from("chat_attachments")
                .select("*")
                .in("message_id", ids)

        ]);


    state.reactions =
        reactionsResult.data || [];


    state.attachments =
        attachmentsResult.data || [];
}


function getMessageReactions(
    messageId
) {

    return state.reactions.filter(
        reaction =>
            reaction.message_id ===
            messageId
    );
}


function getMessageAttachments(
    messageId
) {

    return state.attachments.filter(
        attachment =>
            attachment.message_id ===
            messageId
    );
}


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
            .map(renderMessage)
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
        Boolean(message.is_deleted);


    const profile =
        getProfileForMessage(
            message.user_id
        );


    const author =
        profile?.full_name ||
        profile?.name ||
        (
            own
                ? (
                    state.profile?.full_name ||
                    "You"
                )
                : "Community Member"
        );


    const avatar =
        profile?.photo_url ||
        profile?.avatar_url ||
        "";


    const reactions =
        getMessageReactions(
            message.id
        );


    const attachments =
        getMessageAttachments(
            message.id
        );


    const reactionCounts =
        countReactions(
            reactions
        );


    return `
        <article
            class="message ${
                deleted ? "deleted" : ""
            }"
            data-message-id="${escapeHtml(
                message.id
            )}"
        >

            ${
                avatar
                    ? `
                        <img
                            class="message-avatar"
                            src="${escapeHtml(
                                safeUrl(avatar)
                            )}"
                            alt=""
                        >
                    `
                    : `
                        <div
                            class="message-avatar"
                            style="
                                display:grid;
                                place-items:center;
                                color:#087f73;
                                font-weight:800;
                            "
                        >
                            ${escapeHtml(
                                getInitials(author)
                            )}
                        </div>
                    `
            }


            <div class="message-body">

                <div class="message-meta">

                    <span class="message-author">
                        ${escapeHtml(author)}
                    </span>

                    <span class="message-time">
                        ${formatDate(
                            message.created_at
                        )}
                        ·
                        ${formatTime(
                            message.created_at
                        )}
                    </span>

                </div>


                <div class="message-content">

                    ${
                        deleted
                            ? "This message was deleted."
                            : renderMessageContent(
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

                                ${
                                    Object.entries(
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
                                            >
                                                ${escapeHtml(
                                                    reaction
                                                )}
                                                ${count}
                                            </button>
                                        `
                                    )
                                    .join("")
                                }

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
                                    😊 React
                                </button>

                                ${
                                    own
                                        ? `
                                            <button
                                                type="button"
                                                class="message-action"
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

        return `
            <img
                class="message-gif"
                src="${escapeHtml(url)}"
                alt="GIF"
                loading="lazy"
            >
        `;
    }


    return escapeHtml(content);
}


function renderAttachments(
    attachments
) {

    if (!attachments.length) {
        return "";
    }


    return attachments
        .map(attachment => {

            const url =
                safeUrl(
                    attachment.file_url
                );


            const mime =
                String(
                    attachment.mime_type || ""
                );


            if (
                mime.startsWith(
                    "image/"
                )
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
                                attachment.file_name
                            )}"
                            loading="lazy"
                        >
                    </a>
                `;
            }


            if (
                mime.startsWith(
                    "audio/"
                )
            ) {

                return `
                    <audio
                        class="message-audio"
                        controls
                        preload="metadata"
                        src="${escapeHtml(url)}"
                    ></audio>
                `;
            }


            return `
                <a
                    class="message-file"
                    href="${escapeHtml(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    📄

                    <span>
                        <strong>
                            ${escapeHtml(
                                attachment.file_name
                            )}
                        </strong>

                        <br>

                        <small>
                            ${formatFileSize(
                                attachment.file_size
                            )}
                        </small>
                    </span>
                </a>
            `;

        })
        .join("");
}


/* =========================================================
   PUBLIC PROFILE CACHE
   ========================================================= */

const publicProfiles =
    new Map();


function getProfileForMessage(
    userId
) {

    if (
        userId ===
        state.user?.id
    ) {

        return state.profile;
    }

    return publicProfiles.get(
        userId
    );
}


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
                !publicProfiles.has(id)
        );


    if (!missing.length) {
        return;
    }


    const {
        data,
        error
    } =
        await supabase
            .from("chat_public_profiles")
            .select(`
                id,
                full_name,
                photo_url
            `)
            .in("id", missing);


    if (error) {
        return;
    }


    for (const profile of data || []) {

        publicProfiles.set(
            profile.id,
            profile
        );
    }
}


async function refreshMessageProfiles() {

    await loadPublicProfiles();

    renderMessages();
}


/* =========================================================
   REACTIONS
   ========================================================= */

function countReactions(
    reactions
) {

    return reactions.reduce(
        (result, item) => {

            const value =
                item.reaction ||
                "👍";

            result[value] =
                (result[value] || 0) +
                1;

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
        return;
    }


    const existing =
        state.reactions.find(
            item =>
                item.message_id ===
                    messageId &&
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
   MESSAGE HANDLERS
   ========================================================= */

function attachMessageHandlers() {

    $$("#messageList [data-action='delete']")
        .forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    const article =
                        event.target.closest(
                            "[data-message-id]"
                        );

                    if (!article) {
                        return;
                    }

                    await deleteMessage(
                        article.dataset.messageId
                    );
                }
            );

        });


    $$("#messageList [data-action='react']")
        .forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    const article =
                        event.target.closest(
                            "[data-message-id]"
                        );

                    if (!article) {
                        return;
                    }

                    await toggleReaction(
                        article.dataset.messageId,
                        "👍"
                    );
                }
            );

        });


    $$("#messageList .reaction")
        .forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    const article =
                        event.target.closest(
                            "[data-message-id]"
                        );

                    if (!article) {
                        return;
                    }

                    await toggleReaction(
                        article.dataset.messageId,
                        button.dataset.reaction
                    );
                }
            );

        });
}


async function deleteMessage(
    messageId
) {

    const message =
        state.messages.find(
            item =>
                item.id === messageId
        );


    if (!message) {
        return;
    }


    if (
        message.user_id !==
        state.user?.id
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
            "Delete message error:",
            error
        );

        showToast(
            "Could not delete message."
        );

        return;
    }


    const target =
        state.messages.find(
            item =>
                item.id === messageId
        );


    if (target) {

        target.is_deleted =
            true;

        target.content =
            "";

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

                content,

                message_type:
                    "text"
            })
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

    input.focus();


    if (data) {

        const exists =
            state.messages.some(
                message =>
                    message.id ===
                    data.id
            );

        if (!exists) {
            state.messages.push(data);
        }

    }


    renderMessages();

    scrollMessagesToBottom();
}


/* =========================================================
   FILE UPLOAD
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
        MAX_FILE_SIZE
    ) {

        showToast(
            "File is larger than 50 MB."
        );

        return;
    }


    const isImage =
        file.type.startsWith(
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
                STORAGE_BUCKET
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
            "Upload error:",
            uploadError
        );

        showToast(
            "File upload failed."
        );

        return;
    }


    const {
        data: urlData
    } =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const fileUrl =
        urlData?.publicUrl;


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
            "Message insert error:",
            messageError
        );

        showToast(
            "File uploaded but message failed."
        );

        return;
    }


    const {
        error: attachmentError
    } =
        await supabase
            .from("chat_attachments")
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


    showToast(
        "File sent successfully."
    );


    state.messages.push(
        message
    );


    await loadMessageRelatedData();

    renderMessages();

    scrollMessagesToBottom();
}


/* =========================================================
   GIF
   ========================================================= */

function openGifPicker() {

    closeEmojiPicker();

    $("#gifPicker")
        ?.classList.remove(
            "hidden"
        );
}


function closeGifPicker() {

    $("#gifPicker")
        ?.classList.add(
            "hidden"
        );

    state.gifUrl =
        "";

    const input =
        $("#gifUrlInput");

    const preview =
        $("#gifPreview");

    const button =
        $("#sendGifButton");

    if (input) {
        input.value = "";
    }

    if (preview) {
        preview.innerHTML = "";
    }

    if (button) {
        button.disabled = true;
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


    image.onerror = () => {

        preview.innerHTML =
            "<p>Could not load this image.</p>";

        button.disabled = true;

    };


    image.onload = () => {

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


    if (!state.selectedChannel) {
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
        state.messages.push(data);
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

async function startVoiceRecording() {

    if (!navigator.mediaDevices?.getUserMedia) {

        showToast(
            "Voice recording is not supported by this browser."
        );

        return;
    }


    try {

        state.mediaStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });


        state.recordingChunks =
            [];


        state.mediaRecorder =
            new MediaRecorder(
                state.mediaStream
            );


        state.mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size
                ) {

                    state.recordingChunks.push(
                        event.data
                    );
                }

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


        updateRecordingTimer();


        state.recordingTimer =
            setInterval(
                updateRecordingTimer,
                1000
            );


    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

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
            Math.floor(seconds / 60)
        ).padStart(2, "0");


    const remainder =
        String(
            seconds % 60
        ).padStart(2, "0");


    const timer =
        $("#voiceRecorderTimer");

    if (timer) {

        timer.textContent =
            `${minutes}:${remainder}`;
    }
}


function stopVoiceRecording(
    upload = true
) {

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

    } else if (!upload) {

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
            () => cleanupRecording();

        state.mediaRecorder.stop();

    } else {

        cleanupRecording();
    }
}


function cleanupRecording() {

    if (state.mediaStream) {

        state.mediaStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
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


    const blob =
        new Blob(
            chunks,
            {
                type:
                    state.mediaRecorder
                        ?.mimeType ||
                    "audio/webm"
            }
        );


    if (!state.user || !state.selectedChannel) {

        cleanupRecording();

        return;
    }


    const extension =
        blob.type.includes("mp4")
            ? "m4a"
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
                STORAGE_BUCKET
            )
            .upload(
                path,
                blob,
                {
                    contentType:
                        blob.type,
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
        data: urlData
    } =
        supabase.storage
            .from(
                STORAGE_BUCKET
            )
            .getPublicUrl(
                path
            );


    const fileUrl =
        urlData?.publicUrl;


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

        cleanupRecording();

        return;
    }


    await supabase
        .from("chat_attachments")
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
                blob.type,

            file_size:
                blob.size
        });


    if (message) {
        state.messages.push(message);
    }


    await loadMessageRelatedData();

    renderMessages();

    scrollMessagesToBottom();


    if (status) {

        status.textContent =
            "Voice note sent.";

        setTimeout(
            () => {

                status.classList.add(
                    "hidden"
                );

            },
            1500
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
        Math.min(
            textarea.scrollHeight,
            150
        ) + "px";
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
                    table: "chat_messages",
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
                                    message.id ===
                                    payload.new.id
                            );

                        if (!exists) {

                            state.messages.push(
                                payload.new
                            );

                            await loadMessageRelatedData();

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
                                    message.id ===
                                    payload.new.id
                            );


                        if (index >= 0) {

                            state.messages[index] =
                                payload.new;

                        } else {

                            state.messages.push(
                                payload.new
                            );
                        }


                        renderMessages();
                    }

                }
            )
            .subscribe();


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
                async () => {

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
                async () => {

                    await loadMessageRelatedData();

                    renderMessages();

                }
            )
            .subscribe();
}


/* =========================================================
   GENERAL CALL
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
        mode;


    $("#generalVoiceCallButton")
        ?.classList.toggle(
            "active",
            mode === "voice"
        );


    $("#generalVideoCallButton")
        ?.classList.toggle(
            "active",
            mode === "video"
        );
}


function startGeneralCall() {

    const input =
        $("#generalCallUserInput");

    const message =
        $("#generalCallMessage");


    const targetUserId =
        input?.value.trim();


    if (!targetUserId) {

        if (message) {

            message.textContent =
                "Enter the user UUID first.";

        }

        return;
    }


    if (
        targetUserId ===
        state.user?.id
    ) {

        if (message) {

            message.textContent =
                "You cannot call yourself.";

        }

        return;
    }


    closeGeneralCallModal();


    /*
       IMPORTANT:

       community.js does NOT perform WebRTC.

       It only sends the event to call.js.
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
   EVENT LISTENERS
   ========================================================= */

function initializeEventListeners() {

    /* Rules */

    initializeRules();


    /* Community */

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

                if (
                    event.target.id ===
                    "communityModal"
                ) {

                    closeCommunityModal();

                }

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


    /* Channels */

    $("#channelSearchInput")
        ?.addEventListener(
            "input",
            event => {

                renderChannels(
                    event.target.value
                );

            }
        );


    /* Dashboard */

    $("#dashboardButton")
        ?.addEventListener(
            "click",
            goDashboard
        );


    $("#homeButton")
        ?.addEventListener(
            "click",
            goDashboard
        );


    $("#railHomeButton")
        ?.addEventListener(
            "click",
            goDashboard
        );


    $("#railProfileButton")
        ?.addEventListener(
            "click",
            openProfile
        );


    $("#sidebarProfileButton")
        ?.addEventListener(
            "click",
            openProfile
        );


    /* Welcome */

    $("#welcomeStartButton")
        ?.addEventListener(
            "click",
            () => {

                $("#messageInput")
                    ?.focus();

            }
        );


    /* Message */

    $("#messageForm")
        ?.addEventListener(
            "submit",
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


    /* Older messages */

    $("#loadOlderMessagesButton")
        ?.addEventListener(
            "click",
            async () => {

                await loadMessages(
                    true
                );

            }
        );


    /* Attachments */

    $("#attachButton")
        ?.addEventListener(
            "click",
            () => {

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


                for (const file of files) {

                    await uploadFile(
                        file
                    );

                }


                event.target.value =
                    "";

            }
        );


    /* GIF */

    $("#gifButton")
        ?.addEventListener(
            "click",
            openGifPicker
        );


    $("#closeGifButton")
        ?.addEventListener(
            "click",
            closeGifPicker
        );


    $("#previewGifButton")
        ?.addEventListener(
            "click",
            previewGif
        );


    $("#sendGifButton")
        ?.addEventListener(
            "click",
            sendGif
        );


    /* Emoji */

    $("#emojiButton")
        ?.addEventListener(
            "click",
            event => {

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


    const emojiPicker =
        document.querySelector(
            "emoji-picker"
        );


    emojiPicker?.addEventListener(
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


    /* Voice */

    $("#voiceNoteButton")
        ?.addEventListener(
            "click",
            startVoiceRecording
        );


    $("#cancelVoiceNoteButton")
        ?.addEventListener(
            "click",
            cancelVoiceRecording
        );


    $("#stopVoiceNoteButton")
        ?.addEventListener(
            "click",
            () => {

                stopVoiceRecording(
                    true
                );

            }
        );


    /* Calls */

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

                if (
                    event.target.id ===
                    "generalCallModal"
                ) {

                    closeGeneralCallModal();

                }

            }
        );


    /* Close pickers when clicking outside */

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


    /* Escape key */

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

        }
    );
}


/* =========================================================
   AUTH LISTENER
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


            if (session?.user) {

                state.user =
                    session.user;


                await loadProfile();

            }

        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeCommunity() {

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
            "⚠️ No authenticated community user."
        );

        showToast(
            "Please sign in to use the community."
        );

        return;
    }


    await loadProfile();

    await loadCommunities();


    await refreshMessageProfiles();


    console.log(
        "✅ Mwaniki Scholars Community initialized."
    );
}


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
    "🚀 Mwaniki Scholars Community engine loaded"
);
