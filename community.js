/* ============================================================
   MWANIKI SCHOLARS
   COMMUNITY ENGINE
   ------------------------------------------------------------
   Single clean community controller.

   Responsibilities:
   - Authentication/profile
   - Communities/channels
   - Members/presence
   - Messages/replies/reactions
   - Attachments/voice notes
   - Emoji picker
   - Typing indicator
   - Call recipient picker
   - Incoming call invitations

   WebRTC is NOT implemented here.
   The WebRTC engine remains community-call.js.
   ============================================================ */

import { supabase } from "./supabase.js";


/* ============================================================
   STATE
   ============================================================ */

const state = {

    user: null,
    profile: null,

    communities: [],
    currentCommunity: null,

    channels: [],
    currentChannel: null,

    members: [],
    presence: new Map(),

    messages: [],

    /* Persistent subscriptions */
    presenceChannel: null,
    messageChannel: null,
    incomingCallChannel: null,
    attachmentChannel: null,

    selectedCallUsers: new Set(),

    callType: "video",

    replyTo: null,

    pendingFiles: [],

    typingTimer: null,

    typingUsers: new Map(),

    incomingCall: null,

    initialized: false,

    switchingCommunity: false
};


/* ============================================================
   DOM HELPER
   ============================================================ */

const $ = id =>
    document.getElementById(id);


/* ============================================================
   BASIC HELPERS
   ============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function initials(name) {

    const text =
        String(name || "Mwaniki Scholar")
            .trim();

    if (!text) {
        return "MS";
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


function userName(user) {

    if (!user) {
        return "Mwaniki Scholar";
    }

    return (
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "Mwaniki Scholar"
    );
}


function profileName(profile) {

    return (
        profile?.full_name ||
        profile?.name ||
        profile?.display_name ||
        "Mwaniki Scholar"
    );
}


function profileAvatar(profile) {

    return (
        profile?.avatar_url ||
        profile?.photo_url ||
        profile?.image_url ||
        ""
    );
}


function formatTime(value) {

    if (!value) {
        return "";
    }

    const date =
        new Date(value);

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
        setTimeout(
            () => {
                toast.classList.add("hidden");
            },
            3000
        );
}


function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent =
            value ?? "";
    }
}


function safeImageStyle(url) {

    if (!url) {
        return "";
    }

    return `
        background-image:url("${escapeHTML(url)}");
        background-size:cover;
        background-position:center;
    `;
}


/* ============================================================
   AUTH
   ============================================================ */

async function loadCurrentUser() {

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!data?.user) {
        throw new Error(
            "You must be signed in."
        );
    }

    state.user =
        data.user;
}


async function loadProfile() {

    if (!state.user) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("id", state.user.id)
        .maybeSingle();

    if (error) {

        console.warn(
            "Profile lookup:",
            error.message
        );
    }

    state.profile =
        data || null;

    const name =
        profileName(state.profile) !==
        "Mwaniki Scholar"
            ? profileName(state.profile)
            : userName(state.user);

    const avatar =
        profileAvatar(
            state.profile
        );

    setText(
        "sidebarProfileName",
        name
    );

    const header =
        $("headerProfileAvatar");

    const sidebar =
        $("sidebarProfileAvatar");

    if (header) {

        if (avatar) {

            header.style.backgroundImage =
                `url("${avatar}")`;

            header.style.backgroundSize =
                "cover";

            header.style.backgroundPosition =
                "center";

            header.textContent =
                "";

        } else {

            header.style.backgroundImage =
                "";

            header.textContent =
                initials(name);
        }
    }

    if (sidebar) {

        if (avatar) {

            sidebar.style.backgroundImage =
                `url("${avatar}")`;

            sidebar.style.backgroundSize =
                "cover";

            sidebar.style.backgroundPosition =
                "center";

            sidebar.textContent =
                "";

        } else {

            sidebar.style.backgroundImage =
                "";

            sidebar.textContent =
                initials(name);
        }
    }
}


/* ============================================================
   COMMUNITY LOADING
   ============================================================ */

async function loadCommunities() {

    const {
        data,
        error
    } = await supabase
        .from("chat_communities")
        .select("*")
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Communities:",
            error
        );

        state.communities = [];

        renderCommunityRail();
        renderCommunityModal();

        return;
    }

    state.communities =
        data || [];

    /*
     * Always prefer Mwaniki Scholars.
     * Never default to Mwaniki Gaming merely
     * because it happens to be first.
     */

    const main =
        state.communities.find(
            community =>
                String(
                    community.name || ""
                )
                    .trim()
                    .toLowerCase() ===
                "mwaniki scholars"
        );

    state.currentCommunity =
        main ||
        state.communities[0] ||
        null;

    renderCommunityRail();
    renderCommunityModal();

    if (state.currentCommunity) {

        setText(
            "sidebarCommunityName",
            state.currentCommunity.name
        );

        setText(
            "currentCommunityName",
            state.currentCommunity.name
        );
    }
}


/* ============================================================
   COMMUNITY RAIL
   ============================================================ */

function renderCommunityRail() {

    const rail =
        $("communityRail");

    if (!rail) {
        return;
    }

    rail.innerHTML = "";

    state.communities.forEach(
        community => {

            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "community-icon";

            button.title =
                community.name ||
                "Community";

            button.textContent =
                initials(
                    community.name
                );

            if (
                state.currentCommunity &&
                String(community.id) ===
                String(
                    state.currentCommunity.id
                )
            ) {

                button.classList.add(
                    "active"
                );
            }

            button.addEventListener(
                "click",
                async () => {

                    await switchCommunity(
                        community
                    );
                }
            );

            rail.appendChild(
                button
            );
        }
    );
}


/* ============================================================
   COMMUNITY MODAL
   ============================================================ */

function renderCommunityModal() {

    const list =
        $("communityList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!state.communities.length) {

        list.innerHTML = `
            <div class="community-empty">
                No communities available.
            </div>
        `;

        return;
    }

    state.communities.forEach(
        community => {

            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "community-modal-item";

            button.innerHTML = `
                <div class="avatar avatar-medium">
                    ${escapeHTML(
                        initials(
                            community.name
                        )
                    )}
                </div>

                <div>
                    <strong>
                        ${escapeHTML(
                            community.name ||
                            "Community"
                        )}
                    </strong>

                    <span>
                        Discussion community
                    </span>
                </div>
            `;

            button.addEventListener(
                "click",
                async () => {

                    closeCommunityModal();

                    await switchCommunity(
                        community
                    );
                }
            );

            list.appendChild(
                button
            );
        }
    );
}


/* ============================================================
   COMMUNITY SWITCH
   ============================================================ */

async function switchCommunity(
    community
) {

    if (!community) {
        return;
    }

    if (
        state.switchingCommunity
    ) {
        return;
    }

    if (
        state.currentCommunity &&
        String(
            state.currentCommunity.id
        ) ===
        String(community.id)
    ) {
        return;
    }

    state.switchingCommunity =
        true;

    try {

        await removeMessageSubscription();

        await removePresenceSubscription();

        state.currentCommunity =
            community;

        state.currentChannel =
            null;

        state.channels =
            [];

        state.members =
            [];

        state.messages =
            [];

        state.presence.clear();

        state.typingUsers.clear();

        state.replyTo =
            null;

        cancelReply();

        renderCommunityRail();

        setText(
            "sidebarCommunityName",
            community.name
        );

        setText(
            "currentCommunityName",
            community.name
        );

        await loadChannels();

        await loadMembers();

        await loadPresence();

        subscribePresence();

        await setMyPresence(
            "online"
        );

    } catch (error) {

        console.error(
            "Community switch:",
            error
        );

        showToast(
            "Unable to switch community."
        );

    } finally {

        state.switchingCommunity =
            false;
    }
}


/* ============================================================
   CHANNELS
   ============================================================ */

async function loadChannels() {

    if (!state.currentCommunity) {
        return;
    }

    setText(
        "sidebarCommunityName",
        state.currentCommunity.name
    );

    setText(
        "currentCommunityName",
        state.currentCommunity.name
    );

    const {
        data,
        error
    } = await supabase
        .from("chat_channels")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Channels:",
            error
        );

        state.channels =
            [];

        renderChannels();

        showToast(
            "Unable to load community channels."
        );

        return;
    }

    state.channels =
        data || [];

    renderChannels();

    if (!state.channels.length) {

        state.currentChannel =
            null;

        return;
    }

    const general =
        state.channels.find(
            channel =>
                String(
                    channel.name ||
                    channel.title ||
                    ""
                )
                    .trim()
                    .toLowerCase() ===
                "general"
        );

    state.currentChannel =
        general ||
        state.channels[0];

    renderChannels();

    await selectChannel(
        state.currentChannel,
        false
    );
}


function renderChannels() {

    const list =
        $("channelList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!state.channels.length) {

        list.innerHTML = `
            <div class="channel-empty">
                No discussion channels found.
            </div>
        `;

        return;
    }

    state.channels.forEach(
        channel => {

            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "channel-button";

            button.dataset.channelId =
                channel.id;

            if (
                state.currentChannel &&
                String(channel.id) ===
                String(
                    state.currentChannel.id
                )
            ) {

                button.classList.add(
                    "active"
                );
            }

            const name =
                channel.name ||
                channel.title ||
                "Discussion";

            button.innerHTML = `
                <span class="channel-symbol">
                    #
                </span>

                <span class="channel-name">
                    ${escapeHTML(name)}
                </span>
            `;

            button.addEventListener(
                "click",
                async () => {

                    await selectChannel(
                        channel
                    );
                }
            );

            list.appendChild(
                button
            );
        }
    );
}


/* ============================================================
   CHANNEL SELECTION
   ============================================================ */

async function selectChannel(
    channel,
    scroll = true
) {

    if (!channel) {
        return;
    }

    /*
     * Prevent selecting a channel from a different community.
     */

    if (
        state.currentCommunity &&
        channel.community_id &&
        String(channel.community_id) !==
        String(state.currentCommunity.id)
    ) {
        return;
    }

    await removeMessageSubscription();

    state.currentChannel =
        channel;

    state.messages =
        [];

    state.typingUsers.clear();

    cancelReply();

    renderChannels();

    const channelName =
        channel.name ||
        channel.title ||
        "Discussion";

    setText(
        "chatChannelTitle",
        channelName
    );

    setText(
        "currentChannelName",
        channelName
    );

    setText(
        "chatChannelDescription",
        channel.description ||
        "Academic discussion and collaboration"
    );

    const input =
        $("messageInput");

    if (input) {

        input.placeholder =
            `Message #${channelName}`;
    }

    await loadMembers();

    await loadMessages();

    subscribeCurrentChannel();

    if (scroll) {
        scrollMessagesToBottom();
    }
}


/* ============================================================
   MEMBERS
   ============================================================ */

async function loadMembers() {

    if (!state.currentCommunity) {
        return;
    }

    const {
        data: memberships,
        error
    } = await supabase
        .from("chat_community_members")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        );

    if (error) {

        console.error(
            "Community members:",
            error
        );

        state.members =
            [];

        renderMembers();

        return;
    }

    const rows =
        memberships || [];

    const userIds =
        [
            ...new Set(
                rows
                    .map(
                        row =>
                            row.user_id
                    )
                    .filter(Boolean)
            )
        ];

    /*
     * If the community membership table is empty,
     * keep the UI honest rather than inventing members.
     */

    if (!userIds.length) {

        state.members =
            [];

        renderMembers();

        return;
    }

    const {
        data: profiles,
        error: profileError
    } = await supabase
        .from("student_profiles")
        .select("*")
        .in(
            "id",
            userIds
        );

    if (profileError) {

        console.warn(
            "Member profiles:",
            profileError.message
        );
    }

    const profileMap =
        new Map(
            (profiles || [])
                .map(
                    profile => [
                        profile.id,
                        profile
                    ]
                )
        );

    state.members =
        rows.map(
            membership => ({
                ...membership,
                user_id:
                    membership.user_id,
                profile:
                    profileMap.get(
                        membership.user_id
                    ) || null
            })
        );

    renderMembers();
}


/* ============================================================
   PRESENCE
   ============================================================ */

function presenceFor(
    userId
) {

    const row =
        state.presence.get(
            userId
        );

    if (!row) {
        return "offline";
    }

    const status =
        String(
            row.status || ""
        ).toLowerCase();

    if (status === "online") {
        return "online";
    }

    if (status === "away") {
        return "away";
    }

    return "offline";
}


function renderMembers() {

    const online =
        $("onlineMembers");

    const offline =
        $("offlineMembers");

    if (!online || !offline) {
        return;
    }

    online.innerHTML =
        "";

    offline.innerHTML =
        "";

    let onlineCount =
        0;

    let offlineCount =
        0;

    state.members.forEach(
        member => {

            const profile =
                member.profile;

            const name =
                profileName(
                    profile
                );

            /*
             * Current user may not have a profile row.
             * Fall back to auth information.
             */

            const displayName =
                member.user_id ===
                state.user?.id
                    ? (
                        profileName(profile) !==
                        "Mwaniki Scholar"
                            ? profileName(profile)
                            : userName(state.user)
                    )
                    : name;

            const status =
                presenceFor(
                    member.user_id
                );

            const avatar =
                profileAvatar(
                    profile
                );

            const row =
                document.createElement("div");

            row.className =
                "member-row";

            row.dataset.userId =
                member.user_id;

            row.innerHTML = `
                <div
                    class="avatar member-avatar"
                    ${avatar
                        ? `style="${safeImageStyle(avatar)}"`
                        : ""
                    }
                >
                    ${
                        avatar
                            ? ""
                            : escapeHTML(
                                initials(
                                    displayName
                                )
                            )
                    }
                </div>

                <div class="member-copy">

                    <strong>
                        ${escapeHTML(
                            displayName
                        )}
                    </strong>

                    <span>
                        ${
                            status === "online"
                                ? "Online"
                                : status === "away"
                                    ? "Away"
                                    : "Offline"
                        }
                    </span>

                </div>

                <span
                    class="member-presence ${status}"
                    aria-label="${status}"
                ></span>
            `;

            /*
             * Double-clicking another member opens
             * the visual call picker with that member selected.
             */

            if (
                member.user_id !==
                state.user?.id
            ) {

                row.addEventListener(
                    "dblclick",
                    () => {

                        if (
                            presenceFor(
                                member.user_id
                            ) !== "online"
                        ) {

                            showToast(
                                "That member is not currently online."
                            );

                            return;
                        }

                        openCallPicker(
                            member.user_id
                        );
                    }
                );
            }

            if (
                status === "online" ||
                status === "away"
            ) {

                online.appendChild(
                    row
                );

                onlineCount++;

            } else {

                offline.appendChild(
                    row
                );

                offlineCount++;
            }
        }
    );

    setText(
        "onlineCount",
        onlineCount
    );

    setText(
        "offlineCount",
        offlineCount
    );

    setText(
        "memberCount",
        `${state.members.length} members`
    );
}


/* ============================================================
   SET OWN PRESENCE
   ============================================================ */

async function setMyPresence(
    status = "online"
) {

    if (
        !state.user ||
        !state.currentCommunity
    ) {
        return;
    }

    const communityId =
        state.currentCommunity.id;

    const now =
        new Date().toISOString();

    const row = {

        user_id:
            state.user.id,

        community_id:
            communityId,

        status,

        last_seen:
            now
    };

    try {

        const {
            data,
            error: lookupError
        } = await supabase
            .from("chat_presence")
            .select("id")
            .eq(
                "user_id",
                state.user.id
            )
            .eq(
                "community_id",
                communityId
            )
            .maybeSingle();

        if (lookupError) {
            throw lookupError;
        }

        if (data?.id) {

            const {
                error
            } = await supabase
                .from("chat_presence")
                .update(row)
                .eq(
                    "id",
                    data.id
                );

            if (error) {
                throw error;
            }

        } else {

            const {
                error
            } = await supabase
                .from("chat_presence")
                .insert(row);

            if (error) {

                /*
                 * Another tab/device may have created the
                 * row between the SELECT and INSERT.
                 * Retry as an update.
                 */

                const retry =
                    await supabase
                        .from("chat_presence")
                        .update(row)
                        .eq(
                            "user_id",
                            state.user.id
                        )
                        .eq(
                            "community_id",
                            communityId
                        );

                if (retry.error) {
                    throw error;
                }
            }
        }

        /*
         * Keep our local map immediately correct instead
         * of waiting for realtime.
         */

        state.presence.set(
            state.user.id,
            {
                ...row,
                id:
                    data?.id ||
                    state.presence.get(
                        state.user.id
                    )?.id
            }
        );

        updateOwnPresenceUI(
            status
        );

        renderMembers();

    } catch (error) {

        console.warn(
            "Presence update:",
            error.message
        );
    }
}


function updateOwnPresenceUI(
    status
) {

    const dot =
        $("myPresenceDot");

    const text =
        $("myPresenceText");

    if (!dot || !text) {
        return;
    }

    dot.className =
        `presence-dot ${status}`;

    text.textContent =
        status === "online"
            ? "Online"
            : status === "away"
                ? "Away"
                : "Offline";
}


/* ============================================================
   LOAD PRESENCE
   ============================================================ */

async function loadPresence() {

    if (!state.currentCommunity) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_presence")
        .select("*")
        .eq(
            "community_id",
            state.currentCommunity.id
        );

    if (error) {

        console.warn(
            "Load presence:",
            error.message
        );

        return;
    }

    state.presence.clear();

    (data || []).forEach(
        row => {

            if (row.user_id) {

                state.presence.set(
                    row.user_id,
                    row
                );
            }
        }
    );

    renderMembers();
}


/* ============================================================
   PRESENCE REALTIME
   ============================================================ */

function subscribePresence() {

    if (
        !state.currentCommunity
    ) {
        return;
    }

    removePresenceSubscription();

    const communityId =
        state.currentCommunity.id;

    const channel =
        supabase
            .channel(
                `community-presence-${communityId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_presence",
                    filter:
                        `community_id=eq.${communityId}`
                },
                payload => {

                    const row =
                        payload.new;

                    if (!row?.user_id) {
                        return;
                    }

                    state.presence.set(
                        row.user_id,
                        row
                    );

                    renderMembers();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "chat_presence",
                    filter:
                        `community_id=eq.${communityId}`
                },
                payload => {

                    const row =
                        payload.new;

                    if (!row?.user_id) {
                        return;
                    }

                    state.presence.set(
                        row.user_id,
                        row
                    );

                    renderMembers();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_presence",
                    filter:
                        `community_id=eq.${communityId}`
                },
                payload => {

                    const row =
                        payload.old;

                    if (!row?.user_id) {
                        return;
                    }

                    state.presence.delete(
                        row.user_id
                    );

                    renderMembers();
                }
            )
            .subscribe(
                status => {

                    if (
                        status === "SUBSCRIBED"
                    ) {

                        console.log(
                            "Community presence realtime: SUBSCRIBED"
                        );
                    }
                }
            );

    state.presenceChannel =
        channel;
}


async function removePresenceSubscription() {

    if (
        !state.presenceChannel
    ) {
        return;
    }

    try {

        await supabase.removeChannel(
            state.presenceChannel
        );

    } catch {
        /* ignore */
    }

    state.presenceChannel =
        null;
}


/* ============================================================
   MESSAGES
   ============================================================ */

async function loadMessages() {

    if (!state.currentChannel) {
        return;
    }

    const list =
        $("messageList");

    if (list) {

        list.innerHTML = `
            <div class="message-loading">
                <div class="loading-spinner"></div>
                <span>Loading messages...</span>
            </div>
        `;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_messages")
        .select("*")
        .eq(
            "channel_id",
            state.currentChannel.id
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Messages:",
            error
        );

        if (list) {

            list.innerHTML = `
                <div class="message-loading">
                    Unable to load messages.
                </div>
            `;
        }

        return;
    }

    state.messages =
        data || [];

    await enrichMessageUsers();

    renderMessages();
}


async function enrichMessageUsers() {

    const ids =
        [
            ...new Set(
                state.messages
                    .map(
                        message =>
                            message.user_id ||
                            message.sender_id
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
    } = await supabase
        .from("student_profiles")
        .select("*")
        .in(
            "id",
            ids
        );

    if (error) {

        console.warn(
            "Message profiles:",
            error.message
        );
    }

    const map =
        new Map(
            (data || [])
                .map(
                    profile => [
                        profile.id,
                        profile
                    ]
                )
        );

    state.messages =
        state.messages.map(
            message => ({

                ...message,

                profile:
                    map.get(
                        message.user_id ||
                        message.sender_id
                    ) || null
            })
        );
}


function messageUserId(
    message
) {

    return (
        message.user_id ||
        message.sender_id ||
        null
    );
}


function messageAuthor(
    message
) {

    const id =
        messageUserId(message);

    if (
        id &&
        id === state.user?.id
    ) {

        return (
            profileName(state.profile) !==
            "Mwaniki Scholar"
                ? profileName(state.profile)
                : userName(state.user)
        );
    }

    return profileName(
        message.profile
    );
}


function messageText(
    message
) {

    return (
        message.content ||
        message.message ||
        message.text ||
        ""
    );
}


function renderMessages() {

    const list =
        $("messageList");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!state.messages.length) {

        list.innerHTML = `
            <div class="message-loading">
                <strong>No messages yet.</strong>
                <span>Start the discussion.</span>
            </div>
        `;

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

    searchMessages();

    scrollMessagesToBottom();
}


/* ============================================================
   MESSAGE ELEMENT
   ============================================================ */

function createMessageElement(
    message
) {

    const article =
        document.createElement("article");

    article.className =
        "message";

    article.dataset.messageId =
        message.id;

    const author =
        messageAuthor(
            message
        );

    const avatar =
        profileAvatar(
            message.profile
        );

    const text =
        messageText(
            message
        );

    const canDelete =
        messageUserId(message) ===
        state.user?.id;

    const replyId =
        message.reply_to ||
        message.reply_to_id ||
        null;

    article.innerHTML = `

        <div
            class="message-avatar"
            ${
                avatar
                    ? `style="${safeImageStyle(avatar)}"`
                    : ""
            }
        >
            ${
                avatar
                    ? ""
                    : escapeHTML(
                        initials(author)
                    )
            }
        </div>

        <div class="message-main">

            <div class="message-head">

                <span class="message-author">
                    ${escapeHTML(author)}
                </span>

                <span class="message-time">
                    ${escapeHTML(
                        formatTime(
                            message.created_at
                        )
                    )}
                </span>

            </div>

            ${
                replyId
                    ? `
                        <div class="message-reply">
                            <strong>Reply</strong>
                            ${
                                escapeHTML(
                                    message.reply_preview ||
                                    ""
                                )
                            }
                        </div>
                    `
                    : ""
            }

            ${
                text
                    ? `
                        <div class="message-content">
                            ${escapeHTML(text)}
                        </div>
                    `
                    : ""
            }

            <div
                class="message-attachments"
                data-attachments-for="${escapeHTML(
                    message.id
                )}"
            ></div>

            <div class="message-reactions"></div>

        </div>

        <div class="message-actions">

            <button
                class="message-action reply-message"
                type="button"
                title="Reply"
                aria-label="Reply"
            >
                ↩
            </button>

            <button
                class="message-action react-message"
                type="button"
                title="React"
                aria-label="React"
            >
                😊
            </button>

            ${
                canDelete
                    ? `
                        <button
                            class="message-action delete delete-message"
                            type="button"
                            title="Delete"
                            aria-label="Delete"
                        >
                            🗑
                        </button>
                    `
                    : ""
            }

        </div>
    `;

    article
        .querySelector(".reply-message")
        ?.addEventListener(
            "click",
            () => {

                startReply(
                    message
                );
            }
        );

    article
        .querySelector(".delete-message")
        ?.addEventListener(
            "click",
            () => {

                deleteMessage(
                    message.id
                );
            }
        );

    article
        .querySelector(".react-message")
        ?.addEventListener(
            "click",
            () => {

                addReaction(
                    message.id
                );
            }
        );

    loadMessageAttachments(
        message.id,
        article
    );

    return article;
}


/* ============================================================
   MESSAGE ATTACHMENTS
   ============================================================ */

async function loadMessageAttachments(
    messageId,
    article
) {

    const container =
        article.querySelector(
            ".message-attachments"
        );

    if (!container) {
        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("chat_attachments")
        .select("*")
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

        console.warn(
            "Attachments:",
            error.message
        );

        return;
    }

    if (!data?.length) {
        return;
    }

    container.innerHTML = "";

    data.forEach(
        attachment => {

            const url =
                attachment.file_url ||
                attachment.public_url ||
                attachment.url;

            if (!url) {
                return;
            }

            const name =
                attachment.file_name ||
                attachment.name ||
                "Attachment";

            const type =
                attachment.mime_type ||
                attachment.file_type ||
                "";

            if (
                type.startsWith("image/")
            ) {

                const wrapper =
                    document.createElement("div");

                wrapper.className =
                    "message-attachment";

                wrapper.innerHTML = `
                    <a
                        href="${escapeHTML(url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            class="message-image"
                            src="${escapeHTML(url)}"
                            alt="${escapeHTML(name)}"
                            loading="lazy"
                        >
                    </a>
                `;

                container.appendChild(
                    wrapper
                );

                return;
            }

            if (
                type.startsWith("audio/")
            ) {

                const wrapper =
                    document.createElement("div");

                wrapper.className =
                    "message-attachment voice-attachment";

                wrapper.innerHTML = `
                    <audio
                        class="message-audio"
                        controls
                        preload="metadata"
                    >
                        <source
                            src="${escapeHTML(url)}"
                            type="${escapeHTML(type)}"
                        >
                    </audio>
                `;

                container.appendChild(
                    wrapper
                );

                return;
            }

            const wrapper =
                document.createElement("div");

            wrapper.className =
                "message-attachment";

            wrapper.innerHTML = `
                <a
                    class="message-file"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span class="message-file-icon">
                        📎
                    </span>

                    <span class="message-file-copy">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <span>
                            Open attachment
                        </span>
                    </span>
                </a>
            `;

            container.appendChild(
                wrapper
            );
        }
    );
}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function sendMessage(
    event
) {

    event?.preventDefault();

    if (
        !state.user ||
        !state.currentChannel
    ) {
        return;
    }

    const input =
        $("messageInput");

    if (!input) {
        return;
    }

    const content =
        input.value.trim();

    if (
        !content &&
        !state.pendingFiles.length
    ) {
        return;
    }

    const payload = {

        channel_id:
            state.currentChannel.id,

        user_id:
            state.user.id,

        content:
            content || null
    };

    if (state.replyTo) {

        payload.reply_to =
            state.replyTo.id;
    }

    let result =
        await supabase
            .from("chat_messages")
            .insert(payload)
            .select()
            .single();

    /*
     * Older chat_messages tables may not contain reply_to.
     * Retry the normal message if that is the only problem.
     */

    if (
        result.error &&
        state.replyTo
    ) {

        delete payload.reply_to;

        result =
            await supabase
                .from("chat_messages")
                .insert(payload)
                .select()
                .single();
    }

    if (result.error) {

        console.error(
            "Send message:",
            result.error
        );

        showToast(
            "Unable to send message."
        );

        return;
    }

    input.value =
        "";

    resizeComposer();

    cancelReply();

    const messageId =
        result.data?.id;

    if (messageId) {

        await uploadPendingFiles(
            messageId
        );
    }

    clearPendingFiles();

    stopTyping();

    /*
     * Realtime normally inserts the message.
     * If realtime is delayed, update locally.
     */

    if (
        result.data &&
        !state.messages.some(
            message =>
                message.id ===
                result.data.id
        )
    ) {

        state.messages.push(
            result.data
        );

        await enrichMessageUsers();

        renderMessages();
    }
}


/* ============================================================
   FILE UPLOAD
   ============================================================ */

async function uploadPendingFiles(
    messageId
) {

    if (
        !messageId ||
        !state.pendingFiles.length
    ) {
        return;
    }

    const files =
        [...state.pendingFiles];

    for (
        const file of files
    ) {

        try {

            const safeName =
                file.name
                    .replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

            const path =
                `community/${state.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

            const upload =
                await supabase
                    .storage
                    .from(
                        "chat-attachments"
                    )
                    .upload(
                        path,
                        file,
                        {
                            upsert: false,
                            contentType:
                                file.type ||
                                undefined
                        }
                    );

            if (upload.error) {
                throw upload.error;
            }

            const {
                data: publicData
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
                publicData?.publicUrl;

            if (!fileUrl) {
                throw new Error(
                    "Unable to create attachment URL."
                );
            }

            const {
                error
            } = await supabase
                .from("chat_attachments")
                .insert({
                    message_id:
                        messageId,

                    file_name:
                        file.name,

                    file_url:
                        fileUrl,

                    file_type:
                        file.type ||
                        "application/octet-stream",

                    file_size:
                        file.size,

                    uploaded_by:
                        state.user.id
                });

            if (error) {
                throw error;
            }

        } catch (error) {

            console.error(
                "Attachment upload:",
                error
            );

            showToast(
                `Unable to upload ${file.name}`
            );
        }
    }
}


/* ============================================================
   DELETE MESSAGE
   ============================================================ */

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
        messageUserId(message) !==
        state.user?.id
    ) {

        showToast(
            "You can only delete your own messages."
        );

        return;
    }

    if (
        !window.confirm(
            "Delete this message?"
        )
    ) {
        return;
    }

    const {
        error
    } = await supabase
        .from("chat_messages")
        .delete()
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
            "Delete message:",
            error
        );

        showToast(
            "Unable to delete message."
        );

        return;
    }

    state.messages =
        state.messages.filter(
            item =>
                String(item.id) !==
                String(messageId)
        );

    renderMessages();
}


/* ============================================================
   REPLIES
   ============================================================ */

function startReply(
    message
) {

    state.replyTo =
        message;

    const bar =
        $("replyBar");

    if (bar) {
        bar.classList.remove(
            "hidden"
        );
    }

    setText(
        "replyPreview",
        messageText(message) ||
        "Attachment"
    );

    const input =
        $("messageInput");

    if (input) {
        input.focus();
    }
}


function cancelReply() {

    state.replyTo =
        null;

    $("replyBar")
        ?.classList.add(
            "hidden"
        );

    setText(
        "replyPreview",
        ""
    );
}


/* ============================================================
   REACTIONS
   ============================================================ */

async function addReaction(
    messageId
) {

    const emoji =
        window.prompt(
            "Enter an emoji to react:"
        );

    if (!emoji) {
        return;
    }

    const {
        error
    } = await supabase
        .from("chat_message_reactions")
        .upsert(
            {
                message_id:
                    messageId,

                user_id:
                    state.user.id,

                reaction:
                    emoji
            },
            {
                onConflict:
                    "message_id,user_id,reaction"
            }
        );

    if (error) {

        console.error(
            "Reaction:",
            error
        );

        showToast(
            "Reaction could not be added."
        );

        return;
    }

    showToast(
        "Reaction added."
    );
}


/* ============================================================
   MESSAGE REALTIME
   ============================================================ */

function subscribeCurrentChannel() {

    if (
        !state.currentChannel
    ) {
        return;
    }

    removeMessageSubscription();

    const channelId =
        state.currentChannel.id;

    const channel =
        supabase
            .channel(
                `community-chat-${channelId}`
            )

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channelId}`
                },
                async payload => {

                    if (
                        !payload.new?.id
                    ) {
                        return;
                    }

                    if (
                        state.currentChannel?.id !==
                        channelId
                    ) {
                        return;
                    }

                    if (
                        state.messages.some(
                            message =>
                                String(message.id) ===
                                String(payload.new.id)
                        )
                    ) {
                        return;
                    }

                    state.messages.push(
                        payload.new
                    );

                    await enrichMessageUsers();

                    renderMessages();
                }
            )

            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channelId}`
                },
                async payload => {

                    if (
                        state.currentChannel?.id !==
                        channelId
                    ) {
                        return;
                    }

                    const index =
                        state.messages.findIndex(
                            message =>
                                String(message.id) ===
                                String(
                                    payload.new?.id
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

                    await enrichMessageUsers();

                    renderMessages();
                }
            )

            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${channelId}`
                },
                payload => {

                    if (
                        state.currentChannel?.id !==
                        channelId
                    ) {
                        return;
                    }

                    const id =
                        payload.old?.id;

                    if (!id) {
                        return;
                    }

                    state.messages =
                        state.messages.filter(
                            message =>
                                String(message.id) !==
                                String(id)
                        );

                    renderMessages();
                }
            );

    /*
     * Typing is attached to the SAME channel.
     * This avoids another unnecessary realtime channel.
     */

    channel.on(
        "broadcast",
        {
            event: "typing"
        },
        payload => {

            const userId =
                payload?.payload?.user_id;

            if (
                !userId ||
                userId ===
                state.user?.id
            ) {
                return;
            }

            state.typingUsers.set(
                userId,
                {
                    name:
                        payload?.payload?.name ||
                        "Someone",

                    expires:
                        Date.now() + 2200
                }
            );

            renderTypingUsers();
        }
    );

    channel.on(
        "broadcast",
        {
            event: "typing-stop"
        },
        payload => {

            const userId =
                payload?.payload?.user_id;

            if (!userId) {
                return;
            }

            state.typingUsers.delete(
                userId
            );

            renderTypingUsers();
        }
    );

    channel.subscribe(
        status => {

            if (
                status === "SUBSCRIBED"
            ) {

                console.log(
                    "Message realtime: SUBSCRIBED"
                );
            }
        }
    );

    state.messageChannel =
        channel;
}


async function removeMessageSubscription() {

    if (
        !state.messageChannel
    ) {
        return;
    }

    try {

        await supabase.removeChannel(
            state.messageChannel
        );

    } catch {
        /* ignore */
    }

    state.messageChannel =
        null;

    state.typingUsers.clear();

    renderTypingUsers();
}


/* ============================================================
   TYPING
   ============================================================ */

async function handleTyping() {

    resizeComposer();

    if (
        !state.currentChannel ||
        !state.messageChannel ||
        !state.user
    ) {
        return;
    }

    clearTimeout(
        state.typingTimer
    );

    try {

        await state.messageChannel.send({
            type: "broadcast",
            event: "typing",
            payload: {

                user_id:
                    state.user.id,

                name:
                    profileName(
                        state.profile
                    ) !==
                    "Mwaniki Scholar"
                        ? profileName(
                            state.profile
                        )
                        : userName(
                            state.user
                        )
            }
        });

    } catch {
        /* ignore */
    }

    state.typingTimer =
        setTimeout(
            stopTyping,
            1400
        );
}


async function stopTyping() {

    clearTimeout(
        state.typingTimer
    );

    state.typingTimer =
        null;

    if (
        state.messageChannel &&
        state.user
    ) {

        try {

            await state.messageChannel.send({
                type: "broadcast",
                event: "typing-stop",
                payload: {
                    user_id:
                        state.user.id
                }
            });

        } catch {
            /* ignore */
        }
    }

    renderTypingUsers();
}


function renderTypingUsers() {

    const indicator =
        $("typingIndicator");

    if (!indicator) {
        return;
    }

    const now =
        Date.now();

    for (
        const [
            userId,
            info
        ] of state.typingUsers
    ) {

        if (
            info.expires <=
            now
        ) {

            state.typingUsers.delete(
                userId
            );
        }
    }

    const names =
        [
            ...state.typingUsers.values()
        ]
            .map(
                item =>
                    item.name
            );

    if (!names.length) {

        indicator.classList.add(
            "hidden"
        );

        indicator.textContent =
            "";

        return;
    }

    if (names.length === 1) {

        indicator.textContent =
            `${names[0]} is typing…`;

    } else if (
        names.length === 2
    ) {

        indicator.textContent =
            `${names[0]} and ${names[1]} are typing…`;

    } else {

        indicator.textContent =
            `${names.length} people are typing…`;
    }

    indicator.classList.remove(
        "hidden"
    );

    /*
     * Expiry cleanup.
     */

    setTimeout(
        renderTypingUsers,
        500
    );
}


/* ============================================================
   ATTACHMENTS REALTIME
   ============================================================ */

function subscribeAttachments() {

    if (
        state.attachmentChannel ||
        !state.user
    ) {
        return;
    }

    const channel =
        supabase
            .channel(
                `community-attachments-${state.user.id}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_attachments"
                },
                async payload => {

                    const attachment =
                        payload.new;

                    if (
                        !attachment?.message_id
                    ) {
                        return;
                    }

                    const article =
                        document.querySelector(
                            `[data-message-id="${CSS.escape(
                                String(
                                    attachment.message_id
                                )
                            )}"]`
                        );

                    if (!article) {
                        return;
                    }

                    await loadMessageAttachments(
                        attachment.message_id,
                        article
                    );
                }
            )
            .subscribe();

    state.attachmentChannel =
        channel;
}


/* ============================================================
   FILE PICKER
   ============================================================ */

function handleFiles(
    files
) {

    const selected =
        Array.from(
            files || []
        );

    if (!selected.length) {
        return;
    }

    const MAX_FILE_SIZE =
        25 * 1024 * 1024;

    const valid =
        selected.filter(
            file =>
                file.size <=
                MAX_FILE_SIZE
        );

    if (
        valid.length !==
        selected.length
    ) {

        showToast(
            "Some files were larger than 25 MB and were not added."
        );
    }

    state.pendingFiles =
        [
            ...state.pendingFiles,
            ...valid
        ];

    renderAttachmentPreview();
}


function renderAttachmentPreview() {

    const container =
        $("attachmentPreview");

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    if (!state.pendingFiles.length) {

        container.classList.add(
            "hidden"
        );

        return;
    }

    container.classList.remove(
        "hidden"
    );

    state.pendingFiles.forEach(
        (file, index) => {

            const chip =
                document.createElement("div");

            chip.className =
                "attachment-chip";

            chip.innerHTML = `
                <span class="attachment-chip-name">
                    📎
                    ${escapeHTML(file.name)}
                </span>

                <button
                    type="button"
                    aria-label="Remove attachment"
                >
                    ×
                </button>
            `;

            chip.querySelector(
                "button"
            )?.addEventListener(
                "click",
                () => {

                    state.pendingFiles.splice(
                        index,
                        1
                    );

                    renderAttachmentPreview();
                }
            );

            container.appendChild(
                chip
            );
        }
    );
}


function clearPendingFiles() {

    state.pendingFiles =
        [];

    renderAttachmentPreview();

    const input =
        $("fileInput");

    if (input) {
        input.value =
            "";
    }
}


/* ============================================================
   VOICE NOTES
   ============================================================ */

let mediaRecorder =
    null;

let recordedChunks =
    [];


async function toggleVoiceRecording() {

    /*
     * Stop an existing recording.
     */

    if (mediaRecorder) {

        try {
            mediaRecorder.stop();
        } catch {
            /* ignore */
        }

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

        recordedChunks =
            [];

        let mimeType =
            "audio/webm";

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

        mediaRecorder =
            new MediaRecorder(
                stream,
                {
                    mimeType
                }
            );

        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    recordedChunks.push(
                        event.data
                    );
                }
            };

        mediaRecorder.onstop =
            () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                const type =
                    mediaRecorder?.mimeType ||
                    "audio/webm";

                const blob =
                    new Blob(
                        recordedChunks,
                        {
                            type
                        }
                    );

                mediaRecorder =
                    null;

                recordedChunks =
                    [];

                if (!blob.size) {

                    showToast(
                        "No voice recording was captured."
                    );

                    return;
                }

                const extension =
                    type.includes("ogg")
                        ? "ogg"
                        : "webm";

                const file =
                    new File(
                        [blob],
                        `voice-${Date.now()}.${extension}`,
                        {
                            type
                        }
                    );

                state.pendingFiles.push(
                    file
                );

                renderAttachmentPreview();

                showToast(
                    "Voice note ready. Press Send to upload it."
                );
            };

        mediaRecorder.onerror =
            event => {

                console.error(
                    "MediaRecorder:",
                    event
                );

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );

                mediaRecorder =
                    null;

                recordedChunks =
                    [];
            };

        mediaRecorder.start();

        showToast(
            "Recording voice note… click the microphone again to stop."
        );

    } catch (error) {

        console.error(
            "Voice recording:",
            error
        );

        showToast(
            "Microphone permission was not available."
        );
    }
}


/* ============================================================
   EMOJI
   ============================================================ */

/*
 * A broad Unicode-friendly set rather than the previous tiny
 * medical-only list.
 */

const emojiCharacters = [
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

    "👋","🤚","🖐️","✋","🖖","👌","🤏","✌️",
    "🤞","🤟","🤘","🤙","👈","👉","👆","👇",
    "☝️","✍️","👏","🙌","👐","🤝","🙏","💪",
    "🫶","❤️","🧡","💛","💚","💙","💜","🖤",
    "🤍","🤎","💔","❤️‍🔥","❣️","💕","💞","💓",
    "💗","💖","💘","💝","💟",

    "🔥","⭐","🌟","✨","💫","💯","🎉","🎊",
    "🎈","🎁","🏆","🥇","🥳","👏","✅","☑️",
    "❌","❗","❓","‼️","⁉️","💡","🔔","📢",

    "⚕️","🩺","💊","💉","🧬","🔬","🧪","🧫",
    "🩸","🫀","🫁","🧠","🦴","🦷","👁️","👂",
    "🏥","🚑","🧑‍⚕️","👩‍⚕️","👨‍⚕️",

    "📚","📖","📝","📒","📕","📗","📘","📙",
    "📓","📔","📑","📄","📃","📋","📌","📎",
    "💻","🖥️","⌨️","🖱️","📱","📧","🔗",

    "☀️","🌤️","⛅","🌧️","⛈️","❄️","🌈",
    "🌍","🌎","🌏","🌙","🌞","🌱","🌿","🌸",
    "🌺","🌻","🌹","🍀",

    "⚽","🏀","🏈","⚾","🎾","🏐","🏆","🎮",
    "🎯","🎵","🎶","🎧","🎬","🎨","🎤",

    "🍎","🍌","🍕","🍔","🍟","🍿","🍩","🍪",
    "☕","🥤","🍵","🍫",

    "🚗","🚌","🚑","✈️","🚀","🚲","🏠","🏫",
    "🔑","🔒","🔓","💰","💳","📦","🛒",

    "👍","👎","👏","🙌","🙏","💪","🤝","👌",
    "🎓","👨‍🎓","👩‍🎓","🧑‍🎓"
];


function renderEmojiPicker(
    filter = ""
) {

    const grid =
        $("emojiGrid");

    if (!grid) {
        return;
    }

    const query =
        String(filter || "")
            .trim()
            .toLowerCase();

    grid.innerHTML =
        "";

    /*
     * Search by Unicode character itself.
     * Empty search shows the full available set.
     */

    const emojis =
        query
            ? emojiCharacters.filter(
                emoji =>
                    emoji
                        .toLowerCase()
                        .includes(query)
            )
            : emojiCharacters;

    if (!emojis.length) {

        grid.innerHTML = `
            <div class="emoji-empty">
                No emoji found.
            </div>
        `;

        return;
    }

    emojis.forEach(
        emoji => {

            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "emoji-item";

            button.textContent =
                emoji;

            button.title =
                `Use ${emoji}`;

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

    try {

        input.setSelectionRange(
            cursor,
            cursor
        );

    } catch {
        /* ignore */
    }

    resizeComposer();
}


/* ============================================================
   COMPOSER
   ============================================================ */

function resizeComposer() {

    const input =
        $("messageInput");

    if (!input) {
        return;
    }

    input.style.height =
        "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            150
        ) + "px";
}


function handleMessageKeydown(
    event
) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        sendMessage(
            event
        );

        return;
    }

    handleTyping();
}


/* ============================================================
   MESSAGE SEARCH
   ============================================================ */

function searchMessages() {

    const input =
        $("messageSearchInput");

    if (!input) {
        return;
    }

    const query =
        input.value
            .trim()
            .toLowerCase();

    document
        .querySelectorAll(
            "#messageList .message"
        )
        .forEach(
            item => {

                if (!query) {

                    item.classList.remove(
                        "search-hidden"
                    );

                    return;
                }

                item.classList.toggle(
                    "search-hidden",
                    !item.textContent
                        .toLowerCase()
                        .includes(query)
                );
            }
        );
}


/* ============================================================
   SCROLL
   ============================================================ */

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


/* ============================================================
   CALL TYPE
   ============================================================ */

function setCallType(
    type
) {

    if (
        type !== "audio" &&
        type !== "video"
    ) {

        type =
            "video";
    }

    state.callType =
        type;

    document
        .querySelectorAll(
            "[data-call-type]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.callType ===
                    type
                );
            }
        );
}


/* ============================================================
   GENERAL CALL
   ============================================================ */

function startGeneralCall(
    type = "video"
) {

    const onlineUsers =
        state.members
            .filter(
                member => {

                    return (
                        member.user_id &&
                        member.user_id !==
                        state.user?.id &&
                        presenceFor(
                            member.user_id
                        ) ===
                        "online"
                    );
                }
            )
            .map(
                member =>
                    member.user_id
            );

    if (!onlineUsers.length) {

        showToast(
            "There are no online members available for a call."
        );

        return;
    }

    startCall(
        onlineUsers,
        type
    );
}


/* ============================================================
   CALL PICKER
   ============================================================ */

function openCallPicker(
    preselectedUserId = null
) {

    const modal =
        $("callPickerModal");

    const list =
        $("callMemberList");

    if (!modal || !list) {

        if (preselectedUserId) {

            startCall(
                [preselectedUserId],
                state.callType
            );

        } else {

            showToast(
                "Call picker is unavailable."
            );
        }

        return;
    }

    state.selectedCallUsers =
        new Set();

    if (preselectedUserId) {

        state.selectedCallUsers.add(
            preselectedUserId
        );
    }

    list.innerHTML =
        "";

    const candidates =
        state.members.filter(
            member =>
                member.user_id &&
                member.user_id !==
                state.user?.id &&
                presenceFor(
                    member.user_id
                ) ===
                "online"
        );

    /*
     * Everyone-online option.
     */

    if (candidates.length) {

        const everyone =
            document.createElement(
                "button"
            );

        everyone.type =
            "button";

        everyone.className =
            "call-member-option call-everyone-option";

        everyone.innerHTML = `
            <span class="call-member-avatar call-everyone-avatar">
                👥
            </span>

            <span class="call-member-info">
                <strong>
                    Everyone online
                </strong>

                <small>
                    ${candidates.length} online
                </small>
            </span>

            <span class="call-member-check">
                ✓
            </span>
        `;

        everyone.addEventListener(
            "click",
            () => {

                const selectingAll =
                    state.selectedCallUsers.size !==
                    candidates.length;

                state.selectedCallUsers =
                    selectingAll
                        ? new Set(
                            candidates.map(
                                member =>
                                    member.user_id
                            )
                        )
                        : new Set();

                list
                    .querySelectorAll(
                        ".call-member-option"
                    )
                    .forEach(
                        element => {

                            const id =
                                element.dataset.userId;

                            if (
                                id
                            ) {

                                element.classList.toggle(
                                    "selected",
                                    state.selectedCallUsers.has(
                                        id
                                    )
                                );
                            }
                        }
                    );

                everyone.classList.toggle(
                    "selected",
                    selectingAll
                );

                updateSelectedCallCount();
            }
        );

        list.appendChild(
            everyone
        );
    }

    if (!candidates.length) {

        list.innerHTML += `
            <div class="call-empty">
                <strong>No online members</strong>
                <span>
                    There are currently no online members available for a call.
                </span>
            </div>
        `;

    } else {

        candidates.forEach(
            member => {

                const profile =
                    member.profile;

                const name =
                    profileName(
                        profile
                    );

                const avatar =
                    profileAvatar(
                        profile
                    );

                const row =
                    document.createElement(
                        "button"
                    );

                row.type =
                    "button";

                row.className =
                    "call-member-option";

                row.dataset.userId =
                    member.user_id;

                if (
                    state.selectedCallUsers.has(
                        member.user_id
                    )
                ) {

                    row.classList.add(
                        "selected"
                    );
                }

                row.innerHTML = `
                    <span
                        class="call-member-avatar"
                        ${
                            avatar
                                ? `style="${safeImageStyle(avatar)}"`
                                : ""
                        }
                    >
                        ${
                            avatar
                                ? ""
                                : escapeHTML(
                                    initials(name)
                                )
                        }
                    </span>

                    <span class="call-member-info">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <small>
                            Online
                        </small>
                    </span>

                    <span class="call-member-check">
                        ✓
                    </span>
                `;

                row.addEventListener(
                    "click",
                    () => {

                        toggleCallMember(
                            member.user_id,
                            row
                        );
                    }
                );

                list.appendChild(
                    row
                );
            }
        );
    }

    updateSelectedCallCount();

    setCallType(
        state.callType
    );

    modal.classList.remove(
        "hidden"
    );
}


function toggleCallMember(
    userId,
    element
) {

    if (
        state.selectedCallUsers.has(
            userId
        )
    ) {

        state.selectedCallUsers.delete(
            userId
        );

        element?.classList.remove(
            "selected"
        );

    } else {

        state.selectedCallUsers.add(
            userId
        );

        element?.classList.add(
            "selected"
        );
    }

    updateSelectedCallCount();
}


function updateSelectedCallCount() {

    setText(
        "selectedCallCount",
        state.selectedCallUsers.size
    );
}


function closeCallPicker() {

    $("callPickerModal")
        ?.classList.add(
            "hidden"
        );

    state.selectedCallUsers =
        new Set();

    updateSelectedCallCount();
}


/* ============================================================
   START CALL
   ============================================================ */

function startCall(
    targetIds = null,
    type = null
) {

    const ids =
        targetIds ||
        [
            ...state.selectedCallUsers
        ];

    const uniqueIds =
        [
            ...new Set(
                (ids || [])
                    .filter(
                        id =>
                            id &&
                            id !==
                            state.user?.id
                    )
            )
        ];

    const callType =
        type ||
        state.callType ||
        "video";

    if (!uniqueIds.length) {

        showToast(
            "Select at least one online member."
        );

        return;
    }

    const params =
        new URLSearchParams();

    params.set(
        "mode",
        uniqueIds.length === 1
            ? "direct"
            : "general"
    );

    params.set(
        "call_type",
        callType
    );

    params.set(
        "targets",
        uniqueIds.join(",")
    );

    if (
        state.currentCommunity?.id
    ) {

        params.set(
            "community_id",
            state.currentCommunity.id
        );

        params.set(
            "community_name",
            state.currentCommunity.name ||
            "Mwaniki Scholars"
        );
    }

    if (
        state.currentChannel?.id
    ) {

        params.set(
            "channel_id",
            state.currentChannel.id
        );

        params.set(
            "channel_name",
            state.currentChannel.name ||
            "Discussion"
        );
    }

    closeCallPicker();

    /*
     * IMPORTANT:
     * No WebRTC code belongs here.
     *
     * community-calls.html + community-call.js
     * remain the single call engine.
     */

    window.location.href =
        `./community-calls.html?${params.toString()}`;
}


/* ============================================================
   INCOMING CALLS
   ============================================================ */

function subscribeIncomingCalls() {

    if (
        !state.user ||
        state.incomingCallChannel
    ) {
        return;
    }

    const userId =
        state.user.id;

    const channel =
        supabase
            .channel(
                `incoming-calls-${userId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_call_participants",
                    filter:
                        `user_id=eq.${userId}`
                },
                async payload => {

                    const participant =
                        payload.new;

                    if (
                        !participant ||
                        participant.user_id !==
                        userId ||
                        participant.status !==
                        "invited"
                    ) {
                        return;
                    }

                    await handleIncomingCall(
                        participant
                    );
                }
            )
            .subscribe(
                status => {

                    if (
                        status === "SUBSCRIBED"
                    ) {

                        console.log(
                            "Incoming calls: SUBSCRIBED"
                        );
                    }
                }
            );

    state.incomingCallChannel =
        channel;
}


async function handleIncomingCall(
    participant
) {

    if (
        state.incomingCall
    ) {
        return;
    }

    const {
        data: room,
        error
    } = await supabase
        .from("chat_call_rooms")
        .select("*")
        .eq(
            "id",
            participant.room_id
        )
        .maybeSingle();

    if (error || !room) {
        return;
    }

    if (
        room.status === "ended" ||
        room.room_status === "ended"
    ) {
        return;
    }

    let caller =
        null;

    if (room.created_by) {

        const {
            data
        } = await supabase
            .from("student_profiles")
            .select("*")
            .eq(
                "id",
                room.created_by
            )
            .maybeSingle();

        caller =
            data || null;
    }

    const callerName =
        profileName(caller) !==
        "Mwaniki Scholar"
            ? profileName(caller)
            : "Mwaniki Scholar";

    const callerAvatar =
        profileAvatar(caller);

    state.incomingCall = {

        participant,

        room,

        caller,

        callerName
    };

    showIncomingCallUI(
        callerName,
        callerAvatar,
        room.call_type ||
        "video"
    );
}


/* ============================================================
   INCOMING CALL UI
   ============================================================ */

function showIncomingCallUI(
    callerName,
    avatar,
    callType
) {

    const modal =
        $("incomingCallModal");

    if (!modal) {

        /*
         * Do not automatically join a call.
         */

        showToast(
            `Incoming ${callType} call from ${callerName}`
        );

        return;
    }

    setText(
        "incomingCallerName",
        callerName
    );

    setText(
        "incomingCallType",
        callType === "audio"
            ? "Incoming voice call"
            : "Incoming video call"
    );

    const image =
        $("incomingCallerAvatar");

    if (image) {

        if (avatar) {

            image.style.backgroundImage =
                `url("${avatar}")`;

            image.style.backgroundSize =
                "cover";

            image.style.backgroundPosition =
                "center";

            image.textContent =
                "";

        } else {

            image.style.backgroundImage =
                "";

            image.textContent =
                initials(
                    callerName
                );
        }
    }

    modal.classList.remove(
        "hidden"
    );
}


function hideIncomingCallUI() {

    $("incomingCallModal")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   ACCEPT INCOMING CALL
   ============================================================ */

async function acceptIncomingCall() {

    const incoming =
        state.incomingCall;

    if (!incoming) {
        return;
    }

    const {
        participant,
        room
    } = incoming;

    const now =
        new Date().toISOString();

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update({

            status:
                "joined",

            joined_at:
                now,

            left_at:
                null,

            updated_at:
                now
        })
        .eq(
            "id",
            participant.id
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {

        console.error(
            "Accept call:",
            error
        );

        showToast(
            "Unable to accept the call."
        );

        return;
    }

    hideIncomingCallUI();

    const params =
        new URLSearchParams();

    params.set(
        "mode",
        room.call_scope === "community"
            ? "community"
            : room.call_scope === "direct"
                ? "direct"
                : "general"
    );

    params.set(
        "call_type",
        room.call_type ||
        "video"
    );

    params.set(
        "room_id",
        room.id
    );

    if (room.community_id) {

        params.set(
            "community_id",
            room.community_id
        );
    }

    state.incomingCall =
        null;

    window.location.href =
        `./community-calls.html?${params.toString()}`;
}


/* ============================================================
   DECLINE INCOMING CALL
   ============================================================ */

async function declineIncomingCall() {

    const incoming =
        state.incomingCall;

    if (!incoming) {
        return;
    }

    const participant =
        incoming.participant;

    const {
        error
    } = await supabase
        .from("chat_call_participants")
        .update({

            status:
                "declined",

            left_at:
                new Date().toISOString(),

            updated_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            participant.id
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (error) {

        console.error(
            "Decline call:",
            error
        );
    }

    hideIncomingCallUI();

    state.incomingCall =
        null;
}


/* ============================================================
   HOME
   ============================================================ */

function goHome() {

    window.location.href =
        "./dashboard.html";
}


/* ============================================================
   COMMUNITY MODAL
   ============================================================ */

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


/* ============================================================
   MEMBER SIDEBAR
   ============================================================ */

function toggleMemberSidebar() {

    const sidebar =
        $("memberSidebar");

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle(
        "collapsed"
    );
}


/* ============================================================
   CHANNEL SIDEBAR
   ============================================================ */

function toggleChannelSidebar() {

    const sidebar =
        $("channelSidebar");

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle(
        "mobile-open"
    );
}


/* ============================================================
   ESCAPE KEY
   ============================================================ */

function handleEscape(
    event
) {

    if (
        event.key !==
        "Escape"
    ) {
        return;
    }

    $("emojiPicker")
        ?.classList.add(
            "hidden"
        );

    $("callPickerModal")
        ?.classList.add(
            "hidden"
        );

    $("communityModal")
        ?.classList.add(
            "hidden"
        );

    $("incomingCallModal")
        ?.classList.add(
            "hidden"
        );
}


/* ============================================================
   EVENT BINDINGS
   ============================================================ */

function bindEvents() {

    /*
     * MESSAGE
     */

    $("messageForm")
        ?.addEventListener(
            "submit",
            sendMessage
        );

    $("sendMessageButton")
        ?.addEventListener(
            "click",
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
            resizeComposer
        );


    /*
     * REPLY
     */

    $("cancelReplyButton")
        ?.addEventListener(
            "click",
            cancelReply
        );

    $("replyCancel")
        ?.addEventListener(
            "click",
            cancelReply
        );


    /*
     * FILES
     */

    $("fileButton")
        ?.addEventListener(
            "click",
            () => {

                $("fileInput")
                    ?.click();
            }
        );

    $("attachmentButton")
        ?.addEventListener(
            "click",
            () => {

                $("fileInput")
                    ?.click();
            }
        );

    $("fileInput")
        ?.addEventListener(
            "change",
            event => {

                handleFiles(
                    event.target.files
                );

                event.target.value =
                    "";
            }
        );


    /*
     * VOICE
     */

    $("voiceButton")
        ?.addEventListener(
            "click",
            toggleVoiceRecording
        );

    $("voiceRecordButton")
        ?.addEventListener(
            "click",
            toggleVoiceRecording
        );


    /*
     * EMOJI
     */

    $("emojiButton")
        ?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const picker =
                    $("emojiPicker");

                if (!picker) {
                    return;
                }

                picker.classList.toggle(
                    "hidden"
                );

                if (
                    !picker.classList.contains(
                        "hidden"
                    )
                ) {

                    renderEmojiPicker();

                    $("emojiSearch")
                        ?.focus();
                }
            }
        );

    $("emojiSearch")
        ?.addEventListener(
            "input",
            event => {

                renderEmojiPicker(
                    event.target.value
                );
            }
        );


    /*
     * SEARCH
     */

    $("messageSearchInput")
        ?.addEventListener(
            "input",
            searchMessages
        );


    /*
     * COMMUNITY
     */

    $("communityButton")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("communitySelector")
        ?.addEventListener(
            "click",
            openCommunityModal
        );

    $("closeCommunityModal")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );

    $("communityModalClose")
        ?.addEventListener(
            "click",
            closeCommunityModal
        );


    /*
     * HOME
     */

    $("homeButton")
        ?.addEventListener(
            "click",
            goHome
        );


    /*
     * MEMBER SIDEBAR
     */

    $("memberButton")
        ?.addEventListener(
            "click",
            toggleMemberSidebar
        );

    $("membersButton")
        ?.addEventListener(
            "click",
            toggleMemberSidebar
        );


    /*
     * CHANNEL SIDEBAR
     */

    $("channelMenuButton")
        ?.addEventListener(
            "click",
            toggleChannelSidebar
        );


    /*
     * GENERAL CALL
     */

    $("generalCallButton")
        ?.addEventListener(
            "click",
            () => {

                state.callType =
                    "video";

                openCallPicker();
            }
        );


    $("voiceCallButton")
        ?.addEventListener(
            "click",
            () => {

                state.callType =
                    "audio";

                openCallPicker();
            }
        );


    $("videoCallButton")
        ?.addEventListener(
            "click",
            () => {

                state.callType =
                    "video";

                openCallPicker();
            }
        );


    /*
     * CALL PICKER
     */

    $("callPickerClose")
        ?.addEventListener(
            "click",
            closeCallPicker
        );

    $("closeCallPicker")
        ?.addEventListener(
            "click",
            closeCallPicker
        );


    $("startCallButton")
        ?.addEventListener(
            "click",
            () => {

                startCall(
                    [
                        ...state.selectedCallUsers
                    ],
                    state.callType
                );
            }
        );


    $("startVideoCallButton")
        ?.addEventListener(
            "click",
            () => {

                startCall(
                    [
                        ...state.selectedCallUsers
                    ],
                    "video"
                );
            }
        );


    $("startVoiceCallButton")
        ?.addEventListener(
            "click",
            () => {

                startCall(
                    [
                        ...state.selectedCallUsers
                    ],
                    "audio"
                );
            }
        );


    /*
     * CALL TYPE
     */

    document
        .querySelectorAll(
            "[data-call-type]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setCallType(
                            button.dataset.callType
                        );
                    }
                );
            }
        );


    /*
     * INCOMING CALL
     */

    $("acceptIncomingCall")
        ?.addEventListener(
            "click",
            acceptIncomingCall
        );

    $("acceptCallButton")
        ?.addEventListener(
            "click",
            acceptIncomingCall
        );

    $("declineIncomingCall")
        ?.addEventListener(
            "click",
            declineIncomingCall
        );

    $("declineCallButton")
        ?.addEventListener(
            "click",
            declineIncomingCall
        );


    /*
     * GLOBAL ESCAPE
     */

    document.addEventListener(
        "keydown",
        handleEscape
    );


    /*
     * CLICK OUTSIDE EMOJI PICKER
     */

    document.addEventListener(
        "click",
        event => {

            const picker =
                $("emojiPicker");

            const button =
                $("emojiButton");

            if (
                picker &&
                !picker.classList.contains(
                    "hidden"
                ) &&
                !picker.contains(
                    event.target
                ) &&
                !button?.contains(
                    event.target
                )
            ) {

                picker.classList.add(
                    "hidden"
                );
            }
        }
    );
}


/* ============================================================
   VISIBILITY / PRESENCE
   ============================================================ */

function bindVisibilityEvents() {

    document.addEventListener(
        "visibilitychange",
        async () => {

            /*
             * Do not use window blur for away status.
             * A user can simply click another browser tab/window
             * while still being active on the community.
             */

            if (
                document.hidden
            ) {

                await setMyPresence(
                    "away"
                );

            } else {

                await setMyPresence(
                    "online"
                );
            }
        }
    );


    window.addEventListener(
        "focus",
        () => {

            setMyPresence(
                "online"
            );
        }
    );


    /*
     * Do NOT mark users away merely because the browser
     * loses focus.
     */


    window.addEventListener(
        "pagehide",
        () => {

            markPresenceOffline();
        }
    );


    window.addEventListener(
        "beforeunload",
        () => {

            markPresenceOffline();
        }
    );
}


function markPresenceOffline() {

    if (
        !state.user ||
        !state.currentCommunity
    ) {
        return;
    }

    /*
     * Supabase requests are not guaranteed to complete
     * during page unload, but this is still useful when
     * the browser permits it.
     */

    try {

        supabase
            .from("chat_presence")
            .update({
                status:
                    "offline",

                last_seen:
                    new Date().toISOString()
            })
            .eq(
                "user_id",
                state.user.id
            )
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .then(() => {})
            .catch(() => {});

    } catch {
        /* ignore */
    }

    updateOwnPresenceUI(
        "offline"
    );
}


/* ============================================================
   PRESENCE HEARTBEAT
   ============================================================ */

let presenceHeartbeat =
    null;


function startPresenceHeartbeat() {

    clearInterval(
        presenceHeartbeat
    );

    presenceHeartbeat =
        setInterval(
            async () => {

                if (
                    document.hidden ||
                    !state.currentCommunity
                ) {
                    return;
                }

                await setMyPresence(
                    "online"
                );

            },
            30000
        );
}


/* ============================================================
   CLEANUP
   ============================================================ */

async function cleanupCommunity() {

    clearInterval(
        presenceHeartbeat
    );

    clearTimeout(
        state.typingTimer
    );

    if (
        mediaRecorder &&
        mediaRecorder.state !==
        "inactive"
    ) {

        try {
            mediaRecorder.stop();
        } catch {
            /* ignore */
        }
    }

    await setMyPresence(
        "offline"
    );

    await removeMessageSubscription();

    await removePresenceSubscription();

    if (
        state.incomingCallChannel
    ) {

        try {

            await supabase.removeChannel(
                state.incomingCallChannel
            );

        } catch {
            /* ignore */
        }

        state.incomingCallChannel =
            null;
    }

    if (
        state.attachmentChannel
    ) {

        try {

            await supabase.removeChannel(
                state.attachmentChannel
            );

        } catch {
            /* ignore */
        }

        state.attachmentChannel =
            null;
    }

    state.presence.clear();

    state.typingUsers.clear();
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initializeCommunity() {

    if (state.initialized) {
        return;
    }

    state.initialized =
        true;

    try {

        await loadCurrentUser();

        await loadProfile();

        bindEvents();

        bindVisibilityEvents();

        await loadCommunities();

        if (
            !state.currentCommunity
        ) {

            showToast(
                "No communities are available."
            );

            setText(
                "connectionStatus",
                "No community"
            );

            return;
        }

        /*
         * Communities are loaded BEFORE channels.
         * This guarantees Mwaniki Scholars is selected first.
         */

        renderCommunityRail();

        renderCommunityModal();

        await loadChannels();

        await loadPresence();

        subscribePresence();

        subscribeIncomingCalls();

        subscribeAttachments();

        await setMyPresence(
            "online"
        );

        startPresenceHeartbeat();

        renderEmojiPicker();

        renderAttachmentPreview();

        renderTypingUsers();

        resizeComposer();

        setCallType(
            state.callType
        );

        setText(
            "connectionStatus",
            "Connected"
        );

        document.body.classList.add(
            "community-ready"
        );

        console.log(
            "[Mwaniki Scholars] Community initialized."
        );

    } catch (error) {

        console.error(
            "[Mwaniki Scholars] Initialization failed:",
            error
        );

        setText(
            "connectionStatus",
            "Connection error"
        );

        showToast(
            error?.message ||
            "Unable to initialize the community."
        );
    }
}


/* ============================================================
   GLOBAL CLEANUP
   ============================================================ */

window.addEventListener(
    "pagehide",
    () => {

        /*
         * pagehide should not block navigation.
         * markPresenceOffline() is already attempted above.
         */

        clearInterval(
            presenceHeartbeat
        );
    }
);


/* ============================================================
   START
   ============================================================ */

initializeCommunity();
