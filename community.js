/*
===============================================================
 MWANIKI SCHOLARS COMMUNITY ENGINE
===============================================================

 RESPONSIBLE FOR:

 - Authentication
 - Communities
 - Channels
 - Course channels
 - Members
 - Presence
 - Messages
 - Replies
 - Reactions
 - Attachments
 - Voice notes
 - Message deletion
 - Message search
 - Channel search
 - Emoji / sticker / GIF UI
 - Profile UI
 - Friends UI
 - Community UI
 - Notifications

 NOT RESPONSIBLE FOR:

 - WebRTC
 - microphone streaming
 - camera streaming
 - call rooms
 - call signaling

 community-calls.js owns ALL calling.
===============================================================
*/

import { supabase } from "./supabase.js";

(() => {

    "use strict";

    const db = supabase;

    if (!db) {
        console.error("Mwaniki Community: Supabase unavailable.");
        return;
    }


    /* =========================================================
       STATE
       ========================================================= */

    const state = {

        user: null,
        profile: null,

        communities: [],
        courses: [],
        channels: [],
        members: [],
        messages: [],

        currentCommunity: null,
        currentChannel: null,

        reactions: {},
        attachments: {},

        channelSearch: "",
        messageSearch: "",
        memberSearch: "",

        pendingAttachment: null,

        realtime: [],
        presenceChannel: null,
        presenceTimer: null,

        recording: false,
        recorder: null,
        voiceChunks: [],

        initialized: false

    };


    /* =========================================================
       DOM
       ========================================================= */

    const $ = id => document.getElementById(id);

    const q = selector =>
        document.querySelector(selector);

    const qa = selector =>
        [...document.querySelectorAll(selector)];


    /* =========================================================
       UTILITIES
       ========================================================= */

    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function safeURL(value) {

        try {

            const url = new URL(value);

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {
                return url.href;
            }

        } catch {}

        return "";
    }


    function initials(name) {

        const parts =
            String(name || "Student")
                .trim()
                .split(/\s+/)
                .slice(0, 2);

        return parts
            .map(part => part[0]?.toUpperCase() || "")
            .join("") || "S";
    }


    function displayName(profile) {

        if (!profile) return "Student";

        return (
            profile.full_name ||
            profile.name ||
            profile.display_name ||
            profile.username ||
            profile.email ||
            "Student"
        );
    }


    function avatarURL(profile) {

        if (!profile) return "";

        return safeURL(
            profile.avatar_url ||
            profile.profile_photo ||
            profile.photo_url ||
            profile.image ||
            ""
        );
    }


    function slug(value) {

        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }


    function toast(message, type = "normal") {

        const element = $("toast");

        if (!element) return;

        element.textContent = message;

        element.className =
            `toast ${type}`;

        clearTimeout(element._timer);

        element._timer =
            setTimeout(() => {

                element.classList.add("hidden");

            }, 3500);
    }


    function show(element) {

        if (!element) return;

        element.classList.remove("hidden");
    }


    function hide(element) {

        if (!element) return;

        element.classList.add("hidden");
    }


    function toggle(element) {

        if (!element) return;

        element.classList.toggle("hidden");
    }


    function closeAllPickers() {

        hide($("emojiPanel"));
        hide($("stickerPanel"));
        hide($("gifPanel"));

    }


    /* =========================================================
       COMMUNITY ICONS
       ========================================================= */

    function communityEmoji(community) {

        const name =
            String(community?.name || "")
                .toLowerCase();

        const slugValue =
            String(community?.slug || "")
                .toLowerCase();

        if (
            name.includes("gaming") ||
            slugValue.includes("gaming")
        ) {
            return "🎮";
        }

        if (
            name.includes("meme") ||
            slugValue.includes("meme")
        ) {
            return "😂";
        }

        if (
            name.includes("scholar") ||
            name.includes("mwaniki")
        ) {
            return "🎓";
        }

        return "💬";
    }


    function renderCommunityIcon(community) {

        const image =
            safeURL(community?.icon_url);

        if (image) {

            return `
                <img
                    src="${escapeHTML(image)}"
                    alt=""
                    class="community-icon-image"
                >
            `;

        }

        return `
            <span class="community-icon-fallback">
                ${communityEmoji(community)}
            </span>
        `;
    }


    /* =========================================================
       AUTHENTICATION
       ========================================================= */

    async function loadUser() {

        const {
            data,
            error
        } = await db.auth.getUser();

        if (error) {

            console.error(
                "Authentication error:",
                error
            );

            return null;
        }

        state.user = data?.user || null;

        return state.user;
    }


    async function requireAuthentication() {

        if (!state.user) {

            window.location.href =
                "./index.html";

            return false;
        }

        return true;
    }


    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {

        if (!state.user) return;

        const { data } =
            await db
                .from("students")
                .select("*")
                .eq("id", state.user.id)
                .maybeSingle();

        if (data) {

            state.profile = data;

        } else {

            const fallback =
                await db
                    .from("chat_public_profiles")
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

            state.profile =
                fallback.data || {
                    id: state.user.id,
                    email: state.user.email
                };
        }


        renderHeaderProfile();
    }


    function renderHeaderProfile() {

        const name =
            displayName(state.profile);

        const avatar =
            avatarURL(state.profile);

        const image =
            $("headerProfileAvatar");

        if (image) {

            if (avatar) {

                image.src = avatar;

            } else {

                image.src =
                    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg"
                             width="80"
                             height="80">
                            <rect width="100%" height="100%" rx="40"
                                  fill="#087f73"/>
                            <text x="50%" y="55%"
                                  text-anchor="middle"
                                  font-size="30"
                                  fill="white"
                                  font-family="Arial">
                                ${initials(name)}
                            </text>
                        </svg>
                    `)}`;

            }
        }

        if ($("headerProfileName")) {

            $("headerProfileName").textContent =
                name;
        }
    }


    /* =========================================================
       COURSES
       ========================================================= */

    async function loadCourses() {

        const { data, error } =
            await db
                .from("courses")
                .select("id,title,description,image,created_at")
                .order("title", {
                    ascending: true
                });

        if (error) {

            console.warn(
                "Courses could not load:",
                error.message
            );

            state.courses = [];

            return;
        }

        state.courses = data || [];

    }


    /* =========================================================
       COMMUNITIES
       ========================================================= */

    async function loadCommunities() {

        const {
            data,
            error
        } = await db
            .from("chat_communities")
            .select(`
                id,
                name,
                slug,
                description,
                icon_url,
                is_public,
                is_active,
                created_by,
                created_at,
                updated_at
            `)
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) {

            console.error(
                "Community loading failed:",
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

        const saved =
            localStorage.getItem(
                "mwanikiCommunityId"
            );

        const savedCommunity =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(saved)
            );

        const defaultCommunity =
            savedCommunity ||
            state.communities.find(item =>
                String(item.name || "")
                    .toLowerCase()
                    .includes("mwaniki scholars")
            ) ||
            state.communities[0];

        if (defaultCommunity) {

            await selectCommunity(
                defaultCommunity.id
            );
        }
    }


    function renderCommunityRail() {

        const rail =
            $("communityRailList");

        if (!rail) return;

        rail.innerHTML = "";

        state.communities.forEach(
            community => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "community-rail-item";

                button.dataset.communityId =
                    community.id;

                button.title =
                    community.name;

                button.innerHTML = `
                    <span class="community-rail-icon">
                        ${renderCommunityIcon(community)}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community.id
                        )
                );

                rail.appendChild(button);
            }
        );

        highlightSelectedCommunity();
    }


    function highlightSelectedCommunity() {

        qa(
            ".community-rail-item"
        ).forEach(button => {

            button.classList.toggle(
                "active",
                String(
                    button.dataset.communityId
                ) ===
                String(
                    state.currentCommunity?.id
                )
            );

        });
    }


    async function selectCommunity(id) {

        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!community) return;

        state.currentCommunity =
            community;

        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );

        localStorage.setItem(
            "mwanikiCommunityName",
            community.name
        );

        renderSelectedCommunity();

        highlightSelectedCommunity();

        await loadChannels();

        await loadCommunityMembers();

        await subscribeCommunityRealtime();

        startPresence();

        /*
         * Tell the calling engine which
         * community is currently open.
         */
        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:community-changed",
                {
                    detail: {
                        community
                    }
                }
            )
        );
    }


    function renderSelectedCommunity() {

        const community =
            state.currentCommunity;

        if (!community) return;

        const icon =
            $("selectedCommunityIcon");

        if (icon) {

            icon.innerHTML =
                renderCommunityIcon(
                    community
                );
        }

        if ($("selectedCommunityName")) {

            $("selectedCommunityName")
                .textContent =
                community.name;
        }

        if ($("selectedCommunityDescription")) {

            $("selectedCommunityDescription")
                .textContent =
                community.description ||
                "Community discussion";
        }
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    function channelCategory(channel) {

        const category =
            String(channel.category || "")
                .toLowerCase();

        if (channel.course_id) {

            return "course";
        }

        if (
            category.includes("announcement") ||
            category.includes("information")
        ) {

            return "information";
        }

        if (
            category.includes("contest") ||
            category.includes("event")
        ) {

            return "contest";
        }

        return "community";
    }


    async function loadChannels() {

        if (!state.currentCommunity) return;

        const {
            data,
            error
        } = await db
            .from("chat_channels")
            .select("*")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .order("position", {
                ascending: true,
                nullsFirst: false
            })
            .order("created_at", {
                ascending: true
            });

        if (error) {

            console.error(
                "Channel loading failed:",
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

        await selectInitialChannel();
    }


    function channelMatchesSearch(channel) {

        const search =
            state.channelSearch
                .trim()
                .toLowerCase();

        if (!search) return true;

        return [
            channel.name,
            channel.description,
            channel.category
        ]
            .filter(Boolean)
            .some(value =>
                String(value)
                    .toLowerCase()
                    .includes(search)
            );
    }


    function createChannelButton(channel) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "channel-button";

        button.dataset.channelId =
            channel.id;

        const icon =
            channel.channel_type === "voice"
                ? "🔊"
                : channel.course_id
                    ? "📚"
                    : "💬";

        button.innerHTML = `
            <span class="channel-icon">
                ${icon}
            </span>

            <span class="channel-name">
                ${escapeHTML(
                    channel.name ||
                    "channel"
                )}
            </span>
        `;

        button.addEventListener(
            "click",
            () =>
                selectChannel(channel.id)
        );

        return button;
    }


    function renderChannels() {

        const information =
            $("informationChannels");

        const courses =
            $("courseChannels");

        const community =
            $("communityChannels");

        [
            information,
            courses,
            community
        ].forEach(container => {

            if (container) {
                container.innerHTML = "";
            }

        });


        const filtered =
            state.channels.filter(
                channel =>
                    channelMatchesSearch(
                        channel
                    )
            );


        filtered.forEach(channel => {

            const button =
                createChannelButton(
                    channel
                );

            const type =
                channelCategory(
                    channel
                );

            if (
                type === "information" &&
                information
            ) {

                information.appendChild(
                    button
                );

            } else if (
                type === "course" &&
                courses
            ) {

                courses.appendChild(
                    button
                );

            } else if (community) {

                community.appendChild(
                    button
                );
            }
        });


        qa(".channel-button").forEach(
            button => {

                button.classList.toggle(
                    "active",
                    String(
                        button.dataset.channelId
                    ) ===
                    String(
                        state.currentChannel?.id
                    )
                );

            }
        );
    }


    async function selectInitialChannel() {

        if (!state.channels.length) {

            state.currentChannel = null;

            clearChat();

            return;
        }

        const saved =
            localStorage.getItem(
                "mwanikiChannelId"
            );

        const savedChannel =
            state.channels.find(
                channel =>
                    String(channel.id) ===
                    String(saved)
            );

        /*
         * Prefer saved channel.
         *
         * Otherwise prefer a normal
         * discussion channel.
         *
         * Otherwise first channel.
         */
        const discussion =
            state.channels.find(
                channel =>
                    !channel.course_id &&
                    !["announcement", "information"]
                        .includes(
                            String(
                                channel.category ||
                                ""
                            ).toLowerCase()
                        )
            );

        const selected =
            savedChannel ||
            discussion ||
            state.channels[0];

        await selectChannel(
            selected.id
        );
    }


    async function selectChannel(id) {

        const channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!channel) return;

        state.currentChannel =
            channel;

        localStorage.setItem(
            "mwanikiChannelId",
            String(channel.id)
        );

        if ($("currentChannelName")) {

            $("currentChannelName")
                .textContent =
                channel.name || "channel";
        }

        if ($("currentChannelDescription")) {

            $("currentChannelDescription")
                .textContent =
                channel.description ||
                "Community discussion";
        }

        if ($("currentChannelIcon")) {

            $("currentChannelIcon")
                .textContent =
                channel.channel_type === "voice"
                    ? "🔊"
                    : channel.course_id
                        ? "📚"
                        : "#";
        }

        renderChannels();

        await loadMessages();

        await subscribeChannelRealtime();

        await markChannelRead();
    }


    function clearChat() {

        const list =
            $("messageList");

        if (list) {

            list.innerHTML = `
                <div class="empty-state">
                    <strong>No channel selected</strong>
                    <span>Select a channel to begin.</span>
                </div>
            `;
        }
    }


    /* =========================================================
       MEMBERS
       ========================================================= */

    async function loadCommunityMembers() {

        if (!state.currentCommunity) return;

        const {
            data,
            error
        } = await db
            .from("chat_community_members")
            .select("*")
            .eq(
                "community_id",
                state.currentCommunity.id
            );

        if (error) {

            console.warn(
                "Members unavailable:",
                error.message
            );

            state.members = [];

            renderMembers();

            return;
        }

        const rows =
            data || [];

        const userIds =
            rows
                .map(row =>
                    row.user_id
                )
                .filter(Boolean);

        let profiles = [];

        if (userIds.length) {

            const result =
                await db
                    .from("chat_public_profiles")
                    .select("*")
                    .in("id", userIds);

            profiles =
                result.data || [];
        }

        const profileMap =
            new Map(
                profiles.map(
                    profile => [
                        String(profile.id),
                        profile
                    ]
                )
            );


        state.members =
            rows.map(row => ({
                ...row,
                profile:
                    profileMap.get(
                        String(row.user_id)
                    ) || {
                        id: row.user_id
                    }
            }));

        renderMembers();
    }


    function renderMembers() {

        const list =
            $("memberList");

        if (!list) return;

        const search =
            state.memberSearch
                .trim()
                .toLowerCase();

        const members =
            state.members.filter(
                member => {

                    if (!search) {
                        return true;
                    }

                    return displayName(
                        member.profile
                    )
                        .toLowerCase()
                        .includes(search);
                }
            );

        if ($("memberCount")) {

            $("memberCount")
                .textContent =
                state.members.length;
        }

        list.innerHTML = "";

        if (!members.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No members found.
                </div>
            `;

            return;
        }


        members.forEach(member => {

            const profile =
                member.profile;

            const name =
                displayName(profile);

            const avatar =
                avatarURL(profile);

            const row =
                document.createElement("div");

            row.className =
                "member-row";

            row.dataset.userId =
                member.user_id;

            row.innerHTML = `
                <div class="member-avatar-wrap">

                    ${
                        avatar
                            ? `
                                <img
                                    src="${escapeHTML(avatar)}"
                                    class="member-avatar"
                                    alt=""
                                >
                            `
                            : `
                                <div class="member-avatar fallback-avatar">
                                    ${escapeHTML(
                                        initials(name)
                                    )}
                                </div>
                            `
                    }

                    <span
                        class="presence-dot"
                        data-presence-user="${escapeHTML(
                            member.user_id
                        )}"
                    ></span>

                </div>

                <div class="member-info">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <span>
                        ${escapeHTML(
                            member.role ||
                            "Student"
                        )}
                    </span>

                </div>

                <button
                    class="member-call-button"
                    type="button"
                    title="Call ${escapeHTML(name)}"
                    data-call-user="${escapeHTML(
                        member.user_id
                    )}"
                >
                    📞
                </button>
            `;

            list.appendChild(row);
        });


        qa("[data-call-user]").forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        const userId =
                            button.dataset.callUser;

                        window.MwanikiCalls?.callUser(
                            userId,
                            "audio"
                        );
                    }
                );
            }
        );
    }


    /* =========================================================
       PRESENCE
       ========================================================= */

    function startPresence() {

        stopPresence();

        if (!state.user) return;

        updateOwnPresence();

        state.presenceTimer =
            setInterval(
                updateOwnPresence,
                30000
            );

        subscribePresence();
    }


    function stopPresence() {

        if (state.presenceTimer) {

            clearInterval(
                state.presenceTimer
            );

            state.presenceTimer = null;
        }

        if (state.presenceChannel) {

            db.removeChannel(
                state.presenceChannel
            );

            state.presenceChannel =
                null;
        }
    }


    async function updateOwnPresence() {

        if (!state.user) return;

        const payload = {
            user_id: state.user.id,
            status: "online",
            last_seen_at:
                new Date().toISOString()
        };

        const existing =
            await db
                .from("chat_presence")
                .select("user_id")
                .eq("user_id", state.user.id)
                .maybeSingle();

        if (existing.data) {

            await db
                .from("chat_presence")
                .update({
                    status: "online",
                    last_seen_at:
                        payload.last_seen_at
                })
                .eq(
                    "user_id",
                    state.user.id
                );

        } else {

            await db
                .from("chat_presence")
                .insert(payload);
        }
    }


    function subscribePresence() {

        state.presenceChannel =
            db
                .channel(
                    `mwaniki-presence-${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_presence"
                    },
                    () => {

                        updateMemberPresenceDots();

                    }
                )
                .subscribe();
    }


    async function updateMemberPresenceDots() {

        const userIds =
            state.members
                .map(member => member.user_id)
                .filter(Boolean);

        if (!userIds.length) return;

        const { data } =
            await db
                .from("chat_presence")
                .select(
                    "user_id,status,last_seen_at"
                )
                .in("user_id", userIds);

        const now =
            Date.now();

        const online =
            new Set(
                (data || [])
                    .filter(row => {

                        if (
                            row.status !== "online"
                        ) {
                            return false;
                        }

                        const time =
                            row.last_seen_at
                                ? new Date(
                                    row.last_seen_at
                                ).getTime()
                                : 0;

                        return (
                            !time ||
                            now - time <
                                120000
                        );
                    })
                    .map(row =>
                        String(row.user_id)
                    )
            );


        qa("[data-presence-user]")
            .forEach(dot => {

                dot.classList.toggle(
                    "online",
                    online.has(
                        String(
                            dot.dataset.presenceUser
                        )
                    )
                );

            });
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages() {

        if (!state.currentChannel) {

            clearChat();

            return;
        }

        show($("messageLoading"));

        const {
            data,
            error
        } = await db
            .from("chat_messages")
            .select(`
                id,
                channel_id,
                user_id,
                content,
                message_type,
                is_deleted,
                created_at,
                updated_at
            `)
            .eq(
                "channel_id",
                state.currentChannel.id
            )
            .order("created_at", {
                ascending: true
            })
            .limit(500);

        hide($("messageLoading"));

        if (error) {

            console.error(
                "Messages failed:",
                error
            );

            toast(
                "Could not load messages.",
                "error"
            );

            return;
        }

        const messages =
            data || [];

        await enrichMessages(
            messages
        );

        await loadAttachments(
            messages
        );

        state.messages =
            messages;

        renderMessages();
    }


    async function enrichMessages(messages) {

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

        if (!ids.length) return;

        const { data } =
            await db
                .from("chat_public_profiles")
                .select("*")
                .in("id", ids);

        const profiles =
            data || [];

        const map =
            new Map(
                profiles.map(
                    profile => [
                        String(profile.id),
                        profile
                    ]
                )
            );

        messages.forEach(message => {

            message.profile =
                map.get(
                    String(message.user_id)
                ) || {
                    id: message.user_id
                };

        });
    }


    async function loadAttachments(messages) {

        const ids =
            messages
                .map(message => message.id)
                .filter(Boolean);

        if (!ids.length) return;

        const {
            data,
            error
        } = await db
            .from("chat_attachments")
            .select("*")
            .in("message_id", ids);

        if (error) {

            console.warn(
                "Attachment lookup failed:",
                error.message
            );

            return;
        }

        state.attachments = {};

        (data || []).forEach(
            attachment => {

                state.attachments[
                    String(
                        attachment.message_id
                    )
                ] = attachment;

            }
        );

        messages.forEach(message => {

            message.attachment =
                state.attachments[
                    String(message.id)
                ] || null;

        });
    }


    function renderMessages() {

        const list =
            $("messageList");

        if (!list) return;

        const search =
            state.messageSearch
                .trim()
                .toLowerCase();

        const messages =
            state.messages.filter(
                message => {

                    if (!search) return true;

                    return String(
                        message.content || ""
                    )
                        .toLowerCase()
                        .includes(search);
                }
            );


        list.innerHTML = "";

        if (!messages.length) {

            list.innerHTML = `
                <div class="empty-state">
                    <strong>No messages yet</strong>
                    <span>
                        Start the conversation.
                    </span>
                </div>
            `;

            return;
        }


        messages.forEach(
            message => {

                list.appendChild(
                    renderMessage(
                        message
                    )
                );

            }
        );


        list.scrollTop =
            list.scrollHeight;

        attachMessageActions();

        attachVoiceSources();
    }


    function renderMessage(message) {

        const own =
            String(message.user_id) ===
            String(state.user?.id);

        const profile =
            message.profile;

        const name =
            displayName(profile);

        const avatar =
            avatarURL(profile);

        const wrapper =
            document.createElement("article");

        wrapper.className =
            `chat-message ${
                own ? "own-message" : ""
            }`;

        wrapper.dataset.messageId =
            message.id;


        let content = "";


        if (message.is_deleted) {

            content = `
                <div class="message-deleted">
                    This message was deleted.
                </div>
            `;

        } else if (
            message.message_type === "voice"
        ) {

            content = `
                <div class="voice-message">
                    <span>🎙️ Voice note</span>

                    <audio
                        controls
                        preload="metadata"
                        data-voice-message="${escapeHTML(
                            message.id
                        )}"
                    ></audio>
                </div>
            `;

        } else if (
            message.message_type === "file" &&
            message.attachment
        ) {

            const attachment =
                message.attachment;

            const url =
                safeURL(
                    attachment.file_url
                );

            content = `
                <a
                    class="message-attachment"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener"
                >
                    <span class="attachment-icon">
                        📎
                    </span>

                    <span>
                        <strong>
                            ${escapeHTML(
                                attachment.file_name ||
                                "Attachment"
                            )}
                        </strong>

                        <small>
                            ${
                                attachment.file_type ||
                                "File"
                            }
                        </small>
                    </span>
                </a>
            `;

        } else {

            content = `
                <div class="message-content">
                    ${escapeHTML(
                        message.content || ""
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </div>
            `;
        }


        wrapper.innerHTML = `

            <div class="message-avatar-wrap">

                ${
                    avatar
                        ? `
                            <img
                                class="message-avatar"
                                src="${escapeHTML(avatar)}"
                                alt=""
                            >
                        `
                        : `
                            <div class="message-avatar fallback-avatar">
                                ${escapeHTML(
                                    initials(name)
                                )}
                            </div>
                        `
                }

                <span
                    class="presence-dot"
                    data-presence-user="${escapeHTML(
                        message.user_id
                    )}"
                ></span>

            </div>


            <div class="message-main">

                <div class="message-header">

                    <strong class="message-author">
                        ${escapeHTML(name)}
                    </strong>

                    <time class="message-time">
                        ${formatTime(
                            message.created_at
                        )}
                    </time>

                </div>


                ${content}


                ${
                    !message.is_deleted
                        ? `
                            <div class="message-actions">

                                <button
                                    class="message-action"
                                    data-reaction="❤️"
                                    type="button"
                                >
                                    ❤️
                                </button>

                                <button
                                    class="message-action"
                                    data-reply-message="${escapeHTML(
                                        message.id
                                    )}"
                                    type="button"
                                >
                                    ↩
                                </button>

                                ${
                                    own
                                        ? `
                                            <button
                                                class="message-action danger"
                                                data-delete-message="${escapeHTML(
                                                    message.id
                                                )}"
                                                type="button"
                                            >
                                                🗑
                                            </button>
                                        `
                                        : ""
                                }

                            </div>
                        `
                        : ""
                }

            </div>
        `;


        return wrapper;
    }


    function formatTime(timestamp) {

        if (!timestamp) return "";

        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "numeric",
                minute: "2-digit"
            }
        ).format(
            new Date(timestamp)
        );
    }


    function attachVoiceSources() {

        qa(
            "[data-voice-message]"
        ).forEach(audio => {

            const messageId =
                audio.dataset.voiceMessage;

            const attachment =
                state.attachments[
                    String(messageId)
                ];

            const url =
                safeURL(
                    attachment?.file_url
                );

            if (url) {

                audio.src = url;
            }
        });
    }


    /* =========================================================
       SEND MESSAGE
       ========================================================= */

    async function sendMessage() {

        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }

        const input =
            $("messageInput");

        const content =
            input?.value?.trim();

        if (!content) return;

        const button =
            $("sendMessageButton");

        if (button) {
            button.disabled = true;
        }


        const {
            data,
            error
        } = await db
            .from("chat_messages")
            .insert({
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text",

                is_deleted:
                    false
            })
            .select("*")
            .single();


        if (button) {
            button.disabled = false;
        }


        if (error) {

            console.error(
                "Message send failed:",
                error
            );

            toast(
                error.message ||
                "Message could not be sent.",
                "error"
            );

            return;
        }


        input.value = "";

        if (data) {

            data.profile =
                state.profile;

            state.messages.push(data);

            renderMessages();
        }
    }


    /* =========================================================
       DELETE MESSAGE
       ========================================================= */

    async function deleteMessage(id) {

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(id)
            );

        if (!message) return;

        if (
            String(message.user_id) !==
            String(state.user?.id)
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

        if (!confirmed) return;


        const {
            error
        } = await db
            .from("chat_messages")
            .update({
                content: "[deleted]",
                is_deleted: true,
                updated_at:
                    new Date().toISOString()
            })
            .eq("id", id)
            .eq(
                "user_id",
                state.user.id
            );


        if (error) {

            console.error(
                "Delete failed:",
                error
            );

            toast(
                error.message ||
                "Message could not be deleted.",
                "error"
            );

            return;
        }


        /*
         * Remove attachment records.
         */
        const {
            data: attachments
        } = await db
            .from("chat_attachments")
            .select("*")
            .eq(
                "message_id",
                id
            );


        if (attachments?.length) {

            for (
                const attachment
                of attachments
            ) {

                if (
                    attachment.storage_path
                ) {

                    await db
                        .storage
                        .from("chat-attachments")
                        .remove([
                            attachment.storage_path
                        ]);
                }
            }


            await db
                .from("chat_attachments")
                .delete()
                .eq(
                    "message_id",
                    id
                );
        }


        await loadMessages();

        toast(
            "Message deleted."
        );
    }


    /* =========================================================
       REACTIONS
       ========================================================= */

    async function reactToMessage(
        messageId,
        emoji = "❤️"
    ) {

        if (!state.user) return;


        const {
            data: existing
        } = await db
            .from("chat_message_reactions")
            .select("*")
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
                emoji
            )
            .maybeSingle();


        if (existing) {

            await db
                .from("chat_message_reactions")
                .delete()
                .eq(
                    "id",
                    existing.id
                );

        } else {

            await db
                .from("chat_message_reactions")
                .insert({
                    message_id:
                        messageId,

                    user_id:
                        state.user.id,

                    reaction:
                        emoji
                });
        }
    }


    /* =========================================================
       ATTACHMENTS
       ========================================================= */

    async function uploadAttachment(file) {

        if (!file || !state.user) return;

        if (file.size > 25 * 1024 * 1024) {

            toast(
                "Maximum attachment size is 25 MB.",
                "error"
            );

            return;
        }


        const cleanName =
            file.name
                .replace(/[^a-zA-Z0-9._-]/g, "_");

        const path =
            `${state.user.id}/${Date.now()}-${cleanName}`;


        const upload =
            await db
                .storage
                .from("chat-attachments")
                .upload(
                    path,
                    file,
                    {
                        upsert: false
                    }
                );


        if (upload.error) {

            console.error(
                "Storage upload failed:",
                upload.error
            );

            toast(
                upload.error.message,
                "error"
            );

            return;
        }


        const {
            data: publicData
        } =
            db
                .storage
                .from("chat-attachments")
                .getPublicUrl(path);


        const fileURL =
            publicData?.publicUrl || "";


        const messageInsert =
            await db
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        file.name,

                    message_type:
                        "file",

                    is_deleted:
                        false
                })
                .select("*")
                .single();


        if (messageInsert.error) {

            await db
                .storage
                .from("chat-attachments")
                .remove([path]);

            toast(
                messageInsert.error.message,
                "error"
            );

            return;
        }


        const message =
            messageInsert.data;


        /*
         * First attempt with storage_path.
         */
        let attachmentInsert =
            await db
                .from("chat_attachments")
                .insert({
                    message_id:
                        message.id,

                    uploaded_by:
                        state.user.id,

                    file_url:
                        fileURL,

                    file_name:
                        file.name,

                    file_type:
                        file.type,

                    file_size:
                        file.size,

                    storage_path:
                        path
                });


        /*
         * Compatibility fallback.
         *
         * If the database does not contain
         * storage_path, retry without it.
         */
        if (attachmentInsert.error) {

            attachmentInsert =
                await db
                    .from("chat_attachments")
                    .insert({
                        message_id:
                            message.id,

                        uploaded_by:
                            state.user.id,

                        file_url:
                            fileURL,

                        file_name:
                            file.name,

                        file_type:
                            file.type,

                        file_size:
                            file.size
                    });
        }


        if (attachmentInsert.error) {

            console.error(
                "Attachment row failed:",
                attachmentInsert.error
            );

            await db
                .storage
                .from("chat-attachments")
                .remove([path]);

            await db
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    message.id
                );

            toast(
                attachmentInsert.error.message,
                "error"
            );

            return;
        }


        message.profile =
            state.profile;

        state.messages.push(message);

        await loadMessages();
    }


    /* =========================================================
       VOICE NOTES
       ========================================================= */

    async function startVoiceRecording() {

        if (state.recording) return;

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

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


            const recorder =
                new MediaRecorder(
                    stream
                );

            state.recorder =
                recorder;

            state.voiceChunks =
                [];

            state.recording =
                true;


            recorder.ondataavailable =
                event => {

                    if (event.data.size) {

                        state.voiceChunks.push(
                            event.data
                        );
                    }
                };


            recorder.onstop =
                async () => {

                    const blob =
                        new Blob(
                            state.voiceChunks,
                            {
                                type:
                                    recorder.mimeType ||
                                    "audio/webm"
                            }
                        );

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    state.recording =
                        false;

                    state.recorder =
                        null;

                    updateVoiceButton();

                    if (blob.size) {

                        await sendVoiceNote(
                            blob
                        );
                    }
                };


            recorder.start();

            updateVoiceButton();

        } catch (error) {

            console.error(
                "Microphone error:",
                error
            );

            toast(
                "Microphone permission was denied.",
                "error"
            );
        }
    }


    function stopVoiceRecording() {

        if (
            state.recorder &&
            state.recording
        ) {

            state.recorder.stop();
        }
    }


    function updateVoiceButton() {

        const button =
            $("voiceNoteButton");

        if (!button) return;

        button.textContent =
            state.recording
                ? "⏹️"
                : "🎙️";

        button.classList.toggle(
            "recording",
            state.recording
        );

        button.title =
            state.recording
                ? "Stop recording"
                : "Record voice note";
    }


    async function sendVoiceNote(blob) {

        if (
            !state.user ||
            !state.currentChannel
        ) return;


        const extension =
            blob.type.includes("ogg")
                ? "ogg"
                : "webm";


        const path =
            `${state.user.id}/voice-${Date.now()}.${extension}`;


        const upload =
            await db
                .storage
                .from("chat-attachments")
                .upload(
                    path,
                    blob,
                    {
                        contentType:
                            blob.type ||
                            "audio/webm"
                    }
                );


        if (upload.error) {

            toast(
                upload.error.message,
                "error"
            );

            return;
        }


        const {
            data: publicData
        } =
            db
                .storage
                .from("chat-attachments")
                .getPublicUrl(path);


        const fileURL =
            publicData?.publicUrl || "";


        const messageInsert =
            await db
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    content:
                        "Voice note",

                    message_type:
                        "voice",

                    is_deleted:
                        false
                })
                .select("*")
                .single();


        if (messageInsert.error) {

            await db
                .storage
                .from("chat-attachments")
                .remove([path]);

            toast(
                messageInsert.error.message,
                "error"
            );

            return;
        }


        const message =
            messageInsert.data;


        let attachment =
            await db
                .from("chat_attachments")
                .insert({
                    message_id:
                        message.id,

                    uploaded_by:
                        state.user.id,

                    file_url:
                        fileURL,

                    file_name:
                        `voice-${Date.now()}.${extension}`,

                    file_type:
                        blob.type ||
                        "audio/webm",

                    file_size:
                        blob.size,

                    storage_path:
                        path
                });


        /*
         * Compatibility fallback for schemas
         * where storage_path is absent.
         */
        if (attachment.error) {

            attachment =
                await db
                    .from("chat_attachments")
                    .insert({
                        message_id:
                            message.id,

                        uploaded_by:
                            state.user.id,

                        file_url:
                            fileURL,

                        file_name:
                            `voice-${Date.now()}.${extension}`,

                        file_type:
                            blob.type ||
                            "audio/webm",

                        file_size:
                            blob.size
                    });
        }


        if (attachment.error) {

            console.error(
                "Voice attachment failed:",
                attachment.error
            );

            await db
                .storage
                .from("chat-attachments")
                .remove([path]);

            await db
                .from("chat_messages")
                .delete()
                .eq(
                    "id",
                    message.id
                );

            toast(
                attachment.error.message,
                "error"
            );

            return;
        }


        await loadMessages();
    }


    /* =========================================================
       MESSAGE ACTIONS
       ========================================================= */

    function attachMessageActions() {

        qa(
            "[data-delete-message]"
        ).forEach(button => {

            button.onclick =
                () =>
                    deleteMessage(
                        button.dataset.deleteMessage
                    );
        });


        qa(
            "[data-reaction]"
        ).forEach(button => {

            button.onclick =
                () => {

                    const message =
                        button.closest(
                            "[data-message-id]"
                        );

                    if (!message) return;

                    reactToMessage(
                        message.dataset.messageId,
                        button.dataset.reaction
                    );
                };
        });


        qa(
            "[data-reply-message]"
        ).forEach(button => {

            button.onclick =
                () => {

                    const message =
                        state.messages.find(
                            item =>
                                String(item.id) ===
                                String(
                                    button.dataset.replyMessage
                                )
                        );

                    if (!message) return;

                    $("messageInput").focus();

                    $("messageInput").placeholder =
                        `Replying to ${displayName(
                            message.profile
                        )}...`;

                    state.replyTo =
                        message.id;
                };
        });
    }


    /* =========================================================
       REALTIME
       ========================================================= */

    async function cleanupRealtime() {

        for (
            const channel
            of state.realtime
        ) {

            try {

                await db.removeChannel(
                    channel
                );

            } catch {}
        }

        state.realtime = [];
    }


    async function subscribeCommunityRealtime() {

        await cleanupRealtime();

        if (!state.currentCommunity) return;

        const communityChannel =
            db
                .channel(
                    `mwaniki-community-${state.currentCommunity.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_channels",
                        filter:
                            `community_id=eq.${state.currentCommunity.id}`
                    },
                    async () => {

                        await loadChannels();

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_community_members",
                        filter:
                            `community_id=eq.${state.currentCommunity.id}`
                    },
                    async () => {

                        await loadCommunityMembers();

                    }
                )
                .subscribe();

        state.realtime.push(
            communityChannel
        );

        await subscribeChannelRealtime();
    }


    async function subscribeChannelRealtime() {

        if (!state.currentChannel) return;

        const old =
            state.realtime.filter(
                channel =>
                    channel._mwanikiChannel
            );

        for (
            const channel
            of old
        ) {

            await db.removeChannel(
                channel
            );

            state.realtime =
                state.realtime.filter(
                    item =>
                        item !== channel
                );
        }


        const channel =
            db
                .channel(
                    `mwaniki-messages-${state.currentChannel.id}-${Date.now()}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    async () => {

                        await loadMessages();

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    async () => {

                        await loadMessages();

                    }
                )
                .subscribe();

        channel._mwanikiChannel =
            true;

        state.realtime.push(
            channel
        );
    }


async function markChannelRead(channelId) {
    if (!state.user || !channelId || !supabase) return;

    try {
        const { error } = await supabase
            .from("chat_read_status")
            .upsert(
                {
                    channel_id: channelId,
                    user_id: state.user.id,
                    last_read_at: new Date().toISOString()
                },
                {
                    onConflict: "channel_id,user_id"
                }
            );

        if (error) {
            console.warn("⚠️ Could not update read status:", error);
        }
    } catch (error) {
        console.warn("⚠️ Read status update failed:", error);
    }
}


    /* =========================================================
       CHANNEL SEARCH
       ========================================================= */

    function setupChannelSearch() {

        const input =
            $("channelSearchInput");

        if (!input) return;

        input.addEventListener(
            "input",
            () => {

                state.channelSearch =
                    input.value;

                renderChannels();
            }
        );
    }


    /* =========================================================
       MESSAGE SEARCH
       ========================================================= */

    function setupMessageSearch() {

        $("channelSearchButton")
            ?.addEventListener(
                "click",
                () =>
                    toggle(
                        $("messageSearchBar")
                    )
            );


        $("closeMessageSearchButton")
            ?.addEventListener(
                "click",
                () => {

                    hide(
                        $("messageSearchBar")
                    );

                    state.messageSearch =
                        "";

                    if (
                        $("messageSearchInput")
                    ) {
                        $("messageSearchInput")
                            .value = "";
                    }

                    renderMessages();
                }
            );


        $("messageSearchInput")
            ?.addEventListener(
                "input",
                event => {

                    state.messageSearch =
                        event.target.value;

                    renderMessages();
                }
            );
    }


    /* =========================================================
       EMOJI
       ========================================================= */

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅",
        "😂","🤣","😊","😇","🙂","🙃",
        "😉","😌","😍","🥰","😘","😗",
        "😎","🤓","🧐","🤩","🥳","😢",
        "😭","😡","🤬","😱","😴","🤔",
        "👍","👎","👏","🙌","🙏","❤️",
        "🔥","🎉","💯","💙","💚","💛",
        "💜","🩺","🧪","🧬","📚","🎓",
        "📝","💡","🏆","🎮","😂"
    ];


    function setupEmojiPicker() {

        renderEmojiGrid();


        $("emojiButton")
            ?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    const panel =
                        $("emojiPanel");

                    const opening =
                        panel?.classList.contains(
                            "hidden"
                        );

                    closeAllPickers();

                    if (opening) {
                        show(panel);
                    }
                }
            );


        $("closeEmojiButton")
            ?.addEventListener(
                "click",
                () =>
                    hide($("emojiPanel"))
            );


        $("emojiSearch")
            ?.addEventListener(
                "input",
                event => {

                    const term =
                        event.target.value
                            .toLowerCase();

                    renderEmojiGrid(
                        term
                    );
                }
            );
    }


    function renderEmojiGrid(
        search = ""
    ) {

        const grid =
            $("emojiGrid");

        if (!grid) return;

        grid.innerHTML = "";

        EMOJIS
            .filter(
                emoji =>
                    !search ||
                    emoji.includes(search)
            )
            .forEach(
                emoji => {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type = "button";

                    button.className =
                        "emoji-button";

                    button.textContent =
                        emoji;

                    button.onclick =
                        () => {

                            insertAtCursor(
                                emoji
                            );

                            hide(
                                $("emojiPanel")
                            );
                        };

                    grid.appendChild(
                        button
                    );
                }
            );
    }


    function insertAtCursor(text) {

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
            text +
            input.value.slice(
                end
            );

        input.focus();

        input.selectionStart =
            input.selectionEnd =
                start + text.length;
    }


    /* =========================================================
       STICKERS / GIF UI
       ========================================================= */

    function setupMediaPickers() {

        $("stickerButton")
            ?.addEventListener(
                "click",
                () => {

                    const panel =
                        $("stickerPanel");

                    const opening =
                        panel.classList.contains(
                            "hidden"
                        );

                    closeAllPickers();

                    if (opening) {

                        renderStickerGrid();

                        show(panel);
                    }
                }
            );


        $("closeStickerButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("stickerPanel")
                    )
            );


        $("gifButton")
            ?.addEventListener(
                "click",
                () => {

                    const panel =
                        $("gifPanel");

                    const opening =
                        panel.classList.contains(
                            "hidden"
                        );

                    closeAllPickers();

                    if (opening) {

                        renderGifGrid();

                        show(panel);
                    }
                }
            );


        $("closeGifButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("gifPanel")
                    )
            );
    }


    function renderStickerGrid() {

        const grid =
            $("stickerGrid");

        if (!grid) return;

        grid.innerHTML = "";

        [
            "🎓","🩺","🧪","🧬",
            "📚","💡","🔥","😂",
            "🎉","🏆","💯","👏"
        ].forEach(
            sticker => {

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "sticker-button";

                button.textContent =
                    sticker;

                button.onclick =
                    () => {

                        insertAtCursor(
                            sticker
                        );

                        hide(
                            $("stickerPanel")
                        );
                    };

                grid.appendChild(
                    button
                );
            }
        );
    }


    function renderGifGrid() {

        const grid =
            $("gifGrid");

        if (!grid) return;

        grid.innerHTML = `
            <div class="gif-placeholder">
                <span>GIF</span>
                <p>
                    GIF search is ready for
                    a provider/API integration.
                </p>
            </div>
        `;
    }


    /* =========================================================
       ATTACHMENT INPUT
       ========================================================= */

    function setupAttachments() {

        $("attachButton")
            ?.addEventListener(
                "click",
                () =>
                    $("attachmentInput")
                        ?.click()
            );


        $("attachmentInput")
            ?.addEventListener(
                "change",
                event => {

                    const files =
                        [...(
                            event.target.files ||
                            []
                        )];

                    if (!files.length) return;

                    /*
                     * Send one by one.
                     */
                    files.reduce(
                        (promise, file) =>
                            promise.then(
                                () =>
                                    uploadAttachment(
                                        file
                                    )
                            ),
                        Promise.resolve()
                    );

                    event.target.value = "";
                }
            );
    }


    /* =========================================================
       VOICE BUTTON
       ========================================================= */

    function setupVoiceNotes() {

        $("voiceNoteButton")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        state.recording
                    ) {

                        stopVoiceRecording();

                    } else {

                        startVoiceRecording();
                    }
                }
            );
    }


    /* =========================================================
       COMPOSER
       ========================================================= */

    function setupComposer() {

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

                    event.target.style.height =
                        "auto";

                    event.target.style.height =
                        Math.min(
                            event.target.scrollHeight,
                            180
                        ) + "px";
                }
            );
    }


    /* =========================================================
       MEMBER SIDEBAR
       ========================================================= */

    function setupMemberSidebar() {

        $("channelMembersButton")
            ?.addEventListener(
                "click",
                () => {

                    $("memberSidebar")
                        ?.classList.toggle(
                            "open"
                        );
                }
            );


        $("closeMemberSidebarButton")
            ?.addEventListener(
                "click",
                () => {

                    $("memberSidebar")
                        ?.classList.remove(
                            "open"
                        );
                }
            );


        $("memberSearchInput")
            ?.addEventListener(
                "input",
                event => {

                    state.memberSearch =
                        event.target.value;

                    renderMembers();
                }
            );
    }


    /* =========================================================
       MODALS
       ========================================================= */

    function setupModals() {

        $("communityRulesButton")
            ?.addEventListener(
                "click",
                () =>
                    show(
                        $("rulesModal")
                    )
            );


        $("closeRulesButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("rulesModal")
                    )
            );


        $("profileButton")
            ?.addEventListener(
                "click",
                () => {

                    renderProfileModal();

                    show(
                        $("profileModal")
                    );
                }
            );


        $("closeProfileButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("profileModal")
                    )
            );


        $("friendsButton")
            ?.addEventListener(
                "click",
                () => {

                    renderFriends();

                    show(
                        $("friendsModal")
                    );
                }
            );


        $("closeFriendsButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("friendsModal")
                    )
            );


        $("closeContestButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("contestModal")
                    )
            );


        $("mobileSidebarButton")
            ?.addEventListener(
                "click",
                () =>
                    $("channelSidebar")
                        ?.classList.toggle(
                            "mobile-open"
                        )
            );


        document.addEventListener(
            "click",
            event => {

                if (
                    event.target.classList.contains(
                        "modal-overlay"
                    )
                ) {

                    hide(
                        event.target
                    );
                }
            }
        );
    }


    function renderProfileModal() {

        const content =
            $("profileModalContent");

        if (!content) return;

        const name =
            displayName(
                state.profile
            );

        const avatar =
            avatarURL(
                state.profile
            );

        content.innerHTML = `

            <div class="profile-preview">

                ${
                    avatar
                        ? `
                            <img
                                src="${escapeHTML(
                                    avatar
                                )}"
                                class="profile-large-avatar"
                                alt=""
                            >
                        `
                        : `
                            <div class="profile-large-avatar fallback-avatar">
                                ${escapeHTML(
                                    initials(name)
                                )}
                            </div>
                        `
                }

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <p>
                    ${escapeHTML(
                        state.user?.email ||
                        ""
                    )}
                </p>

            </div>
        `;
    }


    function renderFriends() {

        const content =
            $("friendsContent");

        if (!content) return;

        content.innerHTML = `

            <div class="empty-state">

                <strong>
                    Friends system
                </strong>

                <span>
                    Community members can be
                    connected through the member
                    panel.
                </span>

            </div>
        `;
    }


    /* =========================================================
       CONTEST
       ========================================================= */

    function setupContest() {

        $("contestChannelButton")
            ?.addEventListener(
                "click",
                () => {

                    populateContestCourses();

                    show(
                        $("contestModal")
                    );
                }
            );
    }


    function populateContestCourses() {

        const selector =
            $("contestCourseSelector");

        if (!selector) return;

        selector.innerHTML = `
            <option value="">
                Select a course
            </option>
        `;

        state.courses.forEach(
            course => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    course.id;

                option.textContent =
                    course.title;

                selector.appendChild(
                    option
                );
            }
        );
    }


    /* =========================================================
       GLOBAL CALL EVENTS
       ========================================================= */

    function setupCallButtons() {

        /*
         * Individual call button in the
         * member sidebar is handled above.
         *
         * General Call opens the visual
         * online-user picker.
         */
        $("generalCallButton")
            ?.addEventListener(
                "click",
                () => {

                    window.MwanikiCalls
                        ?.openPicker(
                            null
                        );
                }
            );


        /*
         * Community Call calls everyone
         * currently online in THIS community.
         */
        $("communityCallButton")
            ?.addEventListener(
                "click",
                () => {

                    if (
                        !state.currentCommunity
                    ) return;

                    window.MwanikiCalls
                        ?.callCommunity(
                            state.currentCommunity.id,
                            "audio"
                        );
                }
            );
    }


    /* =========================================================
       HOME
       ========================================================= */

    function setupHomeButton() {

        $("communityHomeButton")
            ?.addEventListener(
                "click",
                () => {

                    const discussion =
                        state.channels.find(
                            channel =>
                                !channel.course_id
                        );

                    if (discussion) {

                        selectChannel(
                            discussion.id
                        );
                    }
                }
            );
    }


    /* =========================================================
       GLOBAL API
       ========================================================= */

    window.MwanikiCommunity = {

        getCurrentCommunityId() {

            return (
                state.currentCommunity?.id ||
                null
            );
        },

        getCurrentCommunity() {

            return (
                state.currentCommunity ||
                null
            );
        },

        getCurrentUser() {

            return state.user;
        },

        getCurrentProfile() {

            return state.profile;
        },

        getCommunityMembers() {

            return state.members;
        },

        async getOnlineUsers(
            communityId = null
        ) {

            let query =
                db
                    .from("chat_presence")
                    .select(
                        "user_id,status,last_seen_at"
                    )
                    .eq(
                        "status",
                        "online"
                    );

            const result =
                await query;

            const presence =
                result.data || [];

            const now =
                Date.now();

            const online =
                presence.filter(row => {

                    if (
                        !row.last_seen_at
                    ) {
                        return true;
                    }

                    return (
                        now -
                        new Date(
                            row.last_seen_at
                        ).getTime()
                    ) < 120000;
                });


            if (!communityId) {

                return online;
            }


            const members =
                await db
                    .from(
                        "chat_community_members"
                    )
                    .select("user_id")
                    .eq(
                        "community_id",
                        communityId
                    );


            const ids =
                new Set(
                    (members.data || [])
                        .map(
                            member =>
                                String(
                                    member.user_id
                                )
                        )
                );


            return online.filter(
                row =>
                    ids.has(
                        String(
                            row.user_id
                        )
                    )
            );
        }
    };


    /* =========================================================
       AUTH LISTENER
       ========================================================= */

    db.auth.onAuthStateChange(
        async (event) => {

            if (
                event === "SIGNED_OUT"
            ) {

                window.location.href =
                    "./index.html";

                return;
            }

        }
    );


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {

        if (state.initialized) return;

        state.initialized =
            true;

        console.log(
            "🚀 Mwaniki Scholars Community starting..."
        );


        const user =
            await loadUser();

        if (!user) {

            window.location.href =
                "./index.html";

            return;
        }


        await loadProfile();

        await loadCourses();

        setupChannelSearch();

        setupMessageSearch();

        setupEmojiPicker();

        setupMediaPickers();

        setupAttachments();

        setupVoiceNotes();

        setupComposer();

        setupMemberSidebar();

        setupModals();

        setupContest();

        setupCallButtons();

        setupHomeButton();


        /*
         * Close pickers when clicking
         * outside them.
         */
        document.addEventListener(
            "click",
            event => {

                const insidePicker =
                    event.target.closest(
                        ".picker-panel"
                    );

                const pickerButton =
                    event.target.closest(
                        "#emojiButton,#stickerButton,#gifButton"
                    );

                if (
                    !insidePicker &&
                    !pickerButton
                ) {

                    closeAllPickers();
                }
            }
        );


        await loadCommunities();

        await updateMemberPresenceDots();

        console.log(
            "✅ Mwaniki Scholars Community ready."
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();
    }

})();
