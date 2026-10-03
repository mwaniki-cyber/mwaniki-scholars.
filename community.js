/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   community.js
   CLEAN CHAT / COMMUNITY ENGINE

   Responsibilities:
   - Communities
   - Channels
   - Messages
   - Profiles
   - Presence
   - Reactions
   - Attachments
   - Voice notes
   - Emoji / stickers
   - Friends UI
   - Tickets
   - Rules
   - Message deletion
   - Attachment cleanup
   - Realtime chat

   IMPORTANT:
   - WebRTC is NOT handled here.
   - Calling belongs exclusively to call.js.
   ============================================================ */

import { supabase } from "./supabase.js";

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    const db = supabase;

    if (!db) {
        console.error("❌ Supabase client unavailable.");
        return;
    }

    /* ========================================================
       STATE
       ======================================================== */

    const state = {
        user: null,
        profile: null,

        communities: [],
        channels: [],
        members: [],
        messages: [],

        currentCommunity: null,
        currentChannel: null,

        currentRole: "student",

        selectedFiles: [],

        replyingTo: null,

        presenceTimer: null,

        messageRealtime: null,
        communityRealtime: null,

        initialized: false,
        loadingMessages: false,
        sendingMessage: false,

        mediaRecorder: null,
        mediaChunks: [],
        recordingVoice: false,

        activePicker: null,

        friends: [],
        friendRequests: []
    };

    /* ========================================================
       DOM
       ======================================================== */

    const $ = id => document.getElementById(id);

    const el = {
        communityRail: $("communityRail"),
        communityRailList: $("communityRailList"),

        selectedCommunityIcon: $("selectedCommunityIcon"),
        selectedCommunityName: $("selectedCommunityName"),
        selectedCommunityDescription:
            $("selectedCommunityDescription"),

        informationChannels: $("informationChannels"),
        courseChannels: $("courseChannels"),
        communityChannels: $("communityChannels"),

        currentChannelIcon: $("currentChannelIcon"),
        currentChannelName: $("currentChannelName"),
        currentChannelDescription:
            $("currentChannelDescription"),

        messageList: $("messageList"),
        messageInput: $("messageInput"),
        sendMessageButton: $("sendMessageButton"),

        attachmentButton: $("attachButton"),
        attachmentInput: $("attachmentInput"),
        attachmentPreview: $("attachmentPreview"),

        emojiButton: $("emojiButton"),
        emojiPanel: $("emojiPanel"),
        emojiSearch: $("emojiSearch"),
        emojiGrid: $("emojiGrid"),

        stickerButton: $("stickerButton"),
        stickerPanel: $("stickerPanel"),
        stickerGrid: $("stickerGrid"),

        gifButton: $("gifButton"),
        gifPanel: $("gifPanel"),
        gifSearch: $("gifSearch"),
        gifGrid: $("gifGrid"),

        voiceNoteButton: $("voiceNoteButton"),

        communityCallButton:
            $("communityCallButton"),

        generalCallButton:
            $("generalCallButton"),

        channelMembersButton:
            $("channelMembersButton"),

        channelSearchButton:
            $("channelSearchButton"),

        memberSidebar:
            $("memberSidebar"),

        memberList:
            $("memberList"),

        memberCount:
            $("memberCount"),

        profileButton:
            $("profileButton"),

        profileModal:
            $("profileModal"),

        profileModalContent:
            $("profileModalContent"),

        friendsButton:
            $("friendsButton"),

        friendsModal:
            $("friendsModal"),

        friendsContent:
            $("friendsContent"),

        friendRequestBadge:
            $("friendRequestBadge"),

        ticketButton:
            $("ticketButton"),

        ticketModal:
            $("ticketModal"),

        ticketForm:
            $("ticketForm"),

        rulesButton:
            $("communityRulesButton"),

        rulesModal:
            $("rulesModal"),

        contestChannelButton:
            $("contestChannelButton"),

        toast:
            $("toast"),

        filePreviewModal:
            $("filePreviewModal"),

        filePreviewContent:
            $("filePreviewContent"),

        confirmAttachmentButton:
            $("confirmAttachmentButton"),

        callModal:
            $("callModal"),

        callSpecificPersonButton:
            $("callSpecificPersonButton"),

        callWholeCommunityButton:
            $("callWholeCommunityButton")
    };

    /* ========================================================
       HELPERS
       ======================================================== */

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function escapeAttribute(value) {
        return escapeHTML(value);
    }

    function initials(name) {
        const value =
            String(name || "Mwaniki Scholar")
                .trim()
                .replace(/\s+/g, " ");

        const parts =
            value.split(" ").filter(Boolean);

        if (!parts.length) {
            return "MS";
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

    function getName(profile, fallback = "Mwaniki Scholar") {
        return (
            profile?.display_name ||
            profile?.full_name ||
            profile?.name ||
            profile?.student_name ||
            profile?.username ||
            fallback
        );
    }

    function getAvatar(profile) {
        return (
            profile?.avatar_url ||
            profile?.photo_url ||
            profile?.profile_image ||
            profile?.image_url ||
            ""
        );
    }

    function toast(message, type = "normal") {
        if (!el.toast) {
            console.log(message);
            return;
        }

        el.toast.textContent = message;
        el.toast.classList.remove(
            "hidden",
            "show",
            "visible",
            "active",
            "error",
            "success"
        );

        el.toast.classList.add(type);

        clearTimeout(toast.timer);

        toast.timer = setTimeout(() => {
            el.toast.classList.add("hidden");
        }, 3500);
    }

    function openModal(modal) {
        if (!modal) return;

        modal.hidden = false;
        modal.classList.remove("hidden");
        modal.classList.add("open");
    }

    function closeModal(modal) {
        if (!modal) return;

        modal.classList.remove("open");

        setTimeout(() => {
            modal.hidden = true;
            modal.classList.add("hidden");
        }, 120);
    }

    function formatTime(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat(
            undefined,
            {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);
    }

    /* ========================================================
       AUTH
       ======================================================== */

    async function loadUser() {
        const {
            data,
            error
        } = await db.auth.getUser();

        if (error || !data?.user) {
            console.error(
                "❌ Authentication failed:",
                error
            );

            window.location.href =
                "./index.html";

            return false;
        }

        state.user = data.user;

        console.log(
            "✅ Authenticated:",
            state.user.id
        );

        return true;
    }

    /* ========================================================
       PROFILE
       ======================================================== */

    async function loadProfile() {
        if (!state.user) return;

        const sources = [
            {
                table: "chat_public_profiles",
                idColumn: "id"
            },
            {
                table: "students",
                idColumn: "id"
            },
            {
                table: "profiles",
                idColumn: "id"
            }
        ];

        for (const source of sources) {
            try {
                const {
                    data,
                    error
                } = await db
                    .from(source.table)
                    .select("*")
                    .eq(
                        source.idColumn,
                        state.user.id
                    )
                    .maybeSingle();

                if (!error && data) {
                    state.profile = data;
                    break;
                }
            } catch (_) {}
        }

        updateHeaderProfile();
    }

    function updateHeaderProfile() {
        const name =
            getName(
                state.profile,
                state.user?.email
                    ?.split("@")[0] ||
                "Account"
            );

        const avatar =
            getAvatar(state.profile);

        const nameElement =
            $("headerProfileName");

        const avatarElement =
            $("headerProfileAvatar");

        if (nameElement) {
            nameElement.textContent = name;
        }

        if (avatarElement) {
            if (avatar) {
                avatarElement.innerHTML = `
                    <img
                        src="${escapeAttribute(avatar)}"
                        alt="${escapeAttribute(name)}"
                    >
                `;
            } else {
                avatarElement.textContent =
                    initials(name);
            }
        }
    }

    /* ========================================================
       COMMUNITIES
       ======================================================== */

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
                banner_url,
                is_public,
                is_active,
                created_by,
                created_at
            `)
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error(
                "❌ Communities failed:",
                error
            );

            return;
        }

        state.communities = data || [];

        console.log(
            "✅ Communities loaded:",
            state.communities.length
        );

        renderCommunityRail();

        selectInitialCommunity();
    }

    function communityFallbackIcon(community) {
        const slug =
            String(
                community?.slug ||
                community?.name ||
                ""
            ).toLowerCase();

        if (slug.includes("gaming")) {
            return "🎮";
        }

        if (slug.includes("meme")) {
            return "😂";
        }

        if (slug.includes("scholar")) {
            return "🎓";
        }

        return "💬";
    }

    function communityIconHTML(community) {
        if (community?.icon_url) {
            return `
                <img
                    src="${escapeAttribute(
                        community.icon_url
                    )}"
                    alt="${escapeAttribute(
                        community.name
                    )}"
                >
            `;
        }

        return escapeHTML(
            communityFallbackIcon(community)
        );
    }

    function renderCommunityRail() {
        if (!el.communityRailList) return;

        if (!state.communities.length) {
            el.communityRailList.innerHTML = `
                <div class="empty-state">
                    No communities available.
                </div>
            `;
            return;
        }

        el.communityRailList.innerHTML =
            state.communities
                .map(community => {
                    const active =
                        state.currentCommunity &&
                        String(
                            state.currentCommunity.id
                        ) ===
                        String(community.id);

                    return `
                        <button
                            type="button"
                            class="community-rail-item ${
                                active ? "active" : ""
                            }"
                            data-community-id="${
                                escapeAttribute(
                                    community.id
                                )
                            }"
                            title="${escapeAttribute(
                                community.name
                            )}"
                        >
                            <span class="community-rail-icon">
                                ${communityIconHTML(
                                    community
                                )}
                            </span>
                            <span class="community-rail-label">
                                ${escapeHTML(
                                    community.name
                                )}
                            </span>
                        </button>
                    `;
                })
                .join("");
    }

    function selectInitialCommunity() {
        if (!state.communities.length) {
            return;
        }

        const params =
            new URLSearchParams(
                window.location.search
            );

        const requestedId =
            params.get("community_id") ||
            localStorage.getItem(
                "mwanikiCommunityId"
            );

        let community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(requestedId)
            );

        if (!community) {
            community =
                state.communities[0];
        }

        selectCommunity(community.id);
    }

    async function selectCommunity(
        communityId
    ) {
        const community =
            state.communities.find(
                item =>
                    String(item.id) ===
                    String(communityId)
            );

        if (!community) return;

        state.currentCommunity =
            community;

        state.currentChannel = null;

        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );

        renderCommunityRail();

        renderSelectedCommunity();

        await loadCommunityMembers(
            community.id
        );

        await loadChannels(
            community.id
        );

        setupCommunityRealtime(
            community.id
        );
    }

    function renderSelectedCommunity() {
        const community =
            state.currentCommunity;

        if (!community) return;

        if (el.selectedCommunityIcon) {
            el.selectedCommunityIcon.innerHTML =
                communityIconHTML(
                    community
                );
        }

        if (el.selectedCommunityName) {
            el.selectedCommunityName.textContent =
                community.name;
        }

        if (
            el.selectedCommunityDescription
        ) {
            el.selectedCommunityDescription.textContent =
                community.description ||
                "Academic community";
        }
    }

    /* ========================================================
       CHANNELS
       ======================================================== */

    async function loadChannels(
        communityId
    ) {
        const {
            data,
            error
        } = await db
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
                created_by,
                created_at
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
            .order("position", {
                ascending: true
            })
            .order("created_at", {
                ascending: true
            });

        if (error) {
            console.error(
                "❌ Channels failed:",
                error
            );

            return;
        }

        state.channels =
            data || [];

        renderChannels();

        const defaultChannel =
            findDefaultChannel();

        if (defaultChannel) {
            await selectChannel(
                defaultChannel.id
            );
        }
    }

    function findDefaultChannel() {
        if (!state.channels.length) {
            return null;
        }

        return (
            state.channels.find(
                channel =>
                    String(channel.name)
                        .toLowerCase() ===
                    "general"
            ) ||
            state.channels[0]
        );
    }

    function channelIcon(channel) {
        if (channel.icon) {
            return channel.icon;
        }

        if (
            channel.channel_type ===
            "course"
        ) {
            return "📚";
        }

        if (
            String(channel.name)
                .toLowerCase()
                .includes("contest")
        ) {
            return "🏆";
        }

        return "#";
    }

    function channelButton(channel) {
        const active =
            state.currentChannel &&
            String(
                state.currentChannel.id
            ) ===
            String(channel.id);

        return `
            <button
                type="button"
                class="channel-button ${
                    active ? "active" : ""
                }"
                data-channel-id="${
                    escapeAttribute(channel.id)
                }"
            >
                <span class="channel-icon">
                    ${escapeHTML(
                        channelIcon(channel)
                    )}
                </span>

                <span class="channel-name">
                    ${escapeHTML(
                        channel.name
                    )}
                </span>
            </button>
        `;
    }

    function renderChannels() {
        const information = [];
        const courses = [];
        const community = [];

        state.channels.forEach(channel => {
            const type =
                String(
                    channel.channel_type ||
                    ""
                ).toLowerCase();

            if (
                type === "course" ||
                channel.course_id
            ) {
                courses.push(channel);
                return;
            }

            if (
                type === "announcement" ||
                type === "information" ||
                String(channel.name)
                    .toLowerCase()
                    .includes("announcement")
            ) {
                information.push(channel);
                return;
            }

            community.push(channel);
        });

        if (el.informationChannels) {
            el.informationChannels.innerHTML =
                information.length
                    ? information
                        .map(channelButton)
                        .join("")
                    : `
                        <div class="channel-empty">
                            No information channels
                        </div>
                    `;
        }

        if (el.courseChannels) {
            el.courseChannels.innerHTML =
                courses.length
                    ? courses
                        .map(channelButton)
                        .join("")
                    : `
                        <div class="channel-empty">
                            No course channels
                        </div>
                    `;
        }

        if (el.communityChannels) {
            el.communityChannels.innerHTML =
                community.length
                    ? community
                        .map(channelButton)
                        .join("")
                    : `
                        <div class="channel-empty">
                            No community channels
                        </div>
                    `;
        }
    }

    async function selectChannel(channelId) {
        const channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(channelId)
            );

        if (!channel) return;

        state.currentChannel =
            channel;

        localStorage.setItem(
            "mwanikiCommunityChannelId",
            String(channel.id)
        );

        renderChannels();

        if (el.currentChannelIcon) {
            el.currentChannelIcon.textContent =
                channelIcon(channel);
        }

        if (el.currentChannelName) {
            el.currentChannelName.textContent =
                channel.name;
        }

        if (
            el.currentChannelDescription
        ) {
            el.currentChannelDescription.textContent =
                channel.description ||
                "Community discussion";
        }

        await loadMessages(
            channel.id
        );

        setupMessageRealtime(
            channel.id
        );
    }

    /* ========================================================
       MEMBERS
       ======================================================== */

    async function loadCommunityMembers(
        communityId
    ) {
        const {
            data,
            error
        } = await db
            .from(
                "chat_community_members"
            )
            .select(`
                user_id,
                nickname,
                display_name,
                avatar_url,
                role,
                status,
                is_muted,
                is_banned
            `)
            .eq(
                "community_id",
                communityId
            )
            .eq(
                "is_banned",
                false
            );

        if (error) {
            console.error(
                "❌ Members failed:",
                error
            );

            state.members = [];
            renderMembers();

            return;
        }

        state.members = data || [];

        renderMembers();
    }

    async function enrichMember(member) {
        if (
            member.display_name ||
            member.avatar_url
        ) {
            return member;
        }

        try {
            const {
                data
            } = await db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .eq(
                    "id",
                    member.user_id
                )
                .maybeSingle();

            if (data) {
                return {
                    ...member,
                    display_name:
                        data.display_name ||
                        data.full_name ||
                        data.name,
                    avatar_url:
                        data.avatar_url ||
                        data.photo_url
                };
            }
        } catch (_) {}

        return member;
    }

    async function renderMembers() {
        if (!el.memberList) return;

        if (!state.members.length) {
            el.memberList.innerHTML = `
                <div class="empty-state">
                    No members found.
                </div>
            `;

            if (el.memberCount) {
                el.memberCount.textContent =
                    "0";
            }

            return;
        }

        const enriched =
            await Promise.all(
                state.members.map(
                    enrichMember
                )
            );

        if (el.memberCount) {
            el.memberCount.textContent =
                String(enriched.length);
        }

        el.memberList.innerHTML =
            enriched
                .map(member => {
                    const name =
                        member.display_name ||
                        member.nickname ||
                        "Mwaniki Scholar";

                    const avatar =
                        member.avatar_url;

                    const status =
                        String(
                            member.status ||
                            "offline"
                        ).toLowerCase();

                    return `
                        <button
                            type="button"
                            class="member-item"
                            data-user-id="${
                                escapeAttribute(
                                    member.user_id
                                )
                            }"
                        >
                            <span class="member-avatar">
                                ${
                                    avatar
                                        ? `
                                            <img
                                                src="${escapeAttribute(
                                                    avatar
                                                )}"
                                                alt="${escapeAttribute(
                                                    name
                                                )}"
                                            >
                                        `
                                        : escapeHTML(
                                            initials(name)
                                        )
                                }
                            </span>

                            <span class="member-info">
                                <strong>
                                    ${escapeHTML(name)}
                                </strong>

                                <small>
                                    <span class="presence-dot ${escapeAttribute(
                                        status
                                    )}"></span>
                                    ${escapeHTML(
                                        member.role ||
                                        "student"
                                    )}
                                </small>
                            </span>
                        </button>
                    `;
                })
                .join("");
    }
/* =========================================================
   BACK TO DASHBOARD
   ========================================================= */

function setupCommunityHomeButton() {

    const button = document.getElementById(
        "communityHomeButton"
    );

    if (!button) {
        console.warn(
            "⚠️ #communityHomeButton was not found."
        );
        return;
    }

    button.addEventListener(
        "click",
        function () {

            console.log(
                "🏠 Returning to Mwaniki Scholars dashboard..."
            );

            window.location.href = "./dashboard.html";
        }
    );

    console.log(
        "✅ Community Home button activated."
    );
}
    /* ========================================================
       MESSAGES
       ======================================================== */

    async function loadMessages(
        channelId
    ) {
        if (!channelId) return;

        state.loadingMessages = true;

        if (el.messageList) {
            el.messageList.innerHTML = `
                <div class="message-loading">
                    Loading messages...
                </div>
            `;
        }

        const {
            data,
            error
        } = await db
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
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            )
            .limit(500);

        if (error) {
            console.error(
                "❌ Messages failed:",
                error
            );

            state.messages = [];

            renderMessages();

            state.loadingMessages = false;

            return;
        }

        state.messages =
            data || [];

        await attachMessageProfiles();

        await attachMessageAttachments();

        renderMessages();

        state.loadingMessages = false;

        scrollMessagesToBottom();
    }

    async function attachMessageProfiles() {
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

        if (!ids.length) return;

        try {
            const {
                data
            } = await db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .in("id", ids);

            const map =
                new Map(
                    (data || []).map(
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
                                message.user_id
                            ) || null
                    })
                );
        } catch (error) {
            console.warn(
                "⚠️ Profile enrichment failed:",
                error
            );
        }
    }

    async function attachMessageAttachments() {
        const ids =
            state.messages
                .map(
                    message =>
                        message.id
                )
                .filter(Boolean);

        if (!ids.length) return;

        try {
            const {
                data,
                error
            } = await db
                .from(
                    "chat_attachments"
                )
                .select(`
                    id,
                    message_id,
                    uploaded_by,
                    file_name,
                    file_path,
                    file_url,
                    mime_type,
                    file_size,
                    created_at
                `)
                .in(
                    "message_id",
                    ids
                );

            if (error) {
                console.warn(
                    "⚠️ Attachment lookup failed:",
                    error
                );

                return;
            }

            const map = new Map();

            (data || []).forEach(
                attachment => {
                    if (
                        !map.has(
                            attachment.message_id
                        )
                    ) {
                        map.set(
                            attachment.message_id,
                            []
                        );
                    }

                    map.get(
                        attachment.message_id
                    ).push(
                        attachment
                    );
                }
            );

            state.messages =
                state.messages.map(
                    message => ({
                        ...message,
                        attachments:
                            map.get(
                                message.id
                            ) || []
                    })
                );
        } catch (error) {
            console.warn(
                "⚠️ Attachment enrichment failed:",
                error
            );
        }
    }

    function renderMessages() {
        if (!el.messageList) return;

        if (!state.messages.length) {
            el.messageList.innerHTML = `
                <div class="empty-state message-empty">
                    <div>💬</div>
                    <strong>No messages yet</strong>
                    <span>
                        Start the academic discussion.
                    </span>
                </div>
            `;

            return;
        }

        el.messageList.innerHTML =
            state.messages
                .map(renderMessage)
                .join("");

        bindRenderedMessageActions();
    }

    function renderMessage(message) {
        const mine =
            String(message.user_id) ===
            String(state.user?.id);

        const name =
            getName(
                message.profile,
                mine
                    ? "You"
                    : "Mwaniki Scholar"
            );

        const avatar =
            getAvatar(
                message.profile
            );

        const canDelete =
            mine ||
            hasStaffPermission();

        const content =
            message.is_deleted
                ? `
                    <div class="message-deleted">
                        This message was deleted.
                    </div>
                `
                : formatMessageContent(
                    message.content
                );

        const attachments =
            message.is_deleted
                ? ""
                : renderAttachments(
                    message.attachments || []
                );

        return `
            <article
                class="message ${
                    mine ? "own-message" : ""
                }"
                data-message-id="${
                    escapeAttribute(
                        message.id
                    )
                }"
            >
                <div class="message-avatar">
                    ${
                        avatar
                            ? `
                                <img
                                    src="${escapeAttribute(
                                        avatar
                                    )}"
                                    alt="${escapeAttribute(
                                        name
                                    )}"
                                >
                            `
                            : escapeHTML(
                                initials(name)
                            )
                    }
                </div>

                <div class="message-main">

                    <div class="message-meta">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <span>
                            ${formatDate(
                                message.created_at
                            )}
                        </span>

                        ${
                            message.is_edited
                                ? `
                                    <span>
                                        edited
                                    </span>
                                `
                                : ""
                        }
                    </div>

                    <div class="message-content">
                        ${content}
                    </div>

                    ${attachments}

                    <div class="message-actions">

                        <button
                            type="button"
                            data-message-action="reply"
                            data-message-id="${
                                escapeAttribute(
                                    message.id
                                )
                            }"
                            title="Reply"
                        >
                            ↩
                        </button>

                        <button
                            type="button"
                            data-message-action="react"
                            data-message-id="${
                                escapeAttribute(
                                    message.id
                                )
                            }"
                            title="React"
                        >
                            😊
                        </button>

                        ${
                            canDelete
                                ? `
                                    <button
                                        type="button"
                                        data-message-action="delete"
                                        data-message-id="${
                                            escapeAttribute(
                                                message.id
                                            )
                                        }"
                                        title="Delete message for everyone"
                                    >
                                        🗑
                                    </button>
                                `
                                : ""
                        }

                    </div>
                </div>
            </article>
        `;
    }

    function formatMessageContent(
        content
    ) {
        const safe =
            escapeHTML(
                content || ""
            );

        return safe.replace(
            /\n/g,
            "<br>"
        );
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
                    .map(renderAttachment)
                    .join("")}
            </div>
        `;
    }

    function renderAttachment(
        attachment
    ) {
        const mime =
            String(
                attachment.mime_type ||
                ""
            ).toLowerCase();

        const url =
            attachment.file_url ||
            "";

        const name =
            attachment.file_name ||
            "Attachment";

        if (!url) {
            return `
                <div class="attachment-error">
                    Attachment unavailable
                </div>
            `;
        }

        if (mime.startsWith("image/")) {
            return `
                <a
                    class="attachment-image"
                    href="${escapeAttribute(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img
                        src="${escapeAttribute(url)}"
                        alt="${escapeAttribute(name)}"
                        loading="lazy"
                    >
                </a>
            `;
        }

        if (mime.startsWith("audio/")) {
            return `
                <div class="attachment-audio">
                    <strong>
                        🎙️ ${escapeHTML(name)}
                    </strong>

                    <audio
                        controls
                        preload="metadata"
                        src="${escapeAttribute(url)}"
                    ></audio>
                </div>
            `;
        }

        if (mime.startsWith("video/")) {
            return `
                <video
                    class="attachment-video"
                    controls
                    preload="metadata"
                    src="${escapeAttribute(url)}"
                ></video>
            `;
        }

        return `
            <a
                class="attachment-file"
                href="${escapeAttribute(url)}"
                target="_blank"
                rel="noopener noreferrer"
                download
            >
                📎
                <span>
                    ${escapeHTML(name)}
                </span>
            </a>
        `;
    }

    /* ========================================================
       MESSAGE ACTIONS
       ======================================================== */

    function bindRenderedMessageActions() {
        document
            .querySelectorAll(
                "[data-message-action]"
            )
            .forEach(button => {
                button.onclick =
                    async event => {
                        event.preventDefault();
                        event.stopPropagation();

                        const action =
                            button.dataset
                                .messageAction;

                        const messageId =
                            button.dataset
                                .messageId;

                        if (
                            action ===
                            "delete"
                        ) {
                            await deleteMessage(
                                messageId
                            );
                        }

                        if (
                            action ===
                            "reply"
                        ) {
                            startReply(
                                messageId
                            );
                        }

                        if (
                            action ===
                            "react"
                        ) {
                            await addReaction(
                                messageId,
                                "👍"
                            );
                        }
                    };
            });
    }

    function startReply(messageId) {
        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) return;

        state.replyingTo =
            message;

        if (el.messageInput) {
            el.messageInput.focus();
            el.messageInput.placeholder =
                `Replying to ${getName(
                    message.profile,
                    "member"
                )}...`;
        }

        toast("Reply mode enabled.");
    }

    function hasStaffPermission() {
        return [
            "admin",
            "super_admin",
            "moderator",
            "tutor"
        ].includes(
            String(
                state.currentRole
            ).toLowerCase()
        );
    }

    /* ========================================================
       DELETE MESSAGE COMPLETELY
       ======================================================== */

    async function deleteMessage(
        messageId
    ) {
        if (!messageId) return;

        const message =
            state.messages.find(
                item =>
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) {
            toast(
                "Message could not be found.",
                "error"
            );
            return;
        }

        const allowed =
            String(
                message.user_id
            ) ===
                String(
                    state.user?.id
                ) ||
            hasStaffPermission();

        if (!allowed) {
            toast(
                "You do not have permission to delete this message.",
                "error"
            );
            return;
        }

        const confirmed =
            window.confirm(
                "Delete this message for everyone? Any attached photo, document, audio or other file will also be removed."
            );

        if (!confirmed) {
            return;
        }

        try {
            /*
             * STEP 1
             * Find all attachment records.
             */

            const {
                data: attachments,
                error:
                    attachmentLookupError
            } = await db
                .from(
                    "chat_attachments"
                )
                .select(`
                    id,
                    file_path,
                    file_url,
                    file_name
                `)
                .eq(
                    "message_id",
                    messageId
                );

            if (
                attachmentLookupError
            ) {
                throw attachmentLookupError;
            }

            /*
             * STEP 2
             * Delete physical files from
             * Supabase Storage.
             */

            const paths =
                (attachments || [])
                    .map(
                        attachment =>
                            attachment.file_path
                    )
                    .filter(Boolean);

            if (paths.length) {
                const {
                    error:
                        storageError
                } = await db.storage
                    .from(
                        "chat-attachments"
                    )
                    .remove(paths);

                if (storageError) {
                    console.warn(
                        "⚠️ Storage cleanup warning:",
                        storageError
                    );
                }
            }

            /*
             * STEP 3
             * Delete attachment database
             * records.
             */

            const {
                error:
                    attachmentDeleteError
            } = await db
                .from(
                    "chat_attachments"
                )
                .delete()
                .eq(
                    "message_id",
                    messageId
                );

            if (
                attachmentDeleteError
            ) {
                throw attachmentDeleteError;
            }

            /*
             * STEP 4
             * Delete reactions.
             */

            const {
                error:
                    reactionDeleteError
            } = await db
                .from(
                    "chat_message_reactions"
                )
                .delete()
                .eq(
                    "message_id",
                    messageId
                );

            if (
                reactionDeleteError
            ) {
                console.warn(
                    "⚠️ Reaction cleanup warning:",
                    reactionDeleteError
                );
            }

            /*
             * STEP 5
             * Delete the message itself.
             *
             * This is a HARD DELETE.
             * It disappears for everyone.
             */

            const {
                error:
                    messageDeleteError
            } = await db
                .from(
                    "chat_messages"
                )
                .delete()
                .eq(
                    "id",
                    messageId
                );

            if (
                messageDeleteError
            ) {
                throw messageDeleteError;
            }

            /*
             * STEP 6
             * Remove it locally immediately.
             */

            state.messages =
                state.messages.filter(
                    item =>
                        String(
                            item.id
                        ) !==
                        String(
                            messageId
                        )
                );

            renderMessages();

            toast(
                "Message and its attachments were deleted for everyone.",
                "success"
            );

        } catch (error) {
            console.error(
                "❌ Complete message deletion failed:",
                error
            );

            toast(
                error?.message ||
                "The message could not be completely deleted.",
                "error"
            );
        }
    }

    /* ========================================================
       SEND MESSAGE
       ======================================================== */

    async function sendMessage() {
        if (state.sendingMessage) {
            return;
        }

        if (!state.currentChannel) {
            toast(
                "Select a channel first.",
                "error"
            );
            return;
        }

        const content =
            String(
                el.messageInput?.value ||
                ""
            ).trim();

        if (!content) {
            return;
        }

        state.sendingMessage = true;

        if (el.sendMessageButton) {
            el.sendMessageButton.disabled =
                true;
        }

        try {
            const {
                data: message,
                error
            } = await db
                .from(
                    "chat_messages"
                )
                .insert({
                    channel_id:
                        state.currentChannel.id,

                    user_id:
                        state.user.id,

                    parent_message_id:
                        state.replyingTo?.id ||
                        null,

                    content,

                    message_type:
                        "text"
                })
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            state.messages.push({
                ...message,
                profile:
                    state.profile,
                attachments: []
            });

            el.messageInput.value = "";

            cancelReply();

            renderMessages();

            scrollMessagesToBottom();

        } catch (error) {
            console.error(
                "❌ Message send failed:",
                error
            );

            toast(
                error?.message ||
                "Unable to send message.",
                "error"
            );

        } finally {
            state.sendingMessage = false;

            if (el.sendMessageButton) {
                el.sendMessageButton.disabled =
                    false;
            }
        }
    }

    function cancelReply() {
        state.replyingTo = null;

        if (el.messageInput) {
            el.messageInput.placeholder =
                "Write a message...";
        }
    }

    /* ========================================================
       ATTACHMENTS
       ======================================================== */

    function openAttachmentPicker() {
        if (!el.attachmentInput) return;

        el.attachmentInput.value = "";

        el.attachmentInput.click();
    }

    function handleAttachmentSelection(
        event
    ) {
        const files =
            Array.from(
                event.target.files || []
            );

        if (!files.length) {
            return;
        }

        state.selectedFiles =
            files;

        renderAttachmentPreview();

        openModal(
            el.filePreviewModal
        );
    }

    function renderAttachmentPreview() {
        if (!el.filePreviewContent) {
            return;
        }

        if (!state.selectedFiles.length) {
            el.filePreviewContent.innerHTML =
                "<p>No files selected.</p>";
            return;
        }

        el.filePreviewContent.innerHTML =
            state.selectedFiles
                .map(file => {
                    const size =
                        formatFileSize(
                            file.size
                        );

                    if (
                        file.type.startsWith(
                            "image/"
                        )
                    ) {
                        const url =
                            URL.createObjectURL(
                                file
                            );

                        return `
                            <div class="attachment-preview-item">
                                <img
                                    src="${url}"
                                    alt="${escapeAttribute(
                                        file.name
                                    )}"
                                >
                                <div>
                                    <strong>
                                        ${escapeHTML(
                                            file.name
                                        )}
                                    </strong>
                                    <small>
                                        ${size}
                                    </small>
                                </div>
                            </div>
                        `;
                    }

                    return `
                        <div class="attachment-preview-item">
                            <div class="attachment-file-icon">
                                📎
                            </div>

                            <div>
                                <strong>
                                    ${escapeHTML(
                                        file.name
                                    )}
                                </strong>

                                <small>
                                    ${size}
                                </small>
                            </div>
                        </div>
                    `;
                })
                .join("");
    }

    async function sendSelectedAttachments() {
        if (!state.currentChannel) {
            toast(
                "Select a channel first.",
                "error"
            );
            return;
        }

        if (!state.selectedFiles.length) {
            closeModal(
                el.filePreviewModal
            );
            return;
        }

        try {
            for (
                const file
                of state.selectedFiles
            ) {
                await uploadAttachment(
                    file
                );
            }

            state.selectedFiles = [];

            if (el.attachmentInput) {
                el.attachmentInput.value =
                    "";
            }

            closeModal(
                el.filePreviewModal
            );

            toast(
                "Attachment sent.",
                "success"
            );

        } catch (error) {
            console.error(
                "❌ Attachment upload failed:",
                error
            );

            toast(
                error?.message ||
                "Attachment upload failed.",
                "error"
            );
        }
    }

    async function uploadAttachment(
        file
    ) {
        const {
            data: message,
            error:
                messageError
        } = await db
            .from(
                "chat_messages"
            )
            .insert({
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    file.name,

                message_type:
                    file.type.startsWith(
                        "audio/"
                    )
                        ? "audio"
                        : "file"
            })
            .select("*")
            .single();

        if (messageError) {
            throw messageError;
        }

        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

        const path =
            `${state.user.id}/${message.id}/${Date.now()}-${safeName}`;

        const {
            error:
                uploadError
        } = await db.storage
            .from(
                "chat-attachments"
            )
            .upload(
                path,
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
            await db
                .from(
                    "chat_messages"
                )
                .delete()
                .eq(
                    "id",
                    message.id
                );

            throw uploadError;
        }

        const {
            data: publicURLData
        } = db.storage
            .from(
                "chat-attachments"
            )
            .getPublicUrl(path);

        const fileURL =
            publicURLData?.publicUrl ||
            "";

        const {
            error:
                attachmentError
        } = await db
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
                    fileURL,

                mime_type:
                    file.type ||
                    "application/octet-stream",

                file_size:
                    file.size
            });

        if (attachmentError) {
            await db.storage
                .from(
                    "chat-attachments"
                )
                .remove([path]);

            await db
                .from(
                    "chat_messages"
                )
                .delete()
                .eq(
                    "id",
                    message.id
                );

            throw attachmentError;
        }

        state.messages.push({
            ...message,
            content: file.name,
            profile:
                state.profile,
            attachments: [
                {
                    file_name:
                        file.name,

                    file_path:
                        path,

                    file_url:
                        fileURL,

                    mime_type:
                        file.type,

                    file_size:
                        file.size
                }
            ]
        });

        renderMessages();

        scrollMessagesToBottom();
    }

    function formatFileSize(bytes) {
        if (!bytes) return "0 B";

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        let size = bytes;
        let index = 0;

        while (
            size >= 1024 &&
            index <
                units.length - 1
        ) {
            size /= 1024;
            index++;
        }

        return `${size.toFixed(
            index ? 1 : 0
        )} ${units[index]}`;
    }

    /* ========================================================
       VOICE NOTES
       ======================================================== */

    async function toggleVoiceNote() {
        if (state.recordingVoice) {
            stopVoiceRecording();
            return;
        }

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getUserMedia
        ) {
            toast(
                "Voice recording is not supported by this browser.",
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

            state.mediaRecorder =
                recorder;

            state.mediaChunks = [];

            recorder.ondataavailable =
                event => {
                    if (
                        event.data.size
                    ) {
                        state.mediaChunks.push(
                            event.data
                        );
                    }
                };

            recorder.onstop =
                async () => {
                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    const blob =
                        new Blob(
                            state.mediaChunks,
                            {
                                type:
                                    recorder.mimeType ||
                                    "audio/webm"
                            }
                        );

                    await uploadVoiceNote(
                        blob
                    );

                    state.mediaRecorder =
                        null;

                    state.mediaChunks =
                        [];
                };

            recorder.start();

            state.recordingVoice =
                true;

            if (
                el.voiceNoteButton
            ) {
                el.voiceNoteButton.textContent =
                    "⏹";
                el.voiceNoteButton.title =
                    "Stop recording";
                el.voiceNoteButton.classList.add(
                    "recording"
                );
            }

            toast(
                "Recording voice note..."
            );

        } catch (error) {
            console.error(
                "❌ Voice recording failed:",
                error
            );

            toast(
                "Microphone permission is required.",
                "error"
            );
        }
    }

    function stopVoiceRecording() {
        if (
            state.mediaRecorder &&
            state.mediaRecorder.state !==
                "inactive"
        ) {
            state.mediaRecorder.stop();
        }

        state.recordingVoice =
            false;

        if (
            el.voiceNoteButton
        ) {
            el.voiceNoteButton.textContent =
                "🎙️";

            el.voiceNoteButton.title =
                "Voice note";

            el.voiceNoteButton.classList.remove(
                "recording"
            );
        }
    }

    async function uploadVoiceNote(
        blob
    ) {
        const extension =
            blob.type.includes("ogg")
                ? "ogg"
                : "webm";

        const file =
            new File(
                [
                    blob
                ],
                `voice-note-${Date.now()}.${extension}`,
                {
                    type:
                        blob.type ||
                        "audio/webm"
                }
            );

        await uploadAttachment(
            file
        );

        toast(
            "Voice note sent.",
            "success"
        );
    }

    /* ========================================================
       EMOJI
       ======================================================== */

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅",
        "😂","🤣","😊","😇","🙂","🙃",
        "😉","😌","😍","🥰","😘","😗",
        "😙","😚","😋","😛","😝","😜",
        "🤪","🤨","🧐","🤓","😎","🥳",
        "🤩","😏","😒","😞","😔","😟",
        "😕","🙁","☹️","😣","😖","😫",
        "😩","🥺","😢","😭","😤","😠",
        "😡","🤬","🤯","😳","🥵","🥶",
        "😱","😨","😰","😥","😓","🤗",
        "🤔","🤭","🤫","🤥","😶","😐",
        "😑","😬","🙄","😯","😦","😧",
        "😮","😲","🥱","😴","🤤","😪",
        "😵","🤐","🥴","🤢","🤮","🤧",
        "😷","🤒","🤕","👍","👎","👏",
        "🙌","🙏","💪","❤️","🧡","💛",
        "💚","💙","💜","🖤","🤍","🤎",
        "💯","🔥","✨","🎉","🎊","💡",
        "📚","🧠","🩺","🔬","🧪","💊",
        "🎓","🏆","⚕️","🫀","🫁","🧬",
        "🇰🇪","🇺🇬","🇹🇿","🇿🇦","🇳🇬",
        "🇬🇧","🇺🇸","🇨🇦","🇦🇺","🇮🇳"
    ];

    const STICKERS = [
        "🎓✨",
        "📚🔥",
        "🧠💡",
        "🩺❤️",
        "🔬🧪",
        "🏆🎉",
        "💯👏",
        "🙌🎓",
        "📖☕",
        "🫀🩺",
        "🧬🔬",
        "💊⚕️"
    ];

    function openPicker(panel) {
        if (!panel) return;

        closeAllPickers(
            panel
        );

        panel.hidden = false;
        panel.classList.remove(
            "hidden"
        );
        panel.classList.add(
            "open"
        );

        state.activePicker =
            panel;
    }

    function closePicker(panel) {
        if (!panel) return;

        panel.classList.remove(
            "open"
        );
        panel.classList.add(
            "hidden"
        );
        panel.hidden = true;

        if (
            state.activePicker ===
            panel
        ) {
            state.activePicker =
                null;
        }
    }

    function closeAllPickers(
        except = null
    ) {
        [
            el.emojiPanel,
            el.stickerPanel,
            el.gifPanel
        ].forEach(panel => {
            if (
                panel &&
                panel !== except
            ) {
                closePicker(
                    panel
                );
            }
        });
    }

    function renderEmojiGrid(
        filter = ""
    ) {
        if (!el.emojiGrid) return;

        const query =
            String(
                filter || ""
            ).toLowerCase();

        const emojis =
            query
                ? EMOJIS.filter(
                    emoji =>
                        emoji.includes(
                            query
                        )
                )
                : EMOJIS;

        el.emojiGrid.innerHTML =
            emojis
                .map(
                    emoji => `
                        <button
                            type="button"
                            class="emoji-item"
                            data-emoji="${escapeAttribute(
                                emoji
                            )}"
                        >
                            ${emoji}
                        </button>
                    `
                )
                .join("");
    }

    function insertAtCursor(
        text
    ) {
        const input =
            el.messageInput;

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

        const position =
            start + text.length;

        input.setSelectionRange(
            position,
            position
        );
    }

    function renderStickerGrid() {
        if (!el.stickerGrid) return;

        el.stickerGrid.innerHTML =
            STICKERS
                .map(
                    sticker => `
                        <button
                            type="button"
                            class="sticker-item"
                            data-sticker="${escapeAttribute(
                                sticker
                            )}"
                        >
                            ${sticker}
                        </button>
                    `
                )
                .join("");
    }

    /* ========================================================
       REACTIONS
       ======================================================== */

    async function addReaction(
        messageId,
        reaction
    ) {
        if (!messageId) return;

        const {
            data: existing
        } = await db
            .from(
                "chat_message_reactions"
            )
            .select("id")
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

        if (existing) {
            await db
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
        } = await db
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
            console.warn(
                "Reaction failed:",
                error
            );
        }
    }

    /* ========================================================
       PRESENCE
       ======================================================== */

    async function updatePresence(
        status = "online"
    ) {
        if (!state.user) return;

        /*
         * Do not use onConflict here.
         * This avoids the previous 400 caused by
         * a missing unique constraint.
         */

        const {
            data: existing
        } = await db
            .from(
                "chat_presence"
            )
            .select("user_id")
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

        if (existing) {
            const {
                error
            } = await db
                .from(
                    "chat_presence"
                )
                .update({
                    status,
                    last_seen_at:
                        new Date().toISOString()
                })
                .eq(
                    "user_id",
                    state.user.id
                );

            if (error) {
                console.warn(
                    "⚠️ Presence update failed:",
                    error
                );
            }

            return;
        }

        const {
            error
        } = await db
            .from(
                "chat_presence"
            )
            .insert({
                user_id:
                    state.user.id,

                status,

                last_seen_at:
                    new Date().toISOString()
            });

        if (error) {
            console.warn(
                "⚠️ Presence insert failed:",
                error
            );
        }
    }

    function startPresence() {
        updatePresence("online");

        clearInterval(
            state.presenceTimer
        );

        state.presenceTimer =
            setInterval(
                () => {
                    updatePresence(
                        "online"
                    );
                },
                60000
            );

        window.addEventListener(
            "beforeunload",
            () => {
                updatePresence(
                    "offline"
                );
            }
        );
    }

    /* ========================================================
       REALTIME
       ======================================================== */

    async function cleanupRealtime() {
        if (
            state.messageRealtime
        ) {
            await db.removeChannel(
                state.messageRealtime
            );

            state.messageRealtime =
                null;
        }

        if (
            state.communityRealtime
        ) {
            await db.removeChannel(
                state.communityRealtime
            );

            state.communityRealtime =
                null;
        }
    }

    function setupMessageRealtime(
        channelId
    ) {
        if (!channelId) return;

        if (
            state.messageRealtime
        ) {
            db.removeChannel(
                state.messageRealtime
            );

            state.messageRealtime =
                null;
        }

        const channel =
            db.channel(
                `community-messages-${channelId}`
            );

        channel.on(
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
                    await refreshSingleMessage(
                        payload.new.id
                    );

                    return;
                }

                if (
                    payload.eventType ===
                    "UPDATE"
                ) {
                    await refreshMessagesQuietly();
                    return;
                }

                if (
                    payload.eventType ===
                    "DELETE"
                ) {
                    state.messages =
                        state.messages.filter(
                            message =>
                                String(
                                    message.id
                                ) !==
                                String(
                                    payload.old.id
                                )
                        );

                    renderMessages();
                }
            }
        );

        channel.subscribe(
            status => {
                console.log(
                    "Community realtime:",
                    status
                );
            }
        );

        state.messageRealtime =
            channel;
    }

    function setupCommunityRealtime(
        communityId
    ) {
        if (!communityId) return;

        if (
            state.communityRealtime
        ) {
            db.removeChannel(
                state.communityRealtime
            );
        }

        const channel =
            db.channel(
                `community-${communityId}`
            );

        channel.on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_community_members",
                filter:
                    `community_id=eq.${communityId}`
            },
            async () => {
                await loadCommunityMembers(
                    communityId
                );
            }
        );

        channel.subscribe();

        state.communityRealtime =
            channel;
    }

    async function refreshSingleMessage(
        messageId
    ) {
        const {
            data,
            error
        } = await db
            .from(
                "chat_messages"
            )
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
                "id",
                messageId
            )
            .maybeSingle();

        if (error || !data) {
            return;
        }

        const existingIndex =
            state.messages.findIndex(
                message =>
                    String(
                        message.id
                    ) ===
                    String(
                        messageId
                    )
            );

        if (
            existingIndex >= 0
        ) {
            state.messages[
                existingIndex
            ] = {
                ...data,
                profile:
                    state.messages[
                        existingIndex
                    ].profile ||
                    null,
                attachments: []
            };
        } else {
            state.messages.push({
                ...data,
                attachments: []
            });
        }

        await attachMessageProfiles();
        await attachMessageAttachments();

        renderMessages();

        scrollMessagesToBottom();
    }

    async function refreshMessagesQuietly() {
        if (
            !state.currentChannel
        ) {
            return;
        }

        const {
            data
        } = await db
            .from(
                "chat_messages"
            )
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
                state.currentChannel.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            )
            .limit(500);

        if (data) {
            state.messages =
                data;

            await attachMessageProfiles();
            await attachMessageAttachments();

            renderMessages();
        }
    }

    /* ========================================================
       FRIENDS
       ======================================================== */

    function openFriends() {
        if (!el.friendsModal) return;

        openModal(
            el.friendsModal
        );

        renderFriends();
    }

    function renderFriends() {
        if (!el.friendsContent) {
            return;
        }

        el.friendsContent.innerHTML = `
            <div class="empty-state">
                <div>👥</div>
                <strong>Friends</strong>
                <span>
                    Your academic friends and requests
                    will appear here.
                </span>
            </div>
        `;
    }

    /* ========================================================
       PROFILE MODAL
       ======================================================== */

    function openProfile() {
        if (!el.profileModal) return;

        const name =
            getName(
                state.profile,
                state.user?.email ||
                "Mwaniki Scholar"
            );

        const avatar =
            getAvatar(
                state.profile
            );

        el.profileModalContent.innerHTML = `
            <div class="profile-large-avatar">
                ${
                    avatar
                        ? `
                            <img
                                src="${escapeAttribute(
                                    avatar
                                )}"
                                alt="${escapeAttribute(
                                    name
                                )}"
                            >
                        `
                        : escapeHTML(
                            initials(name)
                        )
                }
            </div>

            <h2>
                ${escapeHTML(name)}
            </h2>

            <p>
                ${escapeHTML(
                    state.user?.email ||
                    ""
                )}
            </p>

            <div class="profile-status-card">
                <span class="presence-dot online"></span>
                Online
            </div>
        `;

        openModal(
            el.profileModal
        );
    }

    /* ========================================================
       TICKETS
       ======================================================== */

    function openTicket() {
        openModal(
            el.ticketModal
        );
    }

    async function submitTicket(
        event
    ) {
        event.preventDefault();

        if (!state.user) return;

        const type =
            $("ticketType")?.value;

        const subject =
            $("ticketSubject")?.value
                ?.trim();

        const description =
            $("ticketDescription")?.value
                ?.trim();

        if (
            !type ||
            !subject ||
            !description
        ) {
            toast(
                "Complete all ticket fields.",
                "error"
            );
            return;
        }

        const {
            error
        } = await db
            .from(
                "chat_reports"
            )
            .insert({
                reporter_id:
                    state.user.id,

                community_id:
                    state.currentCommunity
                        ?.id ||
                    null,

                type,

                subject,

                description,

                status:
                    "open"
            });

        if (error) {
            console.error(
                "Ticket failed:",
                error
            );

            toast(
                "Unable to submit ticket.",
                "error"
            );

            return;
        }

        el.ticketForm?.reset();

        closeModal(
            el.ticketModal
        );

        toast(
            "Ticket submitted successfully.",
            "success"
        );
    }

    /* ========================================================
       CALL BRIDGE
       ======================================================== */

    function dispatchCall(
        name,
        detail = {}
    ) {
        window.dispatchEvent(
            new CustomEvent(
                name,
                {
                    detail
                }
            )
        );
    }

    function openCallChoice() {
        openModal(
            el.callModal
        );
    }

    function startGeneralCall() {
        closeModal(
            el.callModal
        );

        dispatchCall(
            "mwaniki:general-call",
            {
                mode: "audio"
            }
        );
    }

    function startCommunityCall() {
        if (
            !state.currentCommunity
        ) {
            toast(
                "Select a community first.",
                "error"
            );
            return;
        }

        dispatchCall(
            "mwaniki:community-call",
            {
                communityId:
                    state.currentCommunity.id,

                mode: "audio"
            }
        );
    }

    function callSelectedMember(
        userId
    ) {
        if (!userId) return;

        dispatchCall(
            "mwaniki:call-user",
            {
                userId,
                mode: "audio"
            }
        );
    }

    /* ========================================================
       SCROLL
       ======================================================== */

    function scrollMessagesToBottom() {
        if (!el.messageList) return;

        requestAnimationFrame(
            () => {
                el.messageList.scrollTop =
                    el.messageList.scrollHeight;
            }
        );
    }

    /* ========================================================
       CHANNEL SEARCH
       ======================================================== */

    function searchChannel() {
        if (
            !state.currentChannel
        ) {
            return;
        }

        const query =
            window.prompt(
                "Search this channel:",
                ""
            );

        if (!query) return;

        const normalized =
            query
                .toLowerCase()
                .trim();

        const matches =
            state.messages.filter(
                message =>
                    String(
                        message.content ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            normalized
                        )
            );

        if (!matches.length) {
            toast(
                "No messages matched your search."
            );
            return;
        }

        toast(
            `${matches.length} matching message(s) found.`
        );

        const first =
            document.querySelector(
                `[data-message-id="${CSS.escape(
                    matches[0].id
                )}"]`
            );

        first?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    /* ========================================================
       MEMBER SIDEBAR
       ======================================================== */

    function toggleMemberSidebar() {
        if (!el.memberSidebar) {
            return;
        }

        el.memberSidebar.classList.toggle(
            "open"
        );
    }

    /* ========================================================
       CONTESTS
       ======================================================== */

    function openContestChannel() {
        const channel =
            state.channels.find(
                item =>
                    String(
                        item.name
                    )
                        .toLowerCase()
                        .includes(
                            "contest"
                        ) ||
                    String(
                        item.slug
                    )
                        .toLowerCase()
                        .includes(
                            "contest"
                        )
            );

        if (channel) {
            selectChannel(
                channel.id
            );
            return;
        }

        toast(
            "The contest channel is not available in this community."
        );
    }

    /* ========================================================
       EVENT DELEGATION
       ======================================================== */

    function setupEvents() {
        /*
         * Community rail
         */

        el.communityRailList?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-community-id]"
                    );

                if (!button) return;

                selectCommunity(
                    button.dataset
                        .communityId
                );
            }
        );

        /*
         * Channels
         */

        document.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-channel-id]"
                    );

                if (!button) return;

                selectChannel(
                    button.dataset
                        .channelId
                );
            }
        );

        /*
         * Members
         */

        el.memberList?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-user-id]"
                    );

                if (!button) return;

                callSelectedMember(
                    button.dataset
                        .userId
                );
            }
        );

        /*
         * Send
         */

        el.sendMessageButton?.addEventListener(
            "click",
            sendMessage
        );

        el.messageInput?.addEventListener(
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

        /*
         * Attachments
         */

        el.attachmentButton?.addEventListener(
            "click",
            openAttachmentPicker
        );

        el.attachmentInput?.addEventListener(
            "change",
            handleAttachmentSelection
        );

        el.confirmAttachmentButton?.addEventListener(
            "click",
            sendSelectedAttachments
        );

        /*
         * Emoji
         */

        el.emojiButton?.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                if (
                    el.emojiPanel?.classList.contains(
                        "open"
                    )
                ) {
                    closePicker(
                        el.emojiPanel
                    );
                } else {
                    renderEmojiGrid();
                    openPicker(
                        el.emojiPanel
                    );
                }
            }
        );

        el.emojiSearch?.addEventListener(
            "input",
            event => {
                renderEmojiGrid(
                    event.target.value
                );
            }
        );

        el.emojiGrid?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-emoji]"
                    );

                if (!button) return;

                insertAtCursor(
                    button.dataset.emoji
                );
            }
        );

        /*
         * Stickers
         */

        el.stickerButton?.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                if (
                    el.stickerPanel?.classList.contains(
                        "open"
                    )
                ) {
                    closePicker(
                        el.stickerPanel
                    );
                } else {
                    renderStickerGrid();
                    openPicker(
                        el.stickerPanel
                    );
                }
            }
        );

        el.stickerGrid?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-sticker]"
                    );

                if (!button) return;

                insertAtCursor(
                    button.dataset.sticker
                );
            }
        );

        /*
         * GIF
         *
         * No external API key is required.
         * The button opens a simple GIF URL
         * composer so it remains functional.
         */

        el.gifButton?.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                if (
                    el.gifPanel?.classList.contains(
                        "open"
                    )
                ) {
                    closePicker(
                        el.gifPanel
                    );
                } else {
                    openPicker(
                        el.gifPanel
                    );

                    if (
                        el.gifGrid
                    ) {
                        el.gifGrid.innerHTML = `
                            <div class="empty-picker">
                                <strong>GIFs</strong>
                                <span>
                                    Paste a GIF URL into the message box,
                                    or connect your preferred GIF provider later.
                                </span>
                            </div>
                        `;
                    }
                }
            }
        );

        /*
         * Voice
         */

        el.voiceNoteButton?.addEventListener(
            "click",
            toggleVoiceNote
        );

        /*
         * Profile
         */

        el.profileButton?.addEventListener(
            "click",
            openProfile
        );

        /*
         * Friends
         */

        el.friendsButton?.addEventListener(
            "click",
            openFriends
        );

        /*
         * Tickets
         */

        el.ticketButton?.addEventListener(
            "click",
            openTicket
        );

        el.ticketForm?.addEventListener(
            "submit",
            submitTicket
        );

        /*
         * Rules
         */

        el.rulesButton?.addEventListener(
            "click",
            () => {
                openModal(
                    el.rulesModal
                );
            }
        );

        /*
         * Members
         */

        el.channelMembersButton?.addEventListener(
            "click",
            toggleMemberSidebar
        );

        /*
         * Search
         */

        el.channelSearchButton?.addEventListener(
            "click",
            searchChannel
        );

        /*
         * Community call
         */

        el.communityCallButton?.addEventListener(
            "click",
            startCommunityCall
        );

        /*
         * General call
         */

        el.generalCallButton?.addEventListener(
            "click",
            openCallChoice
        );

        el.callSpecificPersonButton?.addEventListener(
            "click",
            () => {
                closeModal(
                    el.callModal
                );

                toggleMemberSidebar();

                toast(
                    "Select an online member from the Members panel to call them."
                );
            }
        );

        el.callWholeCommunityButton?.addEventListener(
            "click",
            () => {
                startGeneralCall();
            }
        );

        /*
         * Contest
         */

        el.contestChannelButton?.addEventListener(
            "click",
            openContestChannel
        );

        /*
         * Modal close buttons
         */

        document.addEventListener(
            "click",
            event => {
                const closeButton =
                    event.target.closest(
                        "[data-close-modal]"
                    );

                if (closeButton) {
                    closeModal(
                        $(
                            closeButton.dataset
                                .closeModal
                        )
                    );

                    return;
                }

                const pickerClose =
                    event.target.closest(
                        "[data-close-picker]"
                    );

                if (pickerClose) {
                    closePicker(
                        $(
                            pickerClose.dataset
                                .closePicker
                        )
                    );
                }
            }
        );

        /*
         * Close pickers when clicking outside.
         *
         * This fixes the old problem where the
         * emoji selector became impossible to close.
         */

        document.addEventListener(
            "click",
            event => {
                if (
                    !state.activePicker
                ) {
                    return;
                }

                if (
                    state.activePicker.contains(
                        event.target
                    ) ||
                    el.emojiButton?.contains(
                        event.target
                    ) ||
                    el.stickerButton?.contains(
                        event.target
                    ) ||
                    el.gifButton?.contains(
                        event.target
                    )
                ) {
                    return;
                }

                closeAllPickers();
            }
        );

        /*
         * Escape.
         */

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                closeAllPickers();

                closeModal(
                    el.callModal
                );

                closeModal(
                    el.friendsModal
                );

                closeModal(
                    el.ticketModal
                );

                closeModal(
                    el.rulesModal
                );

                closeModal(
                    el.profileModal
                );

                closeModal(
                    el.filePreviewModal
                );
            }
        );
    }

    /* ========================================================
       INITIALIZATION
       ======================================================== */

    async function initialize() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;

        console.log(
            "🚀 Initializing Mwaniki Scholars Community..."
        );

        const authenticated =
            await loadUser();

        if (!authenticated) {
            return;
        }

        await loadProfile();

        await loadCommunities();

        startPresence();

        setupEvents();

        console.log(
            "✅ Community loaded successfully."
        );
    }

    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.MwanikiCommunity = {
        state,

        selectCommunity,
        selectChannel,

        loadMessages,

        sendMessage,

        deleteMessage,

        openFriends,
        openProfile,

        startCommunityCall,
        startGeneralCall,

        openAttachmentPicker,

        closeAllPickers
    };

    /*
     * Start only after DOM is ready.
     */

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
