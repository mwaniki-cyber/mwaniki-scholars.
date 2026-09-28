/* =========================================================
   MWANIKI SCHOLARS
   MWANIKI COMMUNITY
   PHASE 2 COMMUNITY ENGINE
========================================================= */

"use strict";


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let currentStudent = null;

let currentCommunity = null;

let currentChannel = null;

let currentChannelRecord = null;

let currentCommunityRecord = null;

let currentMessages = [];

let currentMembers = [];

let currentPresence = [];

let currentReplyTo = null;

let selectedMessageId = null;

let selectedReactionMessageId = null;

let pendingAttachments = [];

let communityRealtimeChannel = null;

let presenceRealtimeChannel = null;

let messageChannelMap = new Map();

let unreadCounts = {};

let notificationItems = [];

let isLoadingMessages = false;

let isSendingMessage = false;

let toastTimer = null;

let searchTimer = null;

let typingTimer = null;

let isTyping = false;


/* =========================================================
   CONSTANTS
========================================================= */

const COMMUNITY_NAME =
    "Mwaniki Scholars";

const COMMUNITY_STORAGE_PREFIX =
    "mwanikiCommunity_";

const SELECTED_CHANNEL_KEY =
    `${COMMUNITY_STORAGE_PREFIX}selectedChannel`;

const UNREAD_KEY =
    `${COMMUNITY_STORAGE_PREFIX}unread`;

const NOTIFICATIONS_KEY =
    `${COMMUNITY_STORAGE_PREFIX}notifications`;

const SETTINGS_KEY =
    `${COMMUNITY_STORAGE_PREFIX}settings`;

const CHANNEL_DESCRIPTIONS = {

    "general-chat":
        "A relaxed academic space for Mwaniki Scholars students.",

    announcements:
        "Important Mwaniki Scholars announcements and community news.",

    introductions:
        "Introduce yourself and meet other students.",

    hematology:
        "Discuss hematology concepts, revision and laboratory learning.",

    "clinical-chemistry":
        "Clinical chemistry discussions, revision and study support.",

    microbiology:
        "Microbiology learning, revision and academic discussion.",

    parasitology:
        "Parasitology and medical helminthology discussion.",

    "blood-transfusion":
        "Blood transfusion and immunohematology discussion.",

    "exam-preparation":
        "Prepare for upcoming examinations together.",

    "assignment-help":
        "Academic discussion and peer support for assignments.",

    revision:
        "General revision and study sessions.",

    "mwaniki-ai":
        "Discuss Mwaniki AI and share AI-assisted learning ideas.",

    "turbo-ai":
        "Discuss Turbo AI and its separate learning capabilities."

};


const DEFAULT_CHANNELS = [
    {
        slug: "general-chat",
        name: "General Chat",
        category: "Community"
    },
    {
        slug: "announcements",
        name: "Announcements",
        category: "Community"
    },
    {
        slug: "introductions",
        name: "Introductions",
        category: "Community"
    },
    {
        slug: "hematology",
        name: "Hematology",
        category: "Medical Sciences"
    },
    {
        slug: "clinical-chemistry",
        name: "Clinical Chemistry",
        category: "Medical Sciences"
    },
    {
        slug: "microbiology",
        name: "Microbiology",
        category: "Medical Sciences"
    },
    {
        slug: "parasitology",
        name: "Parasitology",
        category: "Medical Sciences"
    },
    {
        slug: "blood-transfusion",
        name: "Blood Transfusion",
        category: "Medical Sciences"
    },
    {
        slug: "exam-preparation",
        name: "Exam Preparation",
        category: "Study Groups"
    },
    {
        slug: "assignment-help",
        name: "Assignment Help",
        category: "Study Groups"
    },
    {
        slug: "revision",
        name: "Revision",
        category: "Study Groups"
    },
    {
        slug: "mwaniki-ai",
        name: "Mwaniki AI",
        category: "AI & Learning"
    },
    {
        slug: "turbo-ai",
        name: "Turbo AI",
        category: "AI & Learning"
    }
];


/* =========================================================
   DOM HELPER
========================================================= */

function $(selector) {

    return document.querySelector(selector);

}


function $all(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );

}


/* =========================================================
   SAFE TEXT
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   AUTH
========================================================= */

async function initializeCommunity() {

    console.log(
        "🚀 Mwaniki Community Phase 2 engine loading..."
    );


    if (
        typeof supabase === "undefined" ||
        !supabase ||
        !supabase.auth
    ) {

        console.error(
            "❌ Supabase client was not found."
        );

        showAuthScreen(
            "The Supabase connection could not be initialized."
        );

        return;

    }


    try {

        const {
            data,
            error
        } =
            await supabase.auth.getSession();


        if (error) {

            throw error;

        }


        if (!data?.session?.user) {

            showAuthScreen(
                "Please sign in to Mwaniki Scholars before opening Mwaniki Community."
            );

            return;

        }


        await startAuthenticatedCommunity(
            data.session.user
        );


    } catch (error) {

        console.error(
            "❌ Community initialization failed:",
            error
        );

        showAuthScreen(
            "The community could not be initialized. Please try again."
        );

    }


    setupAuthListener();

}


function setupAuthListener() {

    supabase.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            console.log(
                "🔐 Community auth:",
                event
            );


            if (
                session?.user &&
                !currentUser
            ) {

                await startAuthenticatedCommunity(
                    session.user
                );

                return;

            }


            if (
                !session?.user
            ) {

                currentUser = null;

                showAuthScreen(
                    "Your session has ended. Please sign in again."
                );

            }

        }
    );

}


/* =========================================================
   START COMMUNITY
========================================================= */

async function startAuthenticatedCommunity(
    user
) {

    currentUser = user;


    hideAuthScreen();


    console.log(
        "👤 Community authenticated user:",
        currentUser.email
    );


    await loadStudentProfile();


    renderCurrentUser();


    await ensureCommunity();


    await loadCommunityChannels();


    restoreSelectedChannel();


    await loadCommunityMembers();


    setupInterface();


    setupRealtime();


    setupPresence();


    await updatePresence(
        "online"
    );


    await loadCommunityNotifications();


    console.log(
        "✅ Mwaniki Community ready."
    );

}


/* =========================================================
   STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {

    if (!currentUser?.id) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("students")
                .select("*")
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Student profile could not be loaded:",
                error.message
            );

            return;

        }


        currentStudent =
            data || null;


    } catch (error) {

        console.warn(
            "⚠️ Student profile error:",
            error
        );

    }

}


/* =========================================================
   USER DISPLAY
========================================================= */

function getUserName() {

    return (
        currentStudent?.full_name ||
        currentStudent?.name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        currentUser?.email?.split("@")[0] ||
        "Student"
    );

}


function getUserRole() {

    const role =
        currentStudent?.role ||
        currentUser?.user_metadata?.role ||
        "student";

    return String(role)
        .replace(/_/g, " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );

}


function getInitials(name) {

    const parts =
        String(name || "Student")
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (!parts.length) {

        return "S";

    }


    return parts
        .slice(0, 2)
        .map(
            part =>
                part
                    .charAt(0)
                    .toUpperCase()
        )
        .join("");

}


function getUserPhoto() {

    return (
        currentStudent?.photo_url ||
        currentUser?.user_metadata?.photo_url ||
        currentUser?.user_metadata?.avatar_url ||
        currentUser?.user_metadata?.picture ||
        ""
    );

}


/* =========================================================
   RENDER CURRENT USER
========================================================= */

function renderCurrentUser() {

    const name =
        getUserName();

    const role =
        getUserRole();

    const initials =
        getInitials(name);

    const avatar =
        $("#currentUserAvatar");


    if (avatar) {

        avatar.innerHTML =
            getUserPhoto()
                ? `
                    <img
                        src="${escapeHTML(getUserPhoto())}"
                        alt="${escapeHTML(name)}"
                    >
                    <span
                        class="presence-dot online"
                    ></span>
                `
                : `
                    ${escapeHTML(initials)}

                    <span
                        class="presence-dot online"
                    ></span>
                `;

    }


    const nameElement =
        $("#currentUserName");


    if (nameElement) {

        nameElement.textContent =
            name;

    }


    const roleElement =
        $("#currentUserRole");


    if (roleElement) {

        roleElement.textContent =
            role;

    }

}


/* =========================================================
   COMMUNITY
========================================================= */

async function ensureCommunity() {

    try {

        const {
            data,
            error
        } =
            await supabase
                .from("chat_communities")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )
                .limit(20);


        if (error) {

            console.error(
                "❌ Community query failed:",
                error
            );

            return;

        }


        if (
            Array.isArray(data) &&
            data.length
        ) {

            currentCommunityRecord =
                data[0];

            currentCommunity =
                getCommunityIdentifier(
                    data[0]
                );

        } else {

            currentCommunityRecord =
                null;

            currentCommunity =
                null;

            console.warn(
                "⚠️ No chat community record was returned."
            );

        }


        renderCommunityName();


    } catch (error) {

        console.error(
            "❌ Community loading error:",
            error
        );

    }

}


/* =========================================================
   COMMUNITY ID HELPERS
========================================================= */

function getCommunityIdentifier(
    community
) {

    if (!community) {

        return null;

    }


    return (
        community.id ??
        community.community_id ??
        community.slug ??
        community.name ??
        null
    );

}


function getChannelIdentifier(
    channel
) {

    if (!channel) {

        return null;

    }


    return (
        channel.id ??
        channel.channel_id ??
        channel.slug ??
        channel.name ??
        null
    );

}


/* =========================================================
   COMMUNITY NAME
========================================================= */

function renderCommunityName() {

    const element =
        $("#activeCommunityName");


    if (!element) {

        return;

    }


    element.textContent =
        currentCommunityRecord?.name ||
        COMMUNITY_NAME;

}


/* =========================================================
   CHANNEL LOADING
========================================================= */

async function loadCommunityChannels() {

    if (!currentCommunity) {

        console.warn(
            "⚠️ No community selected; using UI channel definitions."
        );

        return;

    }


    try {

        let query =
            supabase
                .from("chat_channels")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );


        const possibleCommunityColumn =
            getCommunityColumnName(
                currentCommunityRecord
            );


        if (
            possibleCommunityColumn &&
            currentCommunityRecord?.id
        ) {

            query =
                query.eq(
                    possibleCommunityColumn,
                    currentCommunityRecord.id
                );

        }


        const {
            data,
            error
        } =
            await query;


        if (error) {

            console.warn(
                "⚠️ Channel query failed:",
                error.message
            );

            return;

        }


        if (
            Array.isArray(data) &&
            data.length
        ) {

            currentChannel =
                data;

            currentChannelRecord =
                data;

        }


    } catch (error) {

        console.warn(
            "⚠️ Channel loading error:",
            error
        );

    }

}


/* =========================================================
   COMMUNITY COLUMN DETECTION
========================================================= */

function getCommunityColumnName(
    row
) {

    if (!row) {

        return null;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            row,
            "community_id"
        )
    ) {

        return "community_id";

    }


    if (
        Object.prototype.hasOwnProperty.call(
            row,
            "community"
        )
    ) {

        return "community";

    }


    return null;

}


/* =========================================================
   CHANNEL RESOLUTION
========================================================= */

async function resolveChannel(
    requestedSlug
) {

    const slug =
        String(
            requestedSlug ||
            "general-chat"
        )
        .trim()
        .toLowerCase();


    const uiChannel =
        DEFAULT_CHANNELS.find(
            channel =>
                channel.slug === slug
        ) ||
        DEFAULT_CHANNELS[0];


    let databaseChannel =
        null;


    if (
        Array.isArray(currentChannelRecord)
    ) {

        databaseChannel =
            currentChannelRecord.find(
                channel => {

                    const values = [
                        channel.slug,
                        channel.name,
                        channel.channel_name,
                        channel.channel_slug
                    ]
                        .filter(Boolean)
                        .map(
                            value =>
                                String(value)
                                    .trim()
                                    .toLowerCase()
                        );

                    return values.includes(slug);

                }
            ) || null;

    }


    if (!databaseChannel) {

        try {

            const {
                data,
                error
            } =
                await supabase
                    .from("chat_channels")
                    .select("*")
                    .or(
                        `slug.eq.${escapePostgRESTValue(slug)},name.eq.${escapePostgRESTValue(uiChannel.name)}`
                    )
                    .limit(5);


            if (
                !error &&
                Array.isArray(data) &&
                data.length
            ) {

                databaseChannel =
                    data.find(
                        row =>
                            String(
                                row.slug ||
                                row.name ||
                                ""
                            )
                                .toLowerCase()
                                .replace(/\s+/g, "-") ===
                            slug
                    ) ||
                    data[0];

            }

        } catch (error) {

            console.warn(
                "⚠️ Channel direct lookup failed:",
                error
            );

        }

    }


    return {
        ui: uiChannel,
        database: databaseChannel
    };

}


/* =========================================================
   POSTGREST ESCAPE
========================================================= */

function escapePostgRESTValue(
    value
) {

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/\./g, "\\.")
        .replace(/"/g, '\\"')
        .replace(/'/g, "''");

}


/* =========================================================
   RESTORE CHANNEL
========================================================= */

function restoreSelectedChannel() {

    let slug =
        localStorage.getItem(
            SELECTED_CHANNEL_KEY
        );


    if (
        !slug ||
        !DEFAULT_CHANNELS.some(
            channel =>
                channel.slug === slug
        )
    ) {

        slug =
            "general-chat";

    }


    openChannel(
        slug,
        false
    );

}


/* =========================================================
   OPEN CHANNEL
========================================================= */

async function openChannel(
    slug,
    save = true
) {

    const channel =
        DEFAULT_CHANNELS.find(
            item =>
                item.slug === slug
        ) ||
        DEFAULT_CHANNELS[0];


    currentChannel =
        channel;


    if (save) {

        localStorage.setItem(
            SELECTED_CHANNEL_KEY,
            channel.slug
        );

    }


    $all(
        "[data-channel]"
    )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.channel ===
                    channel.slug
            );

        });


    const channelName =
        $("#activeChannelName");


    if (channelName) {

        channelName.textContent =
            channel.name;

    }


    const description =
        $("#activeChannelDescription");


    if (description) {

        description.textContent =
            CHANNEL_DESCRIPTIONS[
                channel.slug
            ] ||
            "Academic discussion channel.";

    }


    const messageInput =
        $("#messageInput");


    if (messageInput) {

        messageInput.placeholder =
            `Message #${channel.slug}`;

    }


    clearUnread(
        channel.slug
    );


    currentChannelRecord =
        await resolveChannel(
            channel.slug
        );


    await loadMessages();


    await markChannelRead();


    closeMobileSidebar();


    scrollMessagesToBottom(
        false
    );

}


/* =========================================================
   LOAD MESSAGES
========================================================= */

async function loadMessages() {

    if (isLoadingMessages) {

        return;

    }


    isLoadingMessages =
        true;


    showMessagesLoading();


    try {

        const databaseChannel =
            currentChannelRecord?.database ||
            null;


        let query =
            supabase
                .from("chat_messages")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )
                .limit(200);


        const channelColumn =
            findColumn(
                databaseChannel,
                [
                    "channel_id",
                    "channel"
                ]
            );


        if (
            channelColumn &&
            databaseChannel?.id !== undefined
        ) {

            query =
                query.eq(
                    channelColumn,
                    databaseChannel.id
                );

        } else if (
            currentChannel?.slug
        ) {

            const possibleColumns = [
                "channel_slug",
                "channel_name",
                "channel"
            ];


            let loaded = false;


            for (
                const column
                of possibleColumns
            ) {

                try {

                    const result =
                        await supabase
                            .from("chat_messages")
                            .select("*")
                            .eq(
                                column,
                                column ===
                                    "channel_name"
                                    ? currentChannel.name
                                    : currentChannel.slug
                            )
                            .order(
                                "created_at",
                                {
                                    ascending: true
                                }
                            )
                            .limit(200);


                    if (
                        !result.error
                    ) {

                        currentMessages =
                            Array.isArray(
                                result.data
                            )
                                ? result.data
                                : [];

                        renderMessages();

                        loaded = true;

                        break;

                    }

                } catch (_) {

                    /* Try next compatible column. */

                }

            }


            if (loaded) {

                return;

            }

        }


        const {
            data,
            error
        } =
            await query;


        if (error) {

            throw error;

        }


        currentMessages =
            Array.isArray(data)
                ? data
                : [];


        renderMessages();


    } catch (error) {

        console.error(
            "❌ Message loading failed:",
            error
        );


        renderMessagesError(
            error
        );


    } finally {

        isLoadingMessages =
            false;

    }

}


/* =========================================================
   FIND COLUMN
========================================================= */

function findColumn(
    object,
    candidates
) {

    if (!object) {

        return null;

    }


    for (
        const candidate
        of candidates
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                object,
                candidate
            )
        ) {

            return candidate;

        }

    }


    return null;

}


/* =========================================================
   LOADING UI
========================================================= */

function showMessagesLoading() {

    const container =
        $("#messagesContainer");


    if (!container) {

        return;

    }


    container.innerHTML = `
        <div class="messages-loading">
            <div class="loading-spinner"></div>
            <p>Loading community messages...</p>
        </div>
    `;

}


/* =========================================================
   RENDER MESSAGE ERROR
========================================================= */

function renderMessagesError(
    error
) {

    const container =
        $("#messagesContainer");


    if (!container) {

        return;

    }


    container.innerHTML = `
        <div class="empty-state">

            <strong>
                Community messages could not be loaded
            </strong>

            <span>
                ${escapeHTML(
                    error?.message ||
                    "Please check your community database configuration."
                )}
            </span>

            <button
                type="button"
                class="secondary-button"
                id="retryMessagesButton"
                style="margin-top:12px;"
            >
                Retry
            </button>

        </div>
    `;


    $("#retryMessagesButton")
        ?.addEventListener(
            "click",
            loadMessages
        );

}


/* =========================================================
   RENDER MESSAGES
========================================================= */

function renderMessages() {

    const container =
        $("#messagesContainer");


    if (!container) {

        return;

    }


    if (!currentMessages.length) {

        container.innerHTML = `
            <div class="channel-introduction">

                <div class="channel-introduction-icon">
                    #
                </div>

                <h2>
                    Welcome to #${escapeHTML(
                        currentChannel?.slug ||
                        "general-chat"
                    )}
                </h2>

                <p>
                    ${escapeHTML(
                        CHANNEL_DESCRIPTIONS[
                            currentChannel?.slug
                        ] ||
                        "This is the beginning of this channel."
                    )}
                </p>

                <p>
                    Start the conversation by sending
                    the first academic message.
                </p>

            </div>
        `;

        return;

    }


    const introduction =
        `
        <div class="channel-introduction">

            <div class="channel-introduction-icon">
                #
            </div>

            <h2>
                Welcome to #${escapeHTML(
                    currentChannel?.slug ||
                    "general-chat"
                )}
            </h2>

            <p>
                ${escapeHTML(
                    CHANNEL_DESCRIPTIONS[
                        currentChannel?.slug
                    ] ||
                    "Academic discussion channel."
                )}
            </p>

        </div>
        `;


    const messagesHTML =
        currentMessages
            .map(
                renderMessageHTML
            )
            .join("");


    container.innerHTML =
        introduction +
        messagesHTML;


    attachMessageEvents();

}


/* =========================================================
   MESSAGE HTML
========================================================= */

function renderMessageHTML(
    message
) {

    const id =
        getMessageId(message);


    const authorName =
        getMessageAuthorName(
            message
        );


    const role =
        getMessageRole(
            message
        );


    const content =
        getMessageContent(
            message
        );


    const createdAt =
        getMessageDate(
            message
        );


    const photo =
        getMessagePhoto(
            message
        );


    const initials =
        getInitials(
            authorName
        );


    const reactions =
        getMessageReactions(
            message
        );


    const reply =
        getMessageReply(
            message
        );


    return `
        <article
            class="message-row"
            data-message-id="${escapeHTML(id)}"
        >

            <div class="message-avatar">

                ${
                    photo
                        ? `
                            <img
                                src="${escapeHTML(photo)}"
                                alt="${escapeHTML(authorName)}"
                                loading="lazy"
                            >
                        `
                        : escapeHTML(initials)
                }

            </div>


            <div class="message-body">

                <div class="message-meta">

                    <span class="message-author">
                        ${escapeHTML(authorName)}
                    </span>

                    ${
                        role
                            ? `
                                <span class="message-role">
                                    ${escapeHTML(role)}
                                </span>
                            `
                            : ""
                    }

                    <time
                        class="message-time"
                        datetime="${escapeHTML(
                            createdAt.toISOString()
                        )}"
                    >
                        ${escapeHTML(
                            formatMessageTime(
                                createdAt
                            )
                        )}
                    </time>

                </div>


                ${
                    reply
                        ? `
                            <div
                                style="
                                    margin:5px 0;
                                    padding:5px 8px;
                                    border-left:2px solid #9bcfc9;
                                    color:#78908d;
                                    font-size:10px;
                                "
                            >
                                Replying to
                                <strong>
                                    ${escapeHTML(
                                        reply.author ||
                                        "member"
                                    )}
                                </strong>
                            </div>
                        `
                        : ""
                }


                <div class="message-content">
                    ${formatMessageContent(content)}
                </div>


                ${
                    reactions
                        ? `
                            <div class="message-reactions">
                                ${reactions}
                            </div>
                        `
                        : ""
                }

            </div>


            <div class="message-actions">

                <button
                    type="button"
                    class="message-action-button"
                    data-message-action="reply"
                    data-message-id="${escapeHTML(id)}"
                    title="Reply"
                >
                    ↩
                </button>


                <button
                    type="button"
                    class="message-action-button"
                    data-message-action="react"
                    data-message-id="${escapeHTML(id)}"
                    title="React"
                >
                    ☺
                </button>


                <button
                    type="button"
                    class="message-action-button"
                    data-message-action="copy"
                    data-message-id="${escapeHTML(id)}"
                    title="Copy"
                >
                    ⧉
                </button>

            </div>

        </article>
    `;

}


/* =========================================================
   MESSAGE FIELD HELPERS
========================================================= */

function getMessageId(
    message
) {

    return String(
        message?.id ??
        message?.message_id ??
        ""
    );

}


function getMessageAuthorName(
    message
) {

    return (
        message?.author_name ||
        message?.sender_name ||
        message?.user_name ||
        message?.display_name ||
        message?.student_name ||
        (
            message?.sender_email
                ? message.sender_email.split("@")[0]
                : null
        ) ||
        (
            message?.user_id ===
            currentUser?.id
                ? getUserName()
                : "Community Member"
        )
    );

}


function getMessageRole(
    message
) {

    return (
        message?.author_role ||
        message?.sender_role ||
        message?.role ||
        ""
    );

}


function getMessageContent(
    message
) {

    return (
        message?.content ||
        message?.message ||
        message?.body ||
        message?.text ||
        ""
    );

}


function getMessagePhoto(
    message
) {

    return (
        message?.author_photo_url ||
        message?.sender_photo_url ||
        message?.photo_url ||
        message?.avatar_url ||
        ""
    );

}


function getMessageDate(
    message
) {

    const value =
        message?.created_at ||
        message?.sent_at ||
        message?.timestamp;


    const date =
        value
            ? new Date(value)
            : new Date();


    return Number.isNaN(
        date.getTime()
    )
        ? new Date()
        : date;

}


function getMessageReply(
    message
) {

    if (
        !message?.reply_to &&
        !message?.reply_to_id &&
        !message?.parent_message_id
    ) {

        return null;

    }


    return {
        author:
            message.reply_author_name ||
            "member"
    };

}


/* =========================================================
   FORMAT MESSAGE
========================================================= */

function formatMessageContent(
    content
) {

    let html =
        escapeHTML(
            content
        );


    html =
        html.replace(
            /(^|\s)(#[a-zA-Z0-9_-]+)/g,
            '$1<span class="mention">$2</span>'
        );


    html =
        html.replace(
            /(^|\s)(@[a-zA-Z0-9_.-]+)/g,
            '$1<span class="mention">$2</span>'
        );


    return html;

}


/* =========================================================
   MESSAGE TIME
========================================================= */

function formatMessageTime(
    date
) {

    try {

        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "numeric",
                minute: "2-digit",
                month: "short",
                day: "numeric"
            }
        ).format(date);

    } catch (_) {

        return date.toLocaleString();

    }

}


/* =========================================================
   REACTIONS
========================================================= */

function getMessageReactions(
    message
) {

    const reactions =
        message?.reactions;


    if (
        !Array.isArray(reactions) ||
        !reactions.length
    ) {

        return "";

    }


    const grouped =
        {};


    reactions.forEach(
        reaction => {

            const emoji =
                reaction?.emoji ||
                reaction?.reaction ||
                "👍";


            if (
                !grouped[emoji]
            ) {

                grouped[emoji] =
                    {
                        count: 0,
                        mine: false
                    };

            }


            grouped[emoji].count++;


            if (
                reaction.user_id ===
                currentUser?.id
            ) {

                grouped[emoji].mine =
                    true;

            }

        }
    );


    return Object.entries(
        grouped
    )
        .map(
            ([emoji, value]) => `
                <button
                    type="button"
                    class="reaction-pill ${
                        value.mine
                            ? "active"
                            : ""
                    }"
                    data-reaction-message="${escapeHTML(
                        getMessageId(message)
                    )}"
                    data-reaction="${escapeHTML(
                        emoji
                    )}"
                >
                    ${escapeHTML(emoji)}
                    <span class="reaction-count">
                        ${value.count}
                    </span>
                </button>
            `
        )
        .join("");

}


/* =========================================================
   MESSAGE EVENTS
========================================================= */

function attachMessageEvents() {

    $all(
        "[data-message-action]"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        const target =
                            event.currentTarget;

                        handleMessageAction(
                            target.dataset.messageAction,
                            target.dataset.messageId
                        );

                    }
                );

            }
        );


    $all(
        "[data-reaction-message]"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        toggleReaction(
                            button.dataset.reactionMessage,
                            button.dataset.reaction
                        );

                    }
                );

            }
        );


    $all(
        ".message-row"
    )
        .forEach(
            row => {

                row.addEventListener(
                    "contextmenu",
                    event => {

                        event.preventDefault();

                        selectedMessageId =
                            row.dataset.messageId;

                        openMessageContextMenu(
                            event.clientX,
                            event.clientY
                        );

                    }
                );

            }
        );

}


/* =========================================================
   MESSAGE ACTIONS
========================================================= */

function handleMessageAction(
    action,
    messageId
) {

    selectedMessageId =
        messageId;


    if (action === "reply") {

        startReply(
            messageId
        );

        return;

    }


    if (action === "react") {

        openEmojiPickerForReaction();

        return;

    }


    if (action === "copy") {

        copyMessage(
            messageId
        );

        return;

    }

}


/* =========================================================
   COPY MESSAGE
========================================================= */

async function copyMessage(
    messageId
) {

    const message =
        currentMessages.find(
            item =>
                getMessageId(item) ===
                String(messageId)
        );


    if (!message) {

        return;

    }


    const text =
        getMessageContent(
            message
        );


    try {

        await navigator.clipboard.writeText(
            text
        );


        showToast(
            "Message copied."
        );

    } catch (error) {

        console.warn(
            "Clipboard error:",
            error
        );

        showToast(
            "Could not copy the message."
        );

    }

}


/* =========================================================
   REPLY
========================================================= */

function startReply(
    messageId
) {

    const message =
        currentMessages.find(
            item =>
                getMessageId(item) ===
                String(messageId)
        );


    if (!message) {

        return;

    }


    currentReplyTo =
        message;


    const preview =
        $("#replyPreview");


    if (preview) {

        preview.hidden =
            false;

    }


    const name =
        $("#replyPreviewName");


    if (name) {

        name.textContent =
            getMessageAuthorName(
                message
            );

    }


    const text =
        $("#replyPreviewText");


    if (text) {

        text.textContent =
            getMessageContent(
                message
            );

    }


    $("#messageInput")
        ?.focus();

}


/* =========================================================
   CANCEL REPLY
========================================================= */

function cancelReply() {

    currentReplyTo =
        null;


    const preview =
        $("#replyPreview");


    if (preview) {

        preview.hidden =
            true;

    }

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    if (isSendingMessage) {

        return;

    }


    if (!currentUser?.id) {

        showToast(
            "Please sign in first."
        );

        return;

    }


    const input =
        $("#messageInput");


    if (!input) {

        return;

    }


    const content =
        input.value.trim();


    if (
        !content &&
        !pendingAttachments.length
    ) {

        return;

    }


    if (!currentChannel) {

        showToast(
            "Please select a channel."
        );

        return;

    }


    isSendingMessage =
        true;


    const sendButton =
        $("#sendMessageButton");


    if (sendButton) {

        sendButton.disabled =
            true;

    }


    try {

        const databaseChannel =
            currentChannelRecord?.database ||
            null;


        const payload =
            buildMessagePayload(
                content,
                databaseChannel
            );


        const {
            data,
            error
        } =
            await supabase
                .from("chat_messages")
                .insert(
                    payload
                )
                .select()
                .maybeSingle();


        if (error) {

            throw error;

        }


        input.value =
            "";


        resizeMessageInput();


        updateCharacterCount();


        cancelReply();


        clearPendingAttachments();


        stopTyping();


        if (data) {

            const exists =
                currentMessages.some(
                    message =>
                        getMessageId(message) ===
                        getMessageId(data)
                );


            if (!exists) {

                currentMessages.push(
                    data
                );

                renderMessages();

                scrollMessagesToBottom(
                    true
                );

            }

        }


        showToast(
            "Message sent."
        );


    } catch (error) {

        console.error(
            "❌ Message send failed:",
            error
        );


        showToast(
            error?.message ||
            "Unable to send your message."
        );


    } finally {

        isSendingMessage =
            false;


        if (sendButton) {

            sendButton.disabled =
                false;

        }

    }

}


/* =========================================================
   BUILD MESSAGE PAYLOAD
========================================================= */

function buildMessagePayload(
    content,
    databaseChannel
) {

    const payload =
        {};


    const userId =
        currentUser.id;


    const possibleUserColumns = [
        "user_id",
        "sender_id",
        "author_id"
    ];


    const possibleContentColumns = [
        "content",
        "message",
        "body",
        "text"
    ];


    const possibleChannelColumns = [
        "channel_id",
        "channel"
    ];


    /*
       We use the standard fields first.
       The surrounding database schema remains
       authoritative.
    */

    payload.user_id =
        userId;


    payload.content =
        content;


    if (
        databaseChannel?.id !== undefined
    ) {

        payload.channel_id =
            databaseChannel.id;

    } else {

        payload.channel =
            currentChannel.slug;

    }


    if (currentReplyTo) {

        const replyId =
            getMessageId(
                currentReplyTo
            );


        if (replyId) {

            payload.reply_to_id =
                replyId;

        }

    }


    return payload;

}


/* =========================================================
   REACTIONS
========================================================= */

async function toggleReaction(
    messageId,
    emoji
) {

    if (!currentUser?.id) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("chat_message_reactions")
                .select("*")
                .eq(
                    "message_id",
                    messageId
                )
                .eq(
                    "user_id",
                    currentUser.id
                )
                .eq(
                    "reaction",
                    emoji
                )
                .maybeSingle();


        if (
            !error &&
            data
        ) {

            const {
                error: deleteError
            } =
                await supabase
                    .from(
                        "chat_message_reactions"
                    )
                    .delete()
                    .eq(
                        "id",
                        data.id
                    );


            if (deleteError) {

                throw deleteError;

            }

        } else {

            const {
                error: insertError
            } =
                await supabase
                    .from(
                        "chat_message_reactions"
                    )
                    .insert({
                        message_id:
                            messageId,

                        user_id:
                            currentUser.id,

                        reaction:
                            emoji
                    });


            if (insertError) {

                throw insertError;

            }

        }


        await loadMessages();


    } catch (error) {

        console.error(
            "❌ Reaction failed:",
            error
        );


        showToast(
            error?.message ||
            "Reaction could not be saved."
        );

    }

}


/* =========================================================
   LOAD COMMUNITY MEMBERS
========================================================= */

async function loadCommunityMembers() {

    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_community_members"
                )
                .select("*");


        if (error) {

            console.warn(
                "⚠️ Community member loading failed:",
                error.message
            );

            currentMembers =
                [];

            renderMembers();

            return;

        }


        currentMembers =
            Array.isArray(data)
                ? data
                : [];


        renderMembers();


    } catch (error) {

        console.warn(
            "⚠️ Member loading error:",
            error
        );

        currentMembers =
            [];

        renderMembers();

    }

}


/* =========================================================
   RENDER MEMBERS
========================================================= */

function renderMembers(
    filter = ""
) {

    const container =
        $("#memberList");


    if (!container) {

        return;

    }


    let members =
        Array.isArray(
            currentMembers
        )
            ? currentMembers
            : [];


    const search =
        String(filter || "")
            .trim()
            .toLowerCase();


    if (search) {

        members =
            members.filter(
                member =>
                    getMemberName(
                        member
                    )
                        .toLowerCase()
                        .includes(search)
            );

    }


    const count =
        $("#memberCount");


    if (count) {

        count.textContent =
            String(
                members.length
            );

    }


    if (!members.length) {

        container.innerHTML = `
            <div class="empty-state">
                No community members found.
            </div>
        `;

        return;

    }


    const online =
        members.filter(
            member =>
                isMemberOnline(
                    member
                )
        );


    const offline =
        members.filter(
            member =>
                !isMemberOnline(
                    member
                )
        );


    let html =
        "";


    if (online.length) {

        html += `
            <div class="member-role-heading">
                Online — ${online.length}
            </div>
        `;


        html += online
            .map(
                member =>
                    renderMemberHTML(
                        member,
                        true
                    )
            )
            .join("");

    }


    if (offline.length) {

        html += `
            <div class="member-role-heading">
                Members — ${offline.length}
            </div>
        `;


        html += offline
            .map(
                member =>
                    renderMemberHTML(
                        member,
                        false
                    )
            )
            .join("");

    }


    container.innerHTML =
        html;

}


/* =========================================================
   MEMBER HTML
========================================================= */

function renderMemberHTML(
    member,
    online
) {

    const name =
        getMemberName(
            member
        );


    const role =
        member?.role ||
        member?.member_role ||
        "Student";


    const photo =
        member?.photo_url ||
        member?.avatar_url ||
        "";


    return `
        <div class="member-item">

            <div class="member-avatar">

                ${
                    photo
                        ? `
                            <img
                                src="${escapeHTML(photo)}"
                                alt="${escapeHTML(name)}"
                            >
                        `
                        : escapeHTML(
                            getInitials(name)
                        )
                }

                <span
                    class="presence-dot ${
                        online
                            ? "online"
                            : "offline"
                    }"
                ></span>

            </div>


            <div class="member-copy">

                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    ${escapeHTML(
                        String(role)
                            .replace(/_/g, " ")
                    )}
                </span>

            </div>

        </div>
    `;

}


/* =========================================================
   MEMBER HELPERS
========================================================= */

function getMemberName(
    member
) {

    return (
        member?.full_name ||
        member?.name ||
        member?.display_name ||
        member?.student_name ||
        member?.email?.split("@")[0] ||
        "Community Member"
    );

}


function isMemberOnline(
    member
) {

    if (
        member?.online === true ||
        member?.is_online === true
    ) {

        return true;

    }


    const userId =
        member?.user_id ||
        member?.student_id ||
        member?.id;


    return currentPresence.some(
        presence =>
            String(
                presence.user_id
            ) ===
            String(userId)
    );

}


/* =========================================================
   PRESENCE
========================================================= */

function setupPresence() {

    if (
        !currentUser?.id ||
        !supabase?.channel
    ) {

        return;

    }


    try {

        presenceRealtimeChannel =
            supabase.channel(
                "mwaniki-community-presence",
                {
                    config: {
                        presence: {
                            key:
                                currentUser.id
                        }
                    }
                }
            );


        presenceRealtimeChannel
            .on(
                "presence",
                {
                    event: "sync"
                },
                () => {

                    const state =
                        presenceRealtimeChannel
                            .presenceState();


                    currentPresence =
                        Object.values(
                            state
                        )
                            .flat();


                    renderMembers(
                        $("#memberSearchInput")
                            ?.value ||
                        ""
                    );

                }
            )
            .on(
                "presence",
                {
                    event: "join"
                },
                () => {

                    loadCommunityMembers();

                }
            )
            .on(
                "presence",
                {
                    event: "leave"
                },
                () => {

                    loadCommunityMembers();

                }
            )
            .subscribe(
                async status => {

                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        await presenceRealtimeChannel
                            .track({
                                user_id:
                                    currentUser.id,

                                name:
                                    getUserName(),

                                role:
                                    getUserRole(),

                                online:
                                    true,

                                joined_at:
                                    new Date()
                                        .toISOString()
                            });

                    }

                }
            );


    } catch (error) {

        console.warn(
            "⚠️ Presence setup failed:",
            error
        );

    }

}


async function updatePresence(
    status
) {

    if (
        !currentUser?.id
    ) {

        return;

    }


    try {

        const payload = {
            user_id:
                currentUser.id,

            status:
                status,

            last_seen:
                new Date()
                    .toISOString()
        };


        const {
            error
        } =
            await supabase
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
                "⚠️ Presence database update:",
                error.message
            );

        }

    } catch (error) {

        console.warn(
            "⚠️ Presence update failed:",
            error
        );

    }

}


/* =========================================================
   REALTIME
========================================================= */

function setupRealtime() {

    if (
        !supabase?.channel
    ) {

        return;

    }


    try {

        communityRealtimeChannel =
            supabase.channel(
                "mwaniki-community-chat"
            );


        communityRealtimeChannel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages"
                },
                payload => {

                    handleRealtimeMessage(
                        payload.new
                    );

                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "chat_messages"
                },
                payload => {

                    handleRealtimeMessageUpdate(
                        payload.new
                    );

                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_messages"
                },
                payload => {

                    handleRealtimeMessageDelete(
                        payload.old
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
                () => {

                    loadMessages();

                }
            )
            .subscribe(
                status => {

                    console.log(
                        "📡 Community realtime:",
                        status
                    );

                }
            );


    } catch (error) {

        console.warn(
            "⚠️ Realtime setup failed:",
            error
        );

    }

}


/* =========================================================
   REALTIME MESSAGE INSERT
========================================================= */

function handleRealtimeMessage(
    message
) {

    if (
        !message
    ) {

        return;

    }


    if (
        !messageBelongsToCurrentChannel(
            message
        )
    ) {

        registerUnreadForMessage(
            message
        );

        return;

    }


    const id =
        getMessageId(
            message
        );


    if (
        !id
    ) {

        return;

    }


    if (
        currentMessages.some(
            item =>
                getMessageId(item) ===
                id
        )
    ) {

        return;

    }


    currentMessages.push(
        message
    );


    renderMessages();


    if (
        String(
            message.user_id ||
            message.sender_id ||
            message.author_id
        ) !==
        String(
            currentUser?.id
        )
    ) {

        showToast(
            `${getMessageAuthorName(message)} sent a message.`
        );

    }


    scrollMessagesToBottom(
        true
    );

}


/* =========================================================
   REALTIME MESSAGE UPDATE
========================================================= */

function handleRealtimeMessageUpdate(
    message
) {

    const id =
        getMessageId(
            message
        );


    const index =
        currentMessages.findIndex(
            item =>
                getMessageId(item) ===
                id
        );


    if (index >= 0) {

        currentMessages[index] =
            message;

        renderMessages();

    }

}


/* =========================================================
   REALTIME MESSAGE DELETE
========================================================= */

function handleRealtimeMessageDelete(
    message
) {

    const id =
        getMessageId(
            message
        );


    currentMessages =
        currentMessages.filter(
            item =>
                getMessageId(item) !==
                id
        );


    renderMessages();

}


/* =========================================================
   CHANNEL MATCH
========================================================= */

function messageBelongsToCurrentChannel(
    message
) {

    if (
        !currentChannel
    ) {

        return false;

    }


    const databaseChannel =
        currentChannelRecord?.database;


    if (
        databaseChannel?.id !== undefined
    ) {

        const messageChannelId =
            message?.channel_id;


        if (
            messageChannelId !== undefined
        ) {

            return String(
                messageChannelId
            ) ===
            String(
                databaseChannel.id
            );

        }

    }


    const values = [
        message?.channel_slug,
        message?.channel_name,
        message?.channel
    ]
        .filter(
            value =>
                value !== null &&
                value !== undefined
        )
        .map(
            value =>
                String(value)
                    .toLowerCase()
        );


    if (!values.length) {

        /*
           Some schemas rely exclusively on
           channel_id. In that case, an INSERT
           without a channel field is treated as
           belonging to the current view only
           when we cannot prove otherwise.
        */

        return true;

    }


    return values.includes(
        currentChannel.slug.toLowerCase()
    ) ||
    values.includes(
        currentChannel.name.toLowerCase()
    );

}


/* =========================================================
   UNREAD
========================================================= */

function loadUnreadCounts() {

    try {

        const saved =
            localStorage.getItem(
                UNREAD_KEY
            );


        unreadCounts =
            saved
                ? JSON.parse(saved)
                : {};


        if (
            !unreadCounts ||
            typeof unreadCounts !==
                "object"
        ) {

            unreadCounts =
                {};

        }

    } catch (_) {

        unreadCounts =
            {};

    }


    renderUnreadCounts();

}


function saveUnreadCounts() {

    localStorage.setItem(
        UNREAD_KEY,
        JSON.stringify(
            unreadCounts
        )
    );


    renderUnreadCounts();

}


function registerUnreadForMessage(
    message
) {

    const channelSlug =
        resolveMessageChannelSlug(
            message
        );


    if (
        !channelSlug ||
        channelSlug ===
            currentChannel?.slug
    ) {

        return;

    }


    unreadCounts[channelSlug] =
        Number(
            unreadCounts[channelSlug] ||
            0
        ) + 1;


    saveUnreadCounts();


    updateCommunityNotificationBadge();

}


function clearUnread(
    channelSlug
) {

    if (
        unreadCounts[channelSlug]
    ) {

        delete unreadCounts[
            channelSlug
        ];

        saveUnreadCounts();

    }

}


function renderUnreadCounts() {

    $all(
        "[data-unread-for]"
    )
        .forEach(
            element => {

                const channel =
                    element.dataset.unreadFor;


                const count =
                    Number(
                        unreadCounts[
                            channel
                        ] || 0
                    );


                element.textContent =
                    count > 99
                        ? "99+"
                        : String(count);


                element.hidden =
                    count <= 0;

            }
        );


    [
        "general-chat",
        "announcements",
        "introductions"
    ]
        .forEach(
            channel => {

                const element =
                    $(
                        `#${channel.replace(
                            /-/g,
                            ""
                        )}Unread`
                    );


                if (!element) {

                    return;

                }


                const count =
                    Number(
                        unreadCounts[
                            channel
                        ] || 0
                    );


                element.textContent =
                    count > 99
                        ? "99+"
                        : String(count);


                element.hidden =
                    count <= 0;

            }
        );

}


function resolveMessageChannelSlug(
    message
) {

    const value =
        message?.channel_slug ||
        message?.channel_name ||
        message?.channel;


    if (!value) {

        return null;

    }


    const normalized =
        String(value)
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-");


    const known =
        DEFAULT_CHANNELS.find(
            channel =>
                channel.slug ===
                normalized ||
                channel.name
                    .toLowerCase() ===
                    String(value)
                        .toLowerCase()
                        .trim()
        );


    return (
        known?.slug ||
        normalized
    );

}


/* =========================================================
   READ STATUS
========================================================= */

async function markChannelRead() {

    if (
        !currentUser?.id ||
        !currentChannel
    ) {

        return;

    }


    try {

        const databaseChannel =
            currentChannelRecord?.database;


        const payload = {
            user_id:
                currentUser.id,

            channel_id:
                databaseChannel?.id ||
                null,

            last_read_at:
                new Date()
                    .toISOString()
        };


        const {
            error
        } =
            await supabase
                .from("chat_read_status")
                .upsert(
                    payload,
                    {
                        onConflict:
                            "user_id,channel_id"
                    }
                );


        if (error) {

            console.warn(
                "⚠️ Read status:",
                error.message
            );

        }

    } catch (error) {

        console.warn(
            "⚠️ Read status failed:",
            error
        );

    }

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function loadCommunityNotifications() {

    loadStoredNotifications();


    if (
        !currentUser?.id
    ) {

        updateCommunityNotificationBadge();

        return;

    }


    try {

        const {
            data,
            error
        } =
            await supabase
                .from(
                    "chat_notifications"
                )
                .select("*")
                .eq(
                    "user_id",
                    currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(50);


        if (
            !error &&
            Array.isArray(data)
        ) {

            notificationItems =
                data;

            saveStoredNotifications();

        }


    } catch (error) {

        console.warn(
            "⚠️ Community notifications:",
            error
        );

    }


    updateCommunityNotificationBadge();

}


function loadStoredNotifications() {

    try {

        const saved =
            localStorage.getItem(
                NOTIFICATIONS_KEY
            );


        notificationItems =
            saved
                ? JSON.parse(saved)
                : [];


        if (
            !Array.isArray(
                notificationItems
            )
        ) {

            notificationItems =
                [];

        }

    } catch (_) {

        notificationItems =
            [];

    }

}


function saveStoredNotifications() {

    try {

        localStorage.setItem(
            NOTIFICATIONS_KEY,
            JSON.stringify(
                notificationItems
                    .slice(0, 50)
            )
        );

    } catch (_) {

        /* Storage is optional. */

    }

}


function updateCommunityNotificationBadge() {

    const unreadChannels =
        Object.values(
            unreadCounts
        )
            .reduce(
                (
                    total,
                    value
                ) =>
                    total +
                    Number(value || 0),
                0
            );


    const unreadNotifications =
        notificationItems.filter(
            item =>
                !isNotificationRead(
                    item
                )
        ).length;


    const total =
        unreadChannels +
        unreadNotifications;


    const badge =
        $("#communityNotificationBadge");


    if (!badge) {

        return;

    }


    badge.textContent =
        total > 99
            ? "99+"
            : String(total);


    badge.hidden =
        total <= 0;

}


/* =========================================================
   NOTIFICATION READ
========================================================= */

function isNotificationRead(
    notification
) {

    return (
        notification?.read === true ||
        notification?.is_read === true
    );

}


/* =========================================================
   REALTIME NOTIFICATION
========================================================= */

function registerNotification(
    notification
) {

    if (!notification) {

        return;

    }


    notificationItems.unshift(
        notification
    );


    notificationItems =
        notificationItems.slice(
            0,
            50
        );


    saveStoredNotifications();


    updateCommunityNotificationBadge();

}


/* =========================================================
   MARK NOTIFICATIONS READ
========================================================= */

async function markAllNotificationsRead() {

    notificationItems =
        notificationItems.map(
            item => ({
                ...item,
                read: true,
                is_read: true
            })
        );


    saveStoredNotifications();


    if (
        currentUser?.id
    ) {

        try {

            await supabase
                .from(
                    "chat_notifications"
                )
                .update({
                    read: true,
                    is_read: true
                })
                .eq(
                    "user_id",
                    currentUser.id
                );

        } catch (error) {

            console.warn(
                "⚠️ Could not mark database notifications read:",
                error
            );

        }

    }


    updateCommunityNotificationBadge();


    renderNotificationPanel();

}


/* =========================================================
   SEARCH
========================================================= */

async function searchMessages(
    query
) {

    const results =
        $("#messageSearchResults");


    if (!results) {

        return;

    }


    const search =
        String(query || "")
            .trim();


    if (!search) {

        results.innerHTML =
            "";

        return;

    }


    results.innerHTML = `
        <div class="empty-state">
            Searching...
        </div>
    `;


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("chat_messages")
                .select("*")
                .ilike(
                    "content",
                    `%${search}%`
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(30);


        if (error) {

            throw error;

        }


        if (
            !Array.isArray(data) ||
            !data.length
        ) {

            results.innerHTML = `
                <div class="empty-state">
                    No matching messages found.
                </div>
            `;

            return;

        }


        results.innerHTML =
            data
                .map(
                    message => `
                        <div
                            class="search-result"
                            data-search-message-id="${escapeHTML(
                                getMessageId(message)
                            )}"
                        >

                            <div class="search-result-top">

                                <span class="search-result-name">
                                    ${escapeHTML(
                                        getMessageAuthorName(
                                            message
                                        )
                                    )}
                                </span>

                                <span class="search-result-time">
                                    ${escapeHTML(
                                        formatMessageTime(
                                            getMessageDate(
                                                message
                                            )
                                        )
                                    )}
                                </span>

                            </div>

                            <div class="search-result-text">
                                ${escapeHTML(
                                    getMessageContent(
                                        message
                                    )
                                )}
                            </div>

                        </div>
                    `
                )
                .join("");


        $all(
            "[data-search-message-id]"
        )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        () => {

                            const id =
                                element.dataset
                                    .searchMessageId;


                            const row =
                                $(
                                    `[data-message-id="${CSS.escape(id)}"]`
                                );


                            if (row) {

                                row.scrollIntoView({
                                    behavior:
                                        "smooth",
                                    block:
                                        "center"
                                });

                                row.style.background =
                                    "#e7f3f1";


                                setTimeout(
                                    () => {

                                        row.style.background =
                                            "";

                                    },
                                    1600
                                );

                            }

                        }
                    );

                }
            );


    } catch (error) {

        console.error(
            "❌ Message search failed:",
            error
        );


        results.innerHTML = `
            <div class="empty-state">
                Search is temporarily unavailable.
            </div>
        `;

    }

}


/* =========================================================
   ATTACHMENTS
========================================================= */

function handleAttachmentSelection(
    event
) {

    const files =
        Array.from(
            event.target.files ||
            []
        );


    if (!files.length) {

        return;

    }


    pendingAttachments =
        [
            ...pendingAttachments,
            ...files
        ];


    renderAttachmentPreview();


    event.target.value =
        "";

}


function renderAttachmentPreview() {

    const container =
        $("#attachmentPreview");


    if (!container) {

        return;

    }


    if (
        !pendingAttachments.length
    ) {

        container.hidden =
            true;

        container.innerHTML =
            "";

        return;

    }


    container.hidden =
        false;


    container.innerHTML =
        pendingAttachments
            .map(
                (file, index) => `
                    <div class="attachment-chip">

                        <span>
                            📎
                            ${escapeHTML(
                                file.name
                            )}
                        </span>

                        <button
                            type="button"
                            data-remove-attachment="${index}"
                        >
                            ×
                        </button>

                    </div>
                `
            )
            .join("");


    $all(
        "[data-remove-attachment]"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const index =
                            Number(
                                button.dataset
                                    .removeAttachment
                            );


                        pendingAttachments
                            .splice(
                                index,
                                1
                            );


                        renderAttachmentPreview();

                    }
                );

            }
        );

}


function clearPendingAttachments() {

    pendingAttachments =
        [];

    renderAttachmentPreview();

}


/* =========================================================
   TYPING
========================================================= */

function setupTypingIndicator() {

    const input =
        $("#messageInput");


    if (!input) {

        return;

    }


    input.addEventListener(
        "input",
        () => {

            if (
                !currentUser
            ) {

                return;

            }


            if (
                !isTyping
            ) {

                isTyping =
                    true;

            }


            clearTimeout(
                typingTimer
            );


            typingTimer =
                setTimeout(
                    stopTyping,
                    900
                );

        }
    );

}


function stopTyping() {

    isTyping =
        false;

}


/* =========================================================
   MESSAGE INPUT
========================================================= */

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
            145
        ) + "px";

}


function updateCharacterCount() {

    const input =
        $("#messageInput");

    const count =
        $("#characterCount");


    if (
        !input ||
        !count
    ) {

        return;

    }


    count.textContent =
        `${input.value.length}/4000`;

}


/* =========================================================
   SCROLL
========================================================= */

function scrollMessagesToBottom(
    smooth = true
) {

    const container =
        $("#messagesContainer");


    if (!container) {

        return;

    }


    requestAnimationFrame(
        () => {

            container.scrollTo({
                top:
                    container.scrollHeight,

                behavior:
                    smooth
                        ? "smooth"
                        : "auto"
            });

        }
    );

}


/* =========================================================
   MESSAGE CONTEXT MENU
========================================================= */

function openMessageContextMenu(
    x,
    y
) {

    const menu =
        $("#messageActionMenu");


    if (!menu) {

        return;

    }


    menu.hidden =
        false;


    const width =
        160;

    const height =
        190;


    menu.style.left =
        `${Math.min(
            x,
            window.innerWidth -
                width -
                10
        )}px`;


    menu.style.top =
        `${Math.min(
            y,
            window.innerHeight -
                height -
                10
        )}px`;

}


function closeMessageContextMenu() {

    const menu =
        $("#messageActionMenu");


    if (menu) {

        menu.hidden =
            true;

    }

}


/* =========================================================
   EMOJI PICKER
========================================================= */

function openEmojiPickerForComposer() {

    const picker =
        $("#emojiPicker");


    if (!picker) {

        return;

    }


    picker.hidden =
        !picker.hidden;


    if (!picker.hidden) {

        const button =
            $("#emojiButton");


        positionPickerNearButton(
            picker,
            button
        );

    }

}


function openEmojiPickerForReaction() {

    const picker =
        $("#emojiPicker");


    if (!picker) {

        return;

    }


    picker.hidden =
        false;


    const menu =
        $("#messageActionMenu");


    if (
        menu &&
        !menu.hidden
    ) {

        const rect =
            menu.getBoundingClientRect();


        picker.style.left =
            `${rect.left}px`;

        picker.style.top =
            `${rect.bottom + 5}px`;

    }

}


function positionPickerNearButton(
    picker,
    button
) {

    if (
        !button
    ) {

        return;

    }


    const rect =
        button.getBoundingClientRect();


    picker.style.left =
        `${Math.max(
            10,
            rect.right -
                220
        )}px`;


    picker.style.top =
        `${Math.max(
            10,
            rect.top -
                225
        )}px`;

}


/* =========================================================
   UI SETUP
========================================================= */

function setupInterface() {

    loadUnreadCounts();

    setupChannelButtons();

    setupCategoryButtons();

    setupComposer();

    setupSearch();

    setupMemberSearch();

    setupMobilePanels();

    setupNotifications();

    setupSettings();

    setupTypingIndicator();

    setupContextMenu();

    setupEmojiPicker();

    setupGlobalClicks();

    setupBeforeUnload();

}


/* =========================================================
   CHANNEL BUTTONS
========================================================= */

function setupChannelButtons() {

    $all(
        "[data-channel]"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        await openChannel(
                            button.dataset.channel
                        );

                    }
                );

            }
        );

}


/* =========================================================
   CATEGORY BUTTONS
========================================================= */

function setupCategoryButtons() {

    const categories = [
        [
            "#medicalCategoryButton",
            "#medicalChannels"
        ],
        [
            "#studyCategoryButton",
            "#studyChannels"
        ],
        [
            "#aiCategoryButton",
            "#aiChannels"
        ]
    ];


    categories.forEach(
        ([buttonSelector, groupSelector]) => {

            const button =
                $(buttonSelector);

            const group =
                $(groupSelector);


            if (
                !button ||
                !group
            ) {

                return;

            }


            button.addEventListener(
                "click",
                () => {

                    const collapsed =
                        group.classList.toggle(
                            "collapsed"
                        );


                    button.textContent =
                        collapsed
                            ? "+"
                            : "−";

                }
            );

        }
    );

}


/* =========================================================
   COMPOSER SETUP
========================================================= */

function setupComposer() {

    const form =
        $("#messageComposer");


    form?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendMessage();

        }
    );


    const input =
        $("#messageInput");


    input?.addEventListener(
        "input",
        () => {

            resizeMessageInput();

            updateCharacterCount();

        }
    );


    input?.addEventListener(
        "keydown",
        event => {

            const settings =
                loadSettings();


            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey &&
                settings.enterToSend
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    $("#cancelReplyButton")
        ?.addEventListener(
            "click",
            cancelReply
        );


    $("#attachmentButton")
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
            handleAttachmentSelection
        );


    $("#emojiButton")
        ?.addEventListener(
            "click",
            openEmojiPickerForComposer
        );

}


/* =========================================================
   SEARCH SETUP
========================================================= */

function setupSearch() {

    $("#searchButton")
        ?.addEventListener(
            "click",
            () => {

                const bar =
                    $("#messageSearchBar");


                if (!bar) {

                    return;

                }


                bar.hidden =
                    !bar.hidden;


                if (!bar.hidden) {

                    $("#messageSearchInput")
                        ?.focus();

                }

            }
        );


    $("#messageSearchInput")
        ?.addEventListener(
            "input",
            event => {

                clearTimeout(
                    searchTimer
                );


                searchTimer =
                    setTimeout(
                        () =>
                            searchMessages(
                                event.target.value
                            ),
                        250
                    );

            }
        );


    $("#clearMessageSearchButton")
        ?.addEventListener(
            "click",
            () => {

                const input =
                    $("#messageSearchInput");


                if (input) {

                    input.value =
                        "";

                }


                const results =
                    $("#messageSearchResults");


                if (results) {

                    results.innerHTML =
                        "";

                }

            }
        );

}


/* =========================================================
   MEMBER SEARCH
========================================================= */

function setupMemberSearch() {

    $("#memberSearchInput")
        ?.addEventListener(
            "input",
            event => {

                renderMembers(
                    event.target.value
                );

            }
        );

}


/* =========================================================
   MOBILE PANELS
========================================================= */

function setupMobilePanels() {

    $("#openSidebarButton")
        ?.addEventListener(
            "click",
            openMobileSidebar
        );


    $("#closeSidebarButton")
        ?.addEventListener(
            "click",
            closeMobileSidebar
        );


    $("#mobileOverlay")
        ?.addEventListener(
            "click",
            closeMobileSidebar
        );


    $("#memberPanelButton")
        ?.addEventListener(
            "click",
            () => {

                $("#memberSidebar")
                    ?.classList
                    .add("open");

            }
        );


    $("#closeMemberPanelButton")
        ?.addEventListener(
            "click",
            () => {

                $("#memberSidebar")
                    ?.classList
                    .remove("open");

            }
        );

}


function openMobileSidebar() {

    $("#communitySidebar")
        ?.classList
        .add("open");


    $("#mobileOverlay")
        ?.classList
        .add("active");


}


function closeMobileSidebar() {

    $("#communitySidebar")
        ?.classList
        .remove("open");


    $("#mobileOverlay")
        ?.classList
        .remove("active");

}


/* =========================================================
   NOTIFICATIONS SETUP
========================================================= */

function setupNotifications() {

    $("#notificationsButton")
        ?.addEventListener(
            "click",
            () => {

                renderNotificationPanel();

                const panel =
                    $("#communityNotificationPanel");


                if (panel) {

                    panel.hidden =
                        false;

                }

            }
        );


    $("#closeNotificationPanelButton")
        ?.addEventListener(
            "click",
            () => {

                $("#communityNotificationPanel")
                    .hidden =
                    true;

            }
        );


    $("#markNotificationsReadButton")
        ?.addEventListener(
            "click",
            markAllNotificationsRead
        );

}


/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotificationPanel() {

    const container =
        $("#communityNotificationContent");


    if (!container) {

        return;

    }


    if (
        !notificationItems.length
    ) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>
                    You're all caught up.
                </strong>

                <span>
                    New community activity will appear here.
                </span>
            </div>
        `;

        return;

    }


    container.innerHTML =
        notificationItems
            .map(
                item => `
                    <div
                        class="notification-item ${
                            isNotificationRead(item)
                                ? ""
                                : "unread"
                        }"
                    >

                        <strong>
                            ${escapeHTML(
                                item.title ||
                                item.type ||
                                "Community notification"
                            )}
                        </strong>

                        <p>
                            ${escapeHTML(
                                item.message ||
                                item.content ||
                                "New community activity."
                            )}
                        </p>

                    </div>
                `
            )
            .join("");

}


/* =========================================================
   SETTINGS
========================================================= */

function setupSettings() {

    $("#communitySettingsButton")
        ?.addEventListener(
            "click",
            () => {

                loadSettingsIntoUI();


                const panel =
                    $("#communitySettingsPanel");


                if (panel) {

                    panel.hidden =
                        false;

                }

            }
        );


    $("#closeSettingsPanelButton")
        ?.addEventListener(
            "click",
            () => {

                $("#communitySettingsPanel")
                    .hidden =
                    true;

            }
        );


    $("#enterToSendToggle")
        ?.addEventListener(
            "change",
            saveSettingsFromUI
        );


    $("#presenceToggle")
        ?.addEventListener(
            "change",
            saveSettingsFromUI
        );


    $("#communityNotificationsToggle")
        ?.addEventListener(
            "change",
            saveSettingsFromUI
        );


    loadSettingsIntoUI();

}


function loadSettings() {

    const defaults = {
        enterToSend:
            true,

        presence:
            true,

        notifications:
            true
    };


    try {

        const saved =
            localStorage.getItem(
                SETTINGS_KEY
            );


        if (!saved) {

            return defaults;

        }


        return {
            ...defaults,
            ...JSON.parse(saved)
        };

    } catch (_) {

        return defaults;

    }

}


function loadSettingsIntoUI() {

    const settings =
        loadSettings();


    if (
        $("#enterToSendToggle")
    ) {

        $("#enterToSendToggle")
            .checked =
            settings.enterToSend;

    }


    if (
        $("#presenceToggle")
    ) {

        $("#presenceToggle")
            .checked =
            settings.presence;

    }


    if (
        $("#communityNotificationsToggle")
    ) {

        $("#communityNotificationsToggle")
            .checked =
            settings.notifications;

    }

}


function saveSettingsFromUI() {

    const settings = {

        enterToSend:
            $("#enterToSendToggle")
                ?.checked ??
            true,

        presence:
            $("#presenceToggle")
                ?.checked ??
            true,

        notifications:
            $("#communityNotificationsToggle")
                ?.checked ??
            true

    };


    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(
            settings
        )
    );


    if (
        settings.presence
    ) {

        updatePresence(
            "online"
        );

    } else {

        updatePresence(
            "offline"
        );

    }


    showToast(
        "Community settings saved."
    );

}


/* =========================================================
   CONTEXT MENU SETUP
========================================================= */

function setupContextMenu() {

    $all(
        "#messageActionMenu [data-action]"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const action =
                            button.dataset.action;


                        if (
                            action ===
                            "reply"
                        ) {

                            startReply(
                                selectedMessageId
                            );

                        } else if (
                            action ===
                            "react"
                        ) {

                            openEmojiPickerForReaction();

                        } else if (
                            action ===
                            "copy"
                        ) {

                            await copyMessage(
                                selectedMessageId
                            );

                        } else if (
                            action ===
                            "report"
                        ) {

                            await reportMessage(
                                selectedMessageId
                            );

                        }


                        closeMessageContextMenu();

                    }
                );

            }
        );

}


/* =========================================================
   REPORT
========================================================= */

async function reportMessage(
    messageId
) {

    if (
        !currentUser?.id ||
        !messageId
    ) {

        return;

    }


    const reason =
        window.prompt(
            "Why are you reporting this message?"
        );


    if (
        !reason?.trim()
    ) {

        return;

    }


    try {

        const {
            error
        } =
            await supabase
                .from("chat_reports")
                .insert({
                    message_id:
                        messageId,

                    reported_by:
                        currentUser.id,

                    reason:
                        reason.trim()
                });


        if (error) {

            throw error;

        }


        showToast(
            "Message report submitted."
        );


    } catch (error) {

        console.error(
            "❌ Report failed:",
            error
        );


        showToast(
            error?.message ||
            "The report could not be submitted."
        );

    }

}


/* =========================================================
   EMOJI SETUP
========================================================= */

function setupEmojiPicker() {

    $all(
        "#emojiPicker [data-emoji]"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const emoji =
                            button.dataset.emoji;


                        if (
                            selectedMessageId
                        ) {

                            toggleReaction(
                                selectedMessageId,
                                emoji
                            );

                            selectedMessageId =
                                null;

                        } else {

                            insertEmojiIntoComposer(
                                emoji
                            );

                        }


                        $("#emojiPicker")
                            .hidden =
                            true;

                    }
                );

            }
        );

}


function insertEmojiIntoComposer(
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


    input.focus();


    const cursor =
        start +
        emoji.length;


    input.setSelectionRange(
        cursor,
        cursor
    );


    updateCharacterCount();

    resizeMessageInput();

}


/* =========================================================
   GLOBAL CLICKS
========================================================= */

function setupGlobalClicks() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target;


            if (
                !target.closest(
                    "#messageActionMenu"
                ) &&
                !target.closest(
                    ".message-action-button"
                )
            ) {

                closeMessageContextMenu();

            }


            if (
                !target.closest(
                    "#emojiPicker"
                ) &&
                !target.closest(
                    "#emojiButton"
                ) &&
                !target.closest(
                    "[data-message-action='react']"
                )
            ) {

                const picker =
                    $("#emojiPicker");


                if (picker) {

                    picker.hidden =
                        true;

                }

            }

        }
    );

}


/* =========================================================
   BEFORE UNLOAD
========================================================= */

function setupBeforeUnload() {

    window.addEventListener(
        "beforeunload",
        () => {

            updatePresence(
                "offline"
            );

        }
    );

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message
) {

    const toast =
        $("#communityToast");


    if (!toast) {

        return;

    }


    clearTimeout(
        toastTimer
    );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2800
        );

}


/* =========================================================
   AUTH SCREEN
========================================================= */

function showAuthScreen(
    message
) {

    const screen =
        $("#communityAuthScreen");


    if (!screen) {

        return;

    }


    screen.hidden =
        false;


    const text =
        $("#communityAuthMessage");


    if (text) {

        text.textContent =
            message;

    }


    $("#communityLoginButton")
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "./index.html";

            },
            {
                once: true
            }
        );

}


function hideAuthScreen() {

    const screen =
        $("#communityAuthScreen");


    if (screen) {

        screen.hidden =
            true;

    }

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "pagehide",
    () => {

        try {

            if (
                presenceRealtimeChannel
            ) {

                presenceRealtimeChannel
                    .untrack();

            }


            if (
                communityRealtimeChannel
            ) {

                supabase.removeChannel(
                    communityRealtimeChannel
                );

            }


            if (
                presenceRealtimeChannel
            ) {

                supabase.removeChannel(
                    presenceRealtimeChannel
                );

            }

        } catch (_) {

            /* Ignore cleanup errors. */

        }

    }
);


/* =========================================================
   INITIALIZE
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeCommunity
    );

} else {

    initializeCommunity();

}


/* =========================================================
   PUBLIC COMMUNITY API
========================================================= */

window.mwanikiCommunity = {

    getCurrentUser() {

        return currentUser;

    },


    getCurrentStudent() {

        return currentStudent;

    },


    getCurrentChannel() {

        return currentChannel;

    },


    getMessages() {

        return currentMessages;

    },


    async refreshMessages() {

        await loadMessages();

    },


    async refreshMembers() {

        await loadCommunityMembers();

    },


    async openChannel(
        slug
    ) {

        await openChannel(
            slug
        );

    },


    sendMessage() {

        return sendMessage();

    }

};
