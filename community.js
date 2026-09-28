
/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   PHASE 1 — REALTIME COMMUNITY
   ============================================================

   Uses:
   • Existing supabase.js
   • Supabase Auth
   • chat_communities
   • chat_channels
   • chat_community_members
   • chat_channel_members
   • chat_messages
   • chat_message_reactions
   • chat_read_status
   • chat_presence
   • chat_notifications

   DOES NOT MODIFY:
   • Mwaniki AI
   • Turbo AI
   • Dashboard
   • Existing Inbox
   • Courses
   • Notes
   • Quizzes
   ============================================================ */


/* ============================================================
   GLOBAL STATE
   ============================================================ */

const CommunityState = {

    user: null,

    community: null,

    channels: [],

    members: [],

    currentChannel: null,

    messages: [],

    messageIds: new Set(),

    reactions: {},

    presence: {},

    unreadNotifications: 0,

    subscriptions: [],

    initialized: false,

    loadingMessages: false,

    sendingMessage: false,

    searchTimer: null

};


/* ============================================================
   DOM HELPER
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}


/* ============================================================
   SUPABASE CLIENT
   ============================================================ */

function getSupabaseClient() {

    /*
       Your existing supabase.js should expose one of the
       following common names.

       Priority:
       1. window.supabaseClient
       2. window.supabase
       3. window.sb
    */

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ) {
        return window.supabaseClient;
    }

    if (
        window.supabase &&
        typeof window.supabase.from === "function"
    ) {
        return window.supabase;
    }

    if (
        window.sb &&
        typeof window.sb.from === "function"
    ) {
        return window.sb;
    }

    return null;
}


const supabaseClient = getSupabaseClient();


/* ============================================================
   SAFE HTML
   ============================================================ */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

    console.log(
        "🚀 Mwaniki Scholars Community engine loaded"
    );

    bindUI();

    if (!supabaseClient) {

        showToast(
            "Supabase client was not found. Check supabase.js.",
            "error"
        );

        console.error(
            "❌ Community: Supabase client unavailable."
        );

        return;
    }

    await initializeCommunity();

});


/* ============================================================
   INITIALIZE COMMUNITY
   ============================================================ */

async function initializeCommunity() {

    try {

        const {
            data: {
                session
            },
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!session) {

            console.warn(
                "⚠️ No active session."
            );

            redirectToLogin();

            return;
        }

        CommunityState.user = session.user;

        console.log(
            "🔐 Community user:",
            CommunityState.user.id
        );


        await loadCommunity();

        if (!CommunityState.community) {

            throw new Error(
                "Mwaniki Scholars community was not found."
            );
        }


        await ensureCommunityMembership();


        await loadChannels();

        await loadMembers();

        await loadNotifications();

        await initializePresence();

        await subscribeToRealtime();


        CommunityState.initialized = true;

        console.log(
            "✅ Mwaniki Scholars Community initialized"
        );


        if (CommunityState.channels.length > 0) {

            const generalChannel =
                CommunityState.channels.find(
                    channel =>
                        channel.slug === "general-chat"
                );

            await selectChannel(
                generalChannel ||
                CommunityState.channels[0]
            );

        }


        enableComposer();

    } catch (error) {

        console.error(
            "❌ Community initialization failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to initialize community.",
            "error"
        );

    }

}


/* ============================================================
   LOAD COMMUNITY
   ============================================================ */

async function loadCommunity() {

    const {
        data,
        error
    } = await supabaseClient
        .from("chat_communities")
        .select("*")
        .eq("slug", "mwaniki-scholars")
        .eq("is_active", true)
        .maybeSingle();

    if (error) {
        throw error;
    }

    CommunityState.community = data;

    if (data) {

        $("communityName").textContent =
            data.name;

    }

}


/* ============================================================
   ENSURE COMMUNITY MEMBERSHIP
   ============================================================ */

async function ensureCommunityMembership() {

    if (!CommunityState.community) {
        return;
    }

    const communityId =
        CommunityState.community.id;


    const {
        data: existingMember,
        error: existingError
    } = await supabaseClient
        .from("chat_community_members")
        .select("*")
        .eq("community_id", communityId)
        .eq("user_id", CommunityState.user.id)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }


    if (existingMember) {

        return;
    }


    const {
        error: insertError
    } = await supabaseClient
        .from("chat_community_members")
        .insert({

            community_id: communityId,

            user_id: CommunityState.user.id,

            role: "student"

        });


    if (insertError) {

        /*
           If membership insertion is blocked by RLS,
           the user may already have been added manually.
        */

        console.warn(
            "⚠️ Could not automatically create community membership:",
            insertError
        );

        showToast(
            "Your account could not automatically join the community. An administrator may need to add you.",
            "error"
        );

        return;
    }


    console.log(
        "✅ User joined Mwaniki Scholars Community"
    );

}


/* ============================================================
   LOAD CHANNELS
   ============================================================ */

async function loadChannels() {

    const {
        data,
        error
    } = await supabaseClient
        .from("chat_channels")
        .select("*")
        .eq(
            "community_id",
            CommunityState.community.id
        )
        .eq("is_active", true)
        .eq("is_archived", false)
        .order("position", {
            ascending: true
        });

    if (error) {
        throw error;
    }

    CommunityState.channels =
        data || [];

    renderChannels();

}


/* ============================================================
   RENDER CHANNELS
   ============================================================ */

function renderChannels() {

    const container =
        $("channelList");

    if (!container) {
        return;
    }


    if (!CommunityState.channels.length) {

        container.innerHTML =
            `<div class="channel-empty">
                No channels available.
             </div>`;

        return;
    }


    container.innerHTML =
        CommunityState.channels
            .map(channel => {

                const active =
                    CommunityState.currentChannel &&
                    CommunityState.currentChannel.id === channel.id
                        ? "active"
                        : "";

                const icon =
                    getChannelIcon(
                        channel.channel_type
                    );

                return `
                    <button
                        class="channel-item ${active}"
                        type="button"
                        data-channel-id="${escapeHTML(channel.id)}"
                    >

                        <span class="channel-symbol">
                            ${icon}
                        </span>

                        <span class="channel-item-name">
                            ${escapeHTML(channel.name)}
                        </span>

                    </button>
                `;

            })
            .join("");


    container
        .querySelectorAll(".channel-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const channel =
                        CommunityState.channels.find(
                            item =>
                                item.id ===
                                button.dataset.channelId
                        );

                    if (channel) {

                        await selectChannel(
                            channel
                        );

                        closeSidebarMobile();

                    }

                }
            );

        });

}


/* ============================================================
   CHANNEL ICON
   ============================================================ */

function getChannelIcon(type) {

    switch (type) {

        case "announcement":
            return "📢";

        case "study":
            return "🎓";

        case "course":
            return "📚";

        case "voice":
            return "🔊";

        default:
            return "#";

    }

}


/* ============================================================
   SELECT CHANNEL
   ============================================================ */

async function selectChannel(channel) {

    if (!channel) {
        return;
    }


    CommunityState.currentChannel =
        channel;


    updateChannelHeader();

    renderChannels();

    clearMessages();

    disableComposer();

    await loadChannelMessages(
        channel.id
    );

    await loadChannelReactions(
        channel.id
    );

    await markChannelRead(
        channel.id
    );

    enableComposer();

}


/* ============================================================
   UPDATE CHANNEL HEADER
   ============================================================ */

function updateChannelHeader() {

    const channel =
        CommunityState.currentChannel;

    if (!channel) {
        return;
    }


    const icon =
        getChannelIcon(
            channel.channel_type
        );


    $("currentChannelIcon").textContent =
        icon;

    $("chatHeaderIcon").textContent =
        icon;


    $("currentChannelName").textContent =
        channel.name;

    $("chatHeaderTitle").textContent =
        channel.name;


    const description =
        channel.description ||
        "Mwaniki Scholars community discussion.";


    $("currentChannelDescription").textContent =
        description;

    $("chatHeaderDescription").textContent =
        description;


    $("messageInput").placeholder =
        `Message #${channel.name}`;


    $("channelInfoTitle").textContent =
        `#${channel.name}`;

}


/* ============================================================
   LOAD MESSAGES
   ============================================================ */

async function loadChannelMessages(channelId) {

    CommunityState.loadingMessages = true;


    const {
        data,
        error
    } = await supabaseClient
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
            created_at,
            edited_at,
            updated_at
        `)
        .eq("channel_id", channelId)
        .eq("is_deleted", false)
        .is("parent_message_id", null)
        .order("created_at", {
            ascending: true
        })
        .limit(200);

    if (error) {

        CommunityState.loadingMessages = false;

        throw error;
    }


    CommunityState.messages =
        data || [];

    CommunityState.messageIds =
        new Set(
            CommunityState.messages.map(
                message => message.id
            )
        );


    await enrichMessageUsers();

    renderMessages();

    scrollMessagesToBottom();


    CommunityState.loadingMessages = false;

}


/* ============================================================
   ENRICH MESSAGE USERS
   ============================================================ */

async function enrichMessageUsers() {

    const userIds = [
        ...new Set(
            CommunityState.messages
                .map(message => message.user_id)
                .filter(Boolean)
        )
    ];


    if (!userIds.length) {
        return;
    }


    /*
       The existing project has a students table.
       We try to retrieve common profile fields without
       assuming one exact schema shape.
    */

    const {
        data,
        error
    } = await supabaseClient
        .from("students")
        .select("*")
        .in("id", userIds);


    if (error) {

        console.warn(
            "⚠️ Could not load student profiles for messages:",
            error.message
        );

        return;
    }


    CommunityState.messages =
        CommunityState.messages.map(
            message => {

                const profile =
                    (data || []).find(
                        student =>
                            student.id ===
                            message.user_id
                    );

                return {
                    ...message,
                    profile
                };

            }
        );

}


/* ============================================================
   RENDER MESSAGES
   ============================================================ */

function renderMessages() {

    const container =
        $("messagesContainer");

    if (!container) {
        return;
    }


    if (!CommunityState.messages.length) {

        container.innerHTML = `
            <div class="messages-welcome">

                <div class="welcome-icon">
                    ${escapeHTML(
                        getChannelIcon(
                            CommunityState.currentChannel?.channel_type
                        )
                    )}
                </div>

                <h2>
                    Welcome to #${escapeHTML(
                        CommunityState.currentChannel?.name ||
                        "community"
                    )}
                </h2>

                <p>
                    This is the beginning of this channel.
                    Start the conversation.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        CommunityState.messages
            .map(renderMessage)
            .join("");


    bindMessageActions();

}


/* ============================================================
   RENDER ONE MESSAGE
   ============================================================ */

function renderMessage(message) {

    const profile =
        message.profile || {};

    const name =
        getStudentDisplayName(
            profile,
            message.user_id
        );

    const avatar =
        getStudentAvatar(
            profile,
            name
        );

    const role =
        getStudentRole(
            message.user_id
        );

    const time =
        formatMessageTime(
            message.created_at
        );


    const content =
        message.is_deleted
            ? "Message deleted."
            : message.content || "";


    const ownMessage =
        message.user_id ===
        CommunityState.user.id;


    const reactions =
        CommunityState.reactions[
            message.id
        ] || [];


    return `
        <article
            class="message"
            data-message-id="${escapeHTML(message.id)}"
        >

            <div class="message-avatar-wrap">

                <img
                    class="message-avatar"
                    src="${escapeHTML(avatar)}"
                    alt="${escapeHTML(name)}"
                >

            </div>


            <div class="message-body">

                <div class="message-meta">

                    <span class="message-author">
                        ${escapeHTML(name)}
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

                    <span class="message-time">
                        ${escapeHTML(time)}
                    </span>

                </div>


                <div class="message-content">
                    ${escapeHTML(content)}
                </div>


                ${
                    reactions.length
                        ? `
                            <div class="message-reactions">

                                ${renderReactionSummary(
                                    reactions
                                )}

                            </div>
                          `
                        : ""
                }


                ${
                    message.is_edited
                        ? `
                            <span class="message-time">
                                edited
                            </span>
                          `
                        : ""
                }

            </div>


            <div class="message-actions">

                <button
                    class="message-action reaction-action"
                    type="button"
                    data-message-id="${escapeHTML(message.id)}"
                    title="React"
                >
                    😊
                </button>

                <button
                    class="message-action reply-action"
                    type="button"
                    data-message-id="${escapeHTML(message.id)}"
                    title="Reply"
                >
                    ↩
                </button>

                ${
                    ownMessage
                        ? `
                            <button
                                class="message-action delete-action"
                                type="button"
                                data-message-id="${escapeHTML(message.id)}"
                                title="Delete"
                            >
                                🗑
                            </button>
                          `
                        : ""
                }

            </div>

        </article>
    `;

}


/* ============================================================
   STUDENT DISPLAY NAME
   ============================================================ */

function getStudentDisplayName(
    profile,
    userId
) {

    const possibleNames = [

        profile.full_name,

        profile.name,

        profile.student_name,

        profile.username,

        profile.display_name

    ];


    const found =
        possibleNames.find(
            value =>
                value &&
                String(value).trim()
        );


    if (found) {
        return String(found).trim();
    }


    if (
        CommunityState.user &&
        userId ===
        CommunityState.user.id
    ) {

        return (
            CommunityState.user.user_metadata
                ?.full_name ||
            CommunityState.user.email
                ?.split("@")[0] ||
            "Student"
        );

    }


    return "Student";

}


/* ============================================================
   STUDENT AVATAR
   ============================================================ */

function getStudentAvatar(
    profile,
    name
) {

    const possibleUrls = [

        profile.photo_url,

        profile.avatar_url,

        profile.profile_image,

        profile.image_url

    ];


    const found =
        possibleUrls.find(
            value =>
                value &&
                String(value).trim()
        );


    if (found) {
        return String(found);
    }


    return createAvatarDataURL(name);

}


/* ============================================================
   AVATAR FALLBACK
   ============================================================ */

function createAvatarDataURL(name) {

    const initials =
        String(name || "Student")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(
                word =>
                    word.charAt(0).toUpperCase()
            )
            .join("") || "S";


    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100"
            height="100"
        >

            <rect
                width="100"
                height="100"
                rx="50"
                fill="#087f73"
            />

            <text
                x="50"
                y="58"
                text-anchor="middle"
                font-family="Arial, sans-serif"
                font-size="35"
                font-weight="700"
                fill="white"
            >
                ${escapeXMLForSVG(initials)}
            </text>

        </svg>
    `;


    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );

}


function escapeXMLForSVG(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}


/* ============================================================
   ROLE
   ============================================================ */

function getStudentRole() {

    /*
       Phase 1 deliberately does not assume that the
       students table has a role column.

       Community role information will be loaded separately
       from chat_community_members when available.
    */

    const member =
        CommunityState.members.find(
            item =>
                item.user_id ===
                arguments[0]
        );


    if (!member) {
        return "";
    }


    if (
        member.role === "student"
    ) {
        return "";
    }


    return member.role;

}


/* ============================================================
   MESSAGE TIME
   ============================================================ */

function formatMessageTime(timestamp) {

    if (!timestamp) {
        return "";
    }


    const date =
        new Date(timestamp);


    return date.toLocaleString(
        [],
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );

}


/* ============================================================
   LOAD REACTIONS
   ============================================================ */

async function loadChannelReactions(channelId) {

    const messageIds =
        CommunityState.messages
            .map(message => message.id);


    CommunityState.reactions = {};


    if (!messageIds.length) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("chat_message_reactions")
        .select("*")
        .in(
            "message_id",
            messageIds
        );


    if (error) {

        console.warn(
            "⚠️ Reaction loading failed:",
            error.message
        );

        return;
    }


    (data || []).forEach(
        reaction => {

            if (
                !CommunityState.reactions[
                    reaction.message_id
                ]
            ) {

                CommunityState.reactions[
                    reaction.message_id
                ] = [];

            }

            CommunityState.reactions[
                reaction.message_id
            ].push(reaction);

        }
    );


    renderMessages();

}


/* ============================================================
   REACTION SUMMARY
   ============================================================ */

function renderReactionSummary(
    reactions
) {

    const counts = {};


    reactions.forEach(
        reaction => {

            const key =
                reaction.reaction;

            counts[key] =
                (counts[key] || 0) + 1;

        }
    );


    return Object.entries(counts)
        .map(
            ([reaction, count]) => {

                return `
                    <button
                        class="reaction-chip"
                        type="button"
                        data-reaction="${escapeHTML(reaction)}"
                    >
                        ${escapeHTML(reaction)}
                        ${count}
                    </button>
                `;

            }
        )
        .join("");

}


/* ============================================================
   LOAD MEMBERS
   ============================================================ */

async function loadMembers() {

    const {
        data,
        error
    } = await supabaseClient
        .from("chat_community_members")
        .select("*")
        .eq(
            "community_id",
            CommunityState.community.id
        )
        .eq("is_banned", false);


    if (error) {

        console.warn(
            "⚠️ Community member loading failed:",
            error.message
        );

        CommunityState.members = [];

        renderMembers();

        return;
    }


    CommunityState.members =
        data || [];


    await enrichMemberProfiles();

    renderMembers();

}


/* ============================================================
   ENRICH MEMBER PROFILES
   ============================================================ */

async function enrichMemberProfiles() {

    const userIds =
        CommunityState.members
            .map(member => member.user_id)
            .filter(Boolean);


    if (!userIds.length) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("students")
        .select("*")
        .in("id", userIds);


    if (error) {

        console.warn(
            "⚠️ Member profile lookup failed:",
            error.message
        );

        return;
    }


    CommunityState.members =
        CommunityState.members.map(
            member => {

                const profile =
                    (data || []).find(
                        student =>
                            student.id ===
                            member.user_id
                    );

                return {
                    ...member,
                    profile
                };

            }
        );

}


/* ============================================================
   RENDER MEMBERS
   ============================================================ */

function renderMembers(
    filter = ""
) {

    const container =
        $("membersList");

    if (!container) {
        return;
    }


    let members =
        CommunityState.members;


    const normalizedFilter =
        String(filter)
            .trim()
            .toLowerCase();


    if (normalizedFilter) {

        members =
            members.filter(
                member => {

                    const name =
                        getStudentDisplayName(
                            member.profile || {},
                            member.user_id
                        );

                    return name
                        .toLowerCase()
                        .includes(
                            normalizedFilter
                        );

                }
            );

    }


    $("memberCount").textContent =
        `${CommunityState.members.length} ${
            CommunityState.members.length === 1
                ? "member"
                : "members"
        }`;


    if (!members.length) {

        container.innerHTML =
            `<div class="member-empty">
                No members found.
             </div>`;

        return;
    }


    container.innerHTML =
        members
            .map(renderMember)
            .join("");

}


/* ============================================================
   RENDER MEMBER
   ============================================================ */

function renderMember(member) {

    const profile =
        member.profile || {};

    const name =
        getStudentDisplayName(
            profile,
            member.user_id
        );

    const avatar =
        getStudentAvatar(
            profile,
            name
        );

    const status =
        CommunityState.presence[
            member.user_id
        ] ||
        (
            member.user_id ===
            CommunityState.user?.id
                ? "online"
                : "offline"
        );


    return `
        <div
            class="member"
            data-member-name="${escapeHTML(
                name.toLowerCase()
            )}"
        >

            <div class="member-avatar-wrap">

                <img
                    class="member-avatar"
                    src="${escapeHTML(avatar)}"
                    alt="${escapeHTML(name)}"
                >

                <span
                    class="member-presence ${escapeHTML(status)}"
                ></span>

            </div>


            <div class="member-info">

                <div class="member-name">
                    ${escapeHTML(name)}
                </div>

                <div class="member-role">
                    ${escapeHTML(
                        formatRole(
                            member.role
                        )
                    )}
                </div>

            </div>

        </div>
    `;

}


/* ============================================================
   ROLE FORMAT
   ============================================================ */

function formatRole(role) {

    if (!role) {
        return "Student";
    }

    return String(role)
        .replace(/_/g, " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );

}


/* ============================================================
   PRESENCE
   ============================================================ */

async function initializePresence() {

    const userId =
        CommunityState.user.id;


    await supabaseClient
        .from("chat_presence")
        .upsert(
            {
                user_id: userId,
                status: "online",
                last_seen_at: new Date().toISOString()
            },
            {
                onConflict: "user_id"
            }
        );


    CommunityState.presence[
        userId
    ] = "online";


    updateSidebarUser();


    window.addEventListener(
        "beforeunload",
        () => {

            /*
               Browser unload requests are not guaranteed,
               but the realtime system will eventually detect
               disconnects. We still attempt the update.
            */

            supabaseClient
                .from("chat_presence")
                .update({
                    status: "offline",
                    last_seen_at:
                        new Date().toISOString()
                })
                .eq(
                    "user_id",
                    userId
                );

        }
    );

}


/* ============================================================
   UPDATE SIDEBAR USER
   ============================================================ */

function updateSidebarUser() {

    const user =
        CommunityState.user;


    if (!user) {
        return;
    }


    const metadata =
        user.user_metadata || {};


    const name =
        metadata.full_name ||
        metadata.name ||
        user.email?.split("@")[0] ||
        "Student";


    $("sidebarUserName").textContent =
        name;

    $("sidebarUserStatus").textContent =
        "Online";


    $("sidebarPresenceDot")
        .className =
        "presence-dot online";


    const avatar =
        metadata.avatar_url ||
        metadata.picture;


    if (avatar) {

        $("sidebarAvatar").src =
            avatar;

    } else {

        $("sidebarAvatar").src =
            createAvatarDataURL(name);

    }

}


/* ============================================================
   REALTIME
   ============================================================ */

async function subscribeToRealtime() {

    /*
       Remove any previous subscriptions.
    */

    CommunityState.subscriptions
        .forEach(
            channel => {

                try {
                    supabaseClient
                        .removeChannel(channel);
                } catch (_) {}

            }
        );


    CommunityState.subscriptions = [];


    /*
       MESSAGE REALTIME
    */

    const messageChannel =
        supabaseClient
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
            .subscribe(
                status => {

                    console.log(
                        "📡 Message realtime:",
                        status
                    );

                }
            );


    CommunityState.subscriptions
        .push(messageChannel);


    /*
       REACTIONS
    */

    const reactionChannel =
        supabaseClient
            .channel(
                "mwaniki-community-reactions"
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_message_reactions"
                },
                payload => {

                    handleRealtimeReaction(
                        payload
                    );

                }
            )
            .subscribe();


    CommunityState.subscriptions
        .push(reactionChannel);


    /*
       PRESENCE
    */

    const presenceChannel =
        supabaseClient
            .channel(
                "mwaniki-community-presence"
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_presence"
                },
                payload => {

                    handleRealtimePresence(
                        payload
                    );

                }
            )
            .subscribe();


    CommunityState.subscriptions
        .push(presenceChannel);


    /*
       NOTIFICATIONS
    */

    const notificationChannel =
        supabaseClient
            .channel(
                "mwaniki-community-notifications"
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_notifications",
                    filter:
                        `user_id=eq.${CommunityState.user.id}`
                },
                payload => {

                    CommunityState.unreadNotifications++;

                    updateNotificationBadge();

                    showToast(
                        payload.new.title ||
                        "New notification",
                        "info"
                    );

                }
            )
            .subscribe();


    CommunityState.subscriptions
        .push(notificationChannel);


    console.log(
        "📡 Mwaniki Community realtime subscriptions ready"
    );

}


/* ============================================================
   REALTIME MESSAGE
   ============================================================ */

async function handleRealtimeMessage(
    message
) {

    if (!message) {
        return;
    }


    /*
       Ignore messages from other channels.
    */

    if (
        !CommunityState.currentChannel ||
        message.channel_id !==
        CommunityState.currentChannel.id
    ) {

        return;

    }


    /*
       Ignore deleted messages.
    */

    if (message.is_deleted) {
        return;
    }


    /*
       Ignore thread replies in main channel.
    */

    if (message.parent_message_id) {
        return;
    }


    /*
       Prevent duplicate insertion.
    */

    if (
        CommunityState.messageIds
            .has(message.id)
    ) {

        return;

    }


    CommunityState.messageIds
        .add(message.id);


    /*
       Get profile for the new message.
    */

    try {

        const {
            data
        } = await supabaseClient
            .from("students")
            .select("*")
            .eq(
                "id",
                message.user_id
            )
            .maybeSingle();

        message.profile =
            data || null;

    } catch (_) {}


    CommunityState.messages
        .push(message);


    CommunityState.messages.sort(
        (a, b) =>
            new Date(a.created_at) -
            new Date(b.created_at)
    );


    renderMessages();

    scrollMessagesToBottom();


    /*
       If another student sent the message,
       update read/unread behavior.
    */

    if (
        message.user_id !==
        CommunityState.user.id
    ) {

        /*
           The message is currently visible, so we mark
           the channel read after rendering.
        */

        await markChannelRead(
            message.channel_id
        );

    }

}


/* ============================================================
   REALTIME MESSAGE UPDATE
   ============================================================ */

function handleRealtimeMessageUpdate(
    updatedMessage
) {

    const index =
        CommunityState.messages.findIndex(
            message =>
                message.id ===
                updatedMessage.id
        );


    if (index === -1) {
        return;
    }


    CommunityState.messages[index] = {
        ...CommunityState.messages[index],
        ...updatedMessage
    };


    if (updatedMessage.is_deleted) {

        CommunityState.messages =
            CommunityState.messages.filter(
                message =>
                    message.id !==
                    updatedMessage.id
            );

        CommunityState.messageIds.delete(
            updatedMessage.id
        );

    }


    renderMessages();

}


/* ============================================================
   REALTIME REACTION
   ============================================================ */

async function handleRealtimeReaction(
    payload
) {

    const messageId =
        payload.new?.message_id ||
        payload.old?.message_id;


    if (!messageId) {
        return;
    }


    const messageExists =
        CommunityState.messageIds
            .has(messageId);


    if (!messageExists) {
        return;
    }


    await refreshMessageReactions(
        messageId
    );

}


/* ============================================================
   REFRESH REACTIONS
   ============================================================ */

async function refreshMessageReactions(
    messageId
) {

    const {
        data,
        error
    } = await supabaseClient
        .from("chat_message_reactions")
        .select("*")
        .eq(
            "message_id",
            messageId
        );


    if (error) {
        return;
    }


    CommunityState.reactions[
        messageId
    ] = data || [];


    renderMessages();

}


/* ============================================================
   REALTIME PRESENCE
   ============================================================ */

function handleRealtimePresence(
    payload
) {

    const row =
        payload.new ||
        payload.old;


    if (!row?.user_id) {
        return;
    }


    CommunityState.presence[
        row.user_id
    ] =
        row.status ||
        "offline";


    renderMembers();


    if (
        row.user_id ===
        CommunityState.user.id
    ) {

        updateSidebarUser();

    }

}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage() {

    if (
        CommunityState.sendingMessage ||
        !CommunityState.currentChannel ||
        !CommunityState.user
    ) {

        return;

    }


    const input =
        $("messageInput");


    const content =
        input.value.trim();


    if (!content) {
        return;
    }


    CommunityState.sendingMessage =
        true;


    input.disabled = true;

    $("sendMessageButton")
        .disabled = true;


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("chat_messages")
            .insert({
                channel_id:
                    CommunityState.currentChannel.id,

                user_id:
                    CommunityState.user.id,

                content,

                message_type:
                    "text"
            })
            .select()
            .single();


        if (error) {
            throw error;
        }


        /*
           Realtime normally inserts the message into
           the interface. We do not manually add it here,
           avoiding duplicate messages.
        */

        input.value = "";


        console.log(
            "✅ Message sent:",
            data.id
        );

    } catch (error) {

        console.error(
            "❌ Message send failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to send message.",
            "error"
        );

    } finally {

        CommunityState.sendingMessage =
            false;

        enableComposer();

        input.focus();

    }

}


/* ============================================================
   DELETE MESSAGE
   ============================================================ */

async function deleteMessage(
    messageId
) {

    const message =
        CommunityState.messages.find(
            item =>
                item.id ===
                messageId
        );


    if (!message) {
        return;
    }


    if (
        message.user_id !==
        CommunityState.user.id
    ) {

        showToast(
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
    } = await supabaseClient
        .from("chat_messages")
        .update({
            is_deleted: true,
            deleted_at:
                new Date().toISOString(),
            content: "Message deleted."
        })
        .eq(
            "id",
            messageId
        )
        .eq(
            "user_id",
            CommunityState.user.id
        );


    if (error) {

        showToast(
            error.message ||
            "Unable to delete message.",
            "error"
        );

        return;
    }


    showToast(
        "Message deleted.",
        "success"
    );

}


/* ============================================================
   ADD REACTION
   ============================================================ */

async function addReaction(
    messageId,
    reaction = "👍"
) {

    if (!CommunityState.user) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("chat_message_reactions")
        .upsert(
            {
                message_id: messageId,

                user_id:
                    CommunityState.user.id,

                reaction
            },
            {
                onConflict:
                    "message_id,user_id,reaction"
            }
        );


    if (error) {

        console.error(
            "Reaction failed:",
            error
        );

        showToast(
            error.message ||
            "Unable to add reaction.",
            "error"
        );

        return;
    }


    await refreshMessageReactions(
        messageId
    );

}


/* ============================================================
   MESSAGE ACTIONS
   ============================================================ */

function bindMessageActions() {

    document
        .querySelectorAll(".reaction-action")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    addReaction(
                        button.dataset.messageId,
                        "👍"
                    );

                }
            );

        });


    document
        .querySelectorAll(".delete-action")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteMessage(
                        button.dataset.messageId
                    );

                }
            );

        });


    document
        .querySelectorAll(".reply-action")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    /*
                       Thread UI is intentionally prepared for
                       Phase 2. For now, focus the composer and
                       identify the message.
                    */

                    const message =
                        CommunityState.messages.find(
                            item =>
                                item.id ===
                                button.dataset.messageId
                        );


                    if (!message) {
                        return;
                    }


                    $("messageInput").focus();


                    showToast(
                        "Thread replies are being prepared for the next community phase.",
                        "info"
                    );

                }
            );

        });


    document
        .querySelectorAll(".reaction-chip")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const messageElement =
                        button.closest(
                            ".message"
                        );


                    if (!messageElement) {
                        return;
                    }


                    addReaction(
                        messageElement.dataset.messageId,
                        button.dataset.reaction
                    );

                }
            );

        });

}


/* ============================================================
   READ STATUS
   ============================================================ */

async function markChannelRead(
    channelId
) {

    if (
        !CommunityState.user ||
        !channelId
    ) {
        return;
    }


    const lastMessage =
        CommunityState.messages[
            CommunityState.messages.length - 1
        ];


    try {

        await supabaseClient
            .from("chat_read_status")
            .upsert(
                {
                    channel_id:
                        channelId,

                    user_id:
                        CommunityState.user.id,

                    last_read_message_id:
                        lastMessage?.id ||
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
            "⚠️ Could not update read status:",
            error
        );

    }

}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function loadNotifications() {

    if (!CommunityState.user) {
        return;
    }


    const {
        count,
        error
    } = await supabaseClient
        .from("chat_notifications")
        .select(
            "id",
            {
                count: "exact",
                head: true
            }
        )
        .eq(
            "user_id",
            CommunityState.user.id
        )
        .eq(
            "is_read",
            false
        );


    if (error) {

        console.warn(
            "⚠️ Notification count failed:",
            error.message
        );

        return;
    }


    CommunityState.unreadNotifications =
        count || 0;


    updateNotificationBadge();

}


/* ============================================================
   NOTIFICATION BADGE
   ============================================================ */

function updateNotificationBadge() {

    const badge =
        $("notificationBadge");


    if (!badge) {
        return;
    }


    const count =
        CommunityState.unreadNotifications;


    if (count <= 0) {

        badge.classList.add(
            "hidden"
        );

        badge.textContent =
            "0";

        return;
    }


    badge.classList.remove(
        "hidden"
    );


    badge.textContent =
        count > 99
            ? "99+"
            : String(count);

}


/* ============================================================
   OPEN NOTIFICATIONS
   ============================================================ */

async function openNotifications() {

    if (!CommunityState.user) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("chat_notifications")
        .select("*")
        .eq(
            "user_id",
            CommunityState.user.id
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        )
        .limit(30);


    if (error) {

        showToast(
            error.message ||
            "Unable to load notifications.",
            "error"
        );

        return;
    }


    if (!data?.length) {

        showToast(
            "You have no community notifications.",
            "info"
        );

        return;
    }


    const unread =
        data.filter(
            notification =>
                !notification.is_read
        );


    CommunityState.unreadNotifications =
        unread.length;


    updateNotificationBadge();


    /*
       Phase 1 keeps notification interaction simple.
       Mark displayed notifications as read.
    */

    const unreadIds =
        unread.map(
            notification =>
                notification.id
        );


    if (unreadIds.length) {

        await supabaseClient
            .from("chat_notifications")
            .update({
                is_read: true,
                read_at:
                    new Date().toISOString()
            })
            .in(
                "id",
                unreadIds
            );

        CommunityState.unreadNotifications =
            0;

        updateNotificationBadge();

    }


    showToast(
        `${data.length} recent notification${
            data.length === 1
                ? ""
                : "s"
        }.`,
        "info"
    );

}


/* ============================================================
   SEARCH
   ============================================================ */

async function searchCommunity(
    searchTerm
) {

    const resultsContainer =
        $("searchResults");


    const term =
        String(searchTerm)
            .trim();


    if (!term) {

        resultsContainer.textContent =
            "Enter a search term to find community messages.";

        return;
    }


    resultsContainer.textContent =
        "Searching...";


    const {
        data,
        error
    } = await supabaseClient
        .from("chat_messages")
        .select(`
            id,
            channel_id,
            user_id,
            content,
            created_at
        `)
        .ilike(
            "content",
            `%${term}%`
        )
        .eq(
            "is_deleted",
            false
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        )
        .limit(50);


    if (error) {

        resultsContainer.textContent =
            error.message ||
            "Search failed.";

        return;
    }


    if (!data?.length) {

        resultsContainer.textContent =
            "No matching messages found.";

        return;
    }


    resultsContainer.innerHTML =
        data.map(
            message => {

                const channel =
                    CommunityState.channels.find(
                        item =>
                            item.id ===
                            message.channel_id
                    );


                return `
                    <div
                        class="search-result"
                        data-channel-id="${escapeHTML(
                            message.channel_id
                        )}"
                        data-message-id="${escapeHTML(
                            message.id
                        )}"
                    >

                        <div>

                            <span class="search-result-channel">
                                #${escapeHTML(
                                    channel?.name ||
                                    "unknown"
                                )}
                            </span>

                            <span class="search-result-author">
                                ${escapeHTML(
                                    formatMessageTime(
                                        message.created_at
                                    )
                                )}
                            </span>

                        </div>

                        <div class="search-result-content">
                            ${escapeHTML(
                                message.content
                            )}
                        </div>

                    </div>
                `;

            }
        )
        .join("");


    resultsContainer
        .querySelectorAll(".search-result")
        .forEach(result => {

            result.addEventListener(
                "click",
                async () => {

                    const channel =
                        CommunityState.channels.find(
                            item =>
                                item.id ===
                                result.dataset.channelId
                        );


                    if (channel) {

                        await selectChannel(
                            channel
                        );

                        closeSearchModal();

                    }

                }
            );

        });

}


/* ============================================================
   CREATE CHANNEL
   ============================================================ */

async function createChannel(
    event
) {

    event.preventDefault();


    if (
        !CommunityState.community ||
        !CommunityState.user
    ) {
        return;
    }


    const nameInput =
        $("newChannelName");

    const descriptionInput =
        $("newChannelDescription");

    const typeInput =
        $("newChannelType");

    const errorElement =
        $("createChannelError");


    errorElement.classList.add(
        "hidden"
    );


    const rawName =
        nameInput.value.trim();


    if (!rawName) {

        errorElement.textContent =
            "Enter a channel name.";

        errorElement.classList.remove(
            "hidden"
        );

        return;
    }


    const slug =
        slugify(rawName);


    if (!slug) {

        errorElement.textContent =
            "Please enter a valid channel name.";

        errorElement.classList.remove(
            "hidden"
        );

        return;
    }


    /*
       Find current user's community role.
    */

    const member =
        CommunityState.members.find(
            item =>
                item.user_id ===
                CommunityState.user.id
        );


    const role =
        member?.role ||
        "student";


    if (
        ![
            "moderator",
            "tutor",
            "admin",
            "super_admin"
        ].includes(role)
    ) {

        errorElement.textContent =
            "Only authorized community staff can create channels.";

        errorElement.classList.remove(
            "hidden"
        );

        return;
    }


    const maxPosition =
        CommunityState.channels.reduce(
            (
                highest,
                channel
            ) =>
                Math.max(
                    highest,
                    Number(
                        channel.position || 0
                    )
                ),
            -1
        );


    const {
        data,
        error
    } = await supabaseClient
        .from("chat_channels")
        .insert({
            community_id:
                CommunityState.community.id,

            name: rawName,

            slug,

            description:
                descriptionInput.value.trim() ||
                null,

            channel_type:
                typeInput.value,

            position:
                maxPosition + 1,

            created_by:
                CommunityState.user.id
        })
        .select()
        .single();


    if (error) {

        errorElement.textContent =
            error.message ||
            "Unable to create channel.";

        errorElement.classList.remove(
            "hidden"
        );

        return;
    }


    CommunityState.channels
        .push(data);


    CommunityState.channels.sort(
        (a, b) =>
            Number(a.position) -
            Number(b.position)
    );


    renderChannels();


    closeCreateChannelModal();


    nameInput.value = "";

    descriptionInput.value = "";


    showToast(
        `#${rawName} created.`,
        "success"
    );


    await selectChannel(data);

}


/* ============================================================
   SLUGIFY
   ============================================================ */

function slugify(value) {

    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100);

}


/* ============================================================
   CHANNEL INFO
   ============================================================ */

function openChannelInfo() {

    const channel =
        CommunityState.currentChannel;


    if (!channel) {
        return;
    }


    $("channelInfoTitle").textContent =
        `#${channel.name}`;


    $("channelInfoContent").innerHTML = `

        <div class="channel-info-stat">

            <span>
                Channel
            </span>

            <strong>
                #${escapeHTML(channel.name)}
            </strong>

        </div>


        <div class="channel-info-stat">

            <span>
                Type
            </span>

            <strong>
                ${escapeHTML(
                    formatRole(
                        channel.channel_type
                    )
                )}
            </strong>

        </div>


        <div class="channel-info-stat">

            <span>
                Messages loaded
            </span>

            <strong>
                ${CommunityState.messages.length}
            </strong>

        </div>


        <p>
            ${
                escapeHTML(
                    channel.description ||
                    "No channel description."
                )
            }
        </p>

    `;


    openModal(
        "channelInfoModal"
    );

}


/* ============================================================
   UI BINDINGS
   ============================================================ */

function bindUI() {

    /*
       Message form
    */

    $("messageForm")
        .addEventListener(
            "submit",
            event => {

                event.preventDefault();

                sendMessage();

            }
        );


    /*
       Enter sends message.
       Shift + Enter remains available for future
       multiline composer support.
    */

    $("messageInput")
        .addEventListener(
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


    /*
       Send button state
    */

    $("messageInput")
        .addEventListener(
            "input",
            () => {

                $("sendMessageButton")
                    .disabled =
                    !(
                        $("messageInput")
                            .value
                            .trim()
                    );

            }
        );


    /*
       Sidebar
    */

    $("openSidebarButton")
        .addEventListener(
            "click",
            openSidebarMobile
        );


    $("closeSidebarButton")
        .addEventListener(
            "click",
            closeSidebarMobile
        );


    $("mobileOverlay")
        .addEventListener(
            "click",
            () => {

                closeSidebarMobile();

                closeMembersMobile();

            }
        );


    /*
       Members panel on tablet/mobile
    */

    $("memberCount")
        .addEventListener(
            "click",
            () => {}
        );


    $("memberSearchInput")
        .addEventListener(
            "input",
            event => {

                renderMembers(
                    event.target.value
                );

            }
        );


    /*
       Notifications
    */

    $("notificationButton")
        .addEventListener(
            "click",
            openNotifications
        );


    /*
       Search
    */

    $("searchButton")
        .addEventListener(
            "click",
            () => {

                openModal(
                    "searchModal"
                );

                setTimeout(
                    () =>
                        $("communitySearchInput")
                            .focus(),
                    50
                );

            }
        );


    $("communitySearchSubmit")
        .addEventListener(
            "click",
            () =>
                searchCommunity(
                    $("communitySearchInput").value
                )
        );


    $("communitySearchInput")
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    searchCommunity(
                        event.target.value
                    );

                }

            }
        );


    $("closeSearchModal")
        .addEventListener(
            "click",
            closeSearchModal
        );


    /*
       Channel info
    */

    $("channelInfoButton")
        .addEventListener(
            "click",
            openChannelInfo
        );


    $("closeChannelInfoModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "channelInfoModal"
                )
        );


    /*
       Create channel
    */

    $("createChannelButton")
        .addEventListener(
            "click",
            openCreateChannelModal
        );


    $("closeCreateChannelModal")
        .addEventListener(
            "click",
            () =>
                closeModal(
                    "createChannelModal"
                )
        );


    $("createChannelForm")
        .addEventListener(
            "submit",
            createChannel
        );


    /*
       Special study buttons
       currently route to matching real channels
       when they exist.
    */

    document
        .querySelectorAll(
            "[data-special-channel]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    const type =
                        button.dataset.specialChannel;


                    if (
                        type === "home"
                    ) {

                        const channel =
                            CommunityState.channels.find(
                                item =>
                                    item.slug ===
                                    "general-chat"
                            );

                        if (channel) {

                            await selectChannel(
                                channel
                            );

                        }

                        return;
                    }


                    if (
                        type === "study"
                    ) {

                        const channel =
                            CommunityState.channels.find(
                                item =>
                                    item.slug ===
                                    "study-groups"
                            );

                        if (channel) {

                            await selectChannel(
                                channel
                            );

                        }

                        return;
                    }


                    if (
                        type === "assignments"
                    ) {

                        const channel =
                            CommunityState.channels.find(
                                item =>
                                    item.slug ===
                                    "assignment-help"
                            );

                        if (channel) {

                            await selectChannel(
                                channel
                            );

                        }

                    }

                }
            );

        });


    /*
       Close modal when backdrop clicked
    */

    document
        .querySelectorAll(
            ".modal-backdrop"
        )
        .forEach(
            backdrop => {

                backdrop.addEventListener(
                    "click",
                    () => {

                        const modal =
                            backdrop.closest(
                                ".modal"
                            );

                        if (modal) {

                            closeModal(
                                modal.id
                            );

                        }

                    }
                );

            }
        );


    /*
       Keyboard escape
    */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                document
                    .querySelectorAll(
                        ".modal:not(.hidden)"
                    )
                    .forEach(
                        modal =>
                            closeModal(
                                modal.id
                            )
                    );

                closeSidebarMobile();

                closeMembersMobile();

            }

        }
    );


    /*
       Attachments placeholder
    */

    $("attachmentButton")
        .addEventListener(
            "click",
            () => {

                showToast(
                    "File attachments will be enabled in the next community phase.",
                    "info"
                );

            }
        );


    /*
       Emoji placeholder
    */

    $("emojiButton")
        .addEventListener(
            "click",
            () => {

                $("messageInput").value +=
                    " 😊";

                $("messageInput").focus();

                $("sendMessageButton")
                    .disabled = false;

            }
        );


    /*
       User settings
    */

    $("userSettingsButton")
        .addEventListener(
            "click",
            () => {

                showToast(
                    "Profile and community settings will be connected to the Mwaniki profile system.",
                    "info"
                );

            }
        );

}


/* ============================================================
   COMPOSER CONTROL
   ============================================================ */

function enableComposer() {

    if (!CommunityState.currentChannel) {
        return;
    }


    $("messageInput").disabled =
        false;

    $("sendMessageButton").disabled =
        !(
            $("messageInput")
                .value
                .trim()
        );

}


function disableComposer() {

    $("messageInput").disabled =
        true;

    $("sendMessageButton").disabled =
        true;

}


/* ============================================================
   CLEAR MESSAGES
   ============================================================ */

function clearMessages() {

    CommunityState.messages = [];

    CommunityState.messageIds =
        new Set();

    CommunityState.reactions = {};


    $("messagesContainer").innerHTML = "";

}


/* ============================================================
   SCROLL
   ============================================================ */

function scrollMessagesToBottom() {

    const container =
        $("messagesContainer");


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


/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */

function openSidebarMobile() {

    $("communitySidebar")
        .classList.add(
            "mobile-open"
        );

    $("mobileOverlay")
        .classList.add(
            "active"
        );

}


function closeSidebarMobile() {

    $("communitySidebar")
        .classList.remove(
            "mobile-open"
        );

    $("mobileOverlay")
        .classList.remove(
            "active"
        );

}


/* ============================================================
   MOBILE MEMBERS
   ============================================================ */

function openMembersMobile() {

    $("membersPanel")
        .classList.add(
            "mobile-open"
        );

    $("mobileOverlay")
        .classList.add(
            "active"
        );

}


function closeMembersMobile() {

    $("membersPanel")
        .classList.remove(
            "mobile-open"
        );

    $("mobileOverlay")
        .classList.remove(
            "active"
        );

}


/* ============================================================
   MODAL HELPERS
   ============================================================ */

function openModal(id) {

    const modal =
        $(id);


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


function closeModal(id) {

    const modal =
        $(id);


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


function closeSearchModal() {

    closeModal(
        "searchModal"
    );

}


function openCreateChannelModal() {

    const member =
        CommunityState.members.find(
            item =>
                item.user_id ===
                CommunityState.user.id
        );


    const role =
        member?.role ||
        "student";


    if (
        ![
            "moderator",
            "tutor",
            "admin",
            "super_admin"
        ].includes(role)
    ) {

        showToast(
            "Only tutors, moderators and administrators can create channels.",
            "error"
        );

        return;
    }


    openModal(
        "createChannelModal"
    );

    setTimeout(
        () =>
            $("newChannelName")
                .focus(),
        50
    );

}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(
    message,
    type = "info"
) {

    const container =
        $("toastContainer");


    if (!container) {
        return;
    }


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.textContent =
        message;


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateY(7px)";


            setTimeout(
                () => {

                    toast.remove();

                },
                180
            );

        },
        3500
    );

}


/* ============================================================
   LOGIN REDIRECT
   ============================================================ */

function redirectToLogin() {

    const currentPath =
        window.location.pathname;


    const returnUrl =
        encodeURIComponent(
            currentPath
        );


    /*
       Your existing project has a student login system.
       We prefer studentLogin.html if present.
    */

    window.location.href =
        `studentLogin.html?redirect=${returnUrl}`;

}


/* ============================================================
   AUTH STATE CHANGES
   ============================================================ */

if (supabaseClient) {

    supabaseClient.auth
        .onAuthStateChange(
            async (
                event,
                session
            ) => {

                console.log(
                    "🔐 Community auth state:",
                    event
                );


                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    window.location.href =
                        "studentLogin.html";

                    return;
                }


                if (
                    event ===
                    "SIGNED_IN" &&
                    session
                ) {

                    CommunityState.user =
                        session.user;

                }

            }
        );

}


/* ============================================================
   WINDOW VISIBILITY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (
                CommunityState.user
            ) {

                CommunityState.presence[
                    CommunityState.user.id
                ] = "online";


                try {

                    await supabaseClient
                        .from("chat_presence")
                        .upsert(
                            {
                                user_id:
                                    CommunityState.user.id,

                                status:
                                    "online",

                                last_seen_at:
                                    new Date().toISOString()
                            },
                            {
                                onConflict:
                                    "user_id"
                            }
                        );

                } catch (_) {}

            }

        }

    }
);


/* ============================================================
   PERIODIC PRESENCE HEARTBEAT
   ============================================================ */

setInterval(
    async () => {

        if (
            !CommunityState.user ||
            !supabaseClient
        ) {
            return;
        }


        try {

            await supabaseClient
                .from("chat_presence")
                .upsert(
                    {
                        user_id:
                            CommunityState.user.id,

                        status:
                            "online",

                        last_seen_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "user_id"
                    }
                );

        } catch (_) {}

    },
    60000
);


/* ============================================================
   DEBUG ACCESS
   ============================================================ */

window.MwanikiCommunity =
    CommunityState;


console.log(
    "🟢 Mwaniki Community JavaScript ready"
);

