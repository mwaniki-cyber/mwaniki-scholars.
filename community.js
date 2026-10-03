/* ============================================================
   MWANIKI SCHOLARS
   community.js

   RESPONSIBILITIES:
   - communities
   - channels
   - courses INSIDE communities
   - messages
   - attachments
   - voice notes
   - emoji/stickers/GIF UI
   - members
   - friends
   - tickets
   - profile
   - community realtime

   IMPORTANT:
   WebRTC is NOT handled here.
   WebRTC belongs ONLY to call.js.
   ============================================================ */

import { supabase } from "./supabase.js";

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    const db =
        supabase ||
        window.supabaseClient ||
        window.mwanikiSupabase ||
        window.sb ||
        window.supabase;

    const state = {
        user: null,
        profile: null,

        communities: [],
        currentCommunity: null,

        channels: [],
        currentChannel: null,

        members: [],
        messages: [],

        selectedFiles: [],

        realtime: null,
        channelRealtime: null,

        voice: {
            stream: null,
            recorder: null,
            chunks: [],
            audioContext: null,
            analyser: null,
            animation: null,
            timer: null,
            startedAt: null,
            blob: null,
            url: null
        }
    };

    const $ = id =>
        document.getElementById(id);


    /* =========================================================
       UTILITIES
       ========================================================= */

    const sleep = ms =>
        new Promise(resolve =>
            setTimeout(resolve, ms)
        );


    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function initials(name) {
        const parts =
            String(name || "Mwaniki Scholar")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) return "MS";

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


    function showToast(message) {
        const toast = $("toast");

        if (!toast) {
            console.info(message);
            return;
        }

        toast.textContent = message;
        toast.classList.remove("hidden");

        clearTimeout(toast._timer);

        toast._timer =
            setTimeout(() => {
                toast.classList.add("hidden");
            }, 3500);
    }


    function setHidden(element, hidden) {
        if (!element) return;

        element.classList.toggle(
            "hidden",
            hidden
        );

        element.hidden = hidden;
    }


    function openModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.classList.remove("hidden");
        modal.hidden = false;
    }


    function closeModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.classList.add("hidden");
        modal.hidden = true;
    }


    function formatTime(value) {
        if (!value) return "";

        const date = new Date(value);

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function renderAvatar(
        profile,
        fallbackName = "Mwaniki Scholar"
    ) {
        const avatar =
            profile?.avatar_url ||
            profile?.photo_url ||
            profile?.profile_image ||
            profile?.image_url ||
            "";

        if (avatar) {
            return `
                <img
                    src="${escapeHtml(avatar)}"
                    alt=""
                >
            `;
        }

        return escapeHtml(
            initials(
                profile?.display_name ||
                profile?.full_name ||
                profile?.name ||
                fallbackName
            )
        );
    }


    function profileName(profile) {
        return (
            profile?.display_name ||
            profile?.full_name ||
            profile?.name ||
            profile?.username ||
            "Mwaniki Scholar"
        );
    }


    /* =========================================================
       HOME
       ========================================================= */

    function setupCommunityHomeButton() {
        $("communityHomeButton")
            ?.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./dashboard.html";
                }
            );
    }


    /* =========================================================
       AUTH
       ========================================================= */

    async function initializeAuth() {
        const {
            data,
            error
        } = await db.auth.getSession();

        if (error) {
            throw error;
        }

        state.user =
            data?.session?.user || null;

        if (!state.user) {
            showToast(
                "Please sign in first."
            );

            setTimeout(() => {
                window.location.href =
                    "./index.html";
            }, 900);

            return false;
        }

        console.log(
            "✅ Authenticated:",
            state.user.id
        );

        return true;
    }


    /* =========================================================
       PROFILE
       ========================================================= */

    async function loadProfile() {
        if (!state.user) return;

        const {
            data
        } = await db
            .from("chat_public_profiles")
            .select("*")
            .eq("id", state.user.id)
            .maybeSingle();

        state.profile = data || null;

        renderHeaderProfile();
    }


    function renderHeaderProfile() {
        const avatar =
            $("headerProfileAvatar");

        const name =
            $("headerProfileName");

        if (avatar) {
            avatar.innerHTML =
                renderAvatar(
                    state.profile,
                    state.user?.email ||
                    "Mwaniki Scholar"
                );
        }

        if (name) {
            name.textContent =
                profileName(
                    state.profile
                );
        }

        $("headerPresenceDot")
            ?.classList.add("online");

        $("headerPresenceDot")
            ?.classList.remove("offline");
    }


    async function openProfile() {
        const box =
            $("profileModalContent");

        if (!box) return;

        box.innerHTML = `
            <div class="profile-view">
                <div class="message-avatar"
                     style="width:80px;height:80px;font-size:22px;">
                    ${renderAvatar(
                        state.profile
                    )}
                </div>

                <h2>
                    ${escapeHtml(
                        profileName(
                            state.profile
                        )
                    )}
                </h2>

                <p>
                    ${escapeHtml(
                        state.user?.email ||
                        ""
                    )}
                </p>
            </div>
        `;

        openModal("profileModal");
    }


    /* =========================================================
       COMMUNITY ICON
       ========================================================= */

    function communityFallback(
        community
    ) {
        const name =
            String(
                community?.name || ""
            ).toLowerCase();

        if (
            name.includes("gaming")
        ) {
            return "🎮";
        }

        if (
            name.includes("meme")
        ) {
            return "😂";
        }

        return "🎓";
    }


    function communityIcon(
        community,
        selected = false
    ) {
        const url =
            community?.icon_url;

        if (url) {
            return `
                <img
                    src="${escapeHtml(url)}"
                    alt=""
                >
            `;
        }

        return `
            <span
                class="${
                    selected
                        ? "community-icon-fallback"
                        : "community-rail-icon-fallback"
                }"
            >
                ${communityFallback(
                    community
                )}
            </span>
        `;
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
            .select("*")
            .eq("is_active", true)
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
            "✅ Communities loaded:",
            state.communities.length
        );

        renderCommunityRail();

        if (!state.communities.length) {
            return;
        }

        const saved =
            localStorage.getItem(
                "mwanikiCommunityId"
            );

        const selected =
            state.communities.find(
                community =>
                    String(community.id) ===
                    String(saved)
            ) ||
            state.communities[0];

        await selectCommunity(
            selected.id
        );
    }


    function renderCommunityRail() {
        const rail =
            $("communityRailList");

        if (!rail) return;

        rail.innerHTML =
            state.communities
                .map(community => `
                    <button
                        type="button"
                        class="community-rail-item ${
                            state.currentCommunity &&
                            String(
                                state.currentCommunity.id
                            ) ===
                            String(community.id)
                                ? "active"
                                : ""
                        }"
                        data-community-id="${escapeHtml(
                            community.id
                        )}"
                        title="${escapeHtml(
                            community.name
                        )}"
                    >
                        <span class="community-rail-icon">
                            ${communityIcon(
                                community
                            )}
                        </span>

                        <span class="community-rail-name">
                            ${escapeHtml(
                                community.name
                            )}
                        </span>
                    </button>
                `)
                .join("");

        rail
            .querySelectorAll(
                "[data-community-id]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    async () => {
                        await selectCommunity(
                            button.dataset.communityId
                        );
                    }
                );
            });
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

        localStorage.setItem(
            "mwanikiCommunityId",
            String(community.id)
        );

        renderCommunityRail();

        const icon =
            $("selectedCommunityIcon");

        if (icon) {
            icon.innerHTML =
                communityIcon(
                    community,
                    true
                );
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
                "Community";
        }

        await loadChannels();
        await loadCommunityMembers();

        exposeCommunityAPI();
    }


    function getCurrentCommunityId() {
        return state.currentCommunity?.id || null;
    }


    /* =========================================================
       CHANNELS
       ========================================================= */

    async function loadChannels() {
        if (!state.currentCommunity) {
            return;
        }

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
            .eq("is_active", true)
            .eq("is_archived", false)
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
                "Channel load error:",
                error
            );

            state.channels = [];

            renderChannels();

            return;
        }

        state.channels =
            data || [];

        renderChannels();

        const saved =
            localStorage.getItem(
                "selectedChannelId"
            );

        const first =
            state.channels.find(
                channel =>
                    String(channel.id) ===
                    String(saved)
            ) ||
            state.channels[0];

        if (first) {
            await selectChannel(
                first.id
            );
        }
    }


    function channelGroup(
        channel
    ) {
        const type =
            String(
                channel.channel_type ||
                ""
            ).toLowerCase();

        if (
            channel.course_id ||
            channel.unit_id ||
            type === "course" ||
            type === "unit"
        ) {
            return "course";
        }

        if (
            type === "information" ||
            type === "info"
        ) {
            return "information";
        }

        return "community";
    }


    function renderChannelButton(
        channel
    ) {
        return `
            <button
                type="button"
                class="channel-button ${
                    state.currentChannel &&
                    String(
                        state.currentChannel.id
                    ) ===
                    String(channel.id)
                        ? "active"
                        : ""
                }"
                data-channel-id="${escapeHtml(
                    channel.id
                )}"
            >
                <span class="channel-icon">
                    ${
                        channel.icon ||
                        "#"
                    }
                </span>

                <span class="channel-name">
                    ${escapeHtml(
                        channel.name
                    )}
                </span>
            </button>
        `;
    }


    function renderChannels() {
        const information =
            $("informationChannels");

        const courses =
            $("courseChannels");

        const community =
            $("communityChannels");

        if (information) {
            information.innerHTML = "";
        }

        if (courses) {
            courses.innerHTML = "";
        }

        if (community) {
            community.innerHTML = "";
        }

        state.channels.forEach(
            channel => {
                const group =
                    channelGroup(
                        channel
                    );

                if (group === "course") {
                    courses?.insertAdjacentHTML(
                        "beforeend",
                        renderChannelButton(
                            channel
                        )
                    );
                } else if (
                    group ===
                    "information"
                ) {
                    information?.insertAdjacentHTML(
                        "beforeend",
                        renderChannelButton(
                            channel
                        )
                    );
                } else {
                    community?.insertAdjacentHTML(
                        "beforeend",
                        renderChannelButton(
                            channel
                        )
                    );
                }
            }
        );

        document
            .querySelectorAll(
                "[data-channel-id]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    async () => {
                        await selectChannel(
                            button.dataset.channelId
                        );
                    }
                );
            });
    }


    async function selectChannel(
        channelId
    ) {
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
            "selectedChannelId",
            String(channel.id)
        );

        renderChannels();

        $("currentChannelName")
            .textContent =
            channel.name || "channel";

        $("currentChannelDescription")
            .textContent =
            channel.description ||
            "Community discussion";

        $("currentChannelIcon")
            .textContent =
            channel.icon || "#";

        await ensureChannelMembership();

        await loadMessages();

        subscribeToChannelRealtime();
    }


    async function ensureChannelMembership() {
        if (
            !state.user ||
            !state.currentChannel
        ) {
            return;
        }

        const {
            data
        } = await db
            .from("chat_channel_members")
            .select("id")
            .eq(
                "channel_id",
                state.currentChannel.id
            )
            .eq(
                "user_id",
                state.user.id
            )
            .maybeSingle();

        if (data) return;

        /*
         * Try to join.
         *
         * If RLS does not permit automatic joining,
         * the channel can still remain visible.
         */
        await db
            .from("chat_channel_members")
            .insert({
                channel_id:
                    state.currentChannel.id,
                user_id:
                    state.user.id
            });
    }


    /* =========================================================
       MESSAGES
       ========================================================= */

    async function loadMessages() {
        if (!state.currentChannel) return;

        const list =
            $("messageList");

        if (list) {
            list.innerHTML = `
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
            )
            .limit(200);

        if (error) {
            console.error(
                "Message load error:",
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

        await hydrateMessageProfiles();

        await renderMessages();
    }


    async function hydrateMessageProfiles() {
        const ids =
            Array.from(
                new Set(
                    state.messages
                        .map(
                            message =>
                                message.user_id
                        )
                        .filter(Boolean)
                )
            );

        if (!ids.length) return;

        const {
            data
        } = await db
            .from("chat_public_profiles")
            .select("*")
            .in("id", ids);

        const profiles =
            data || [];

        const map =
            new Map(
                profiles.map(
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
                    _profile:
                        map.get(
                            message.user_id
                        ) || null
                })
            );
    }


    async function renderMessages() {
        const list =
            $("messageList");

        if (!list) return;

        if (!state.messages.length) {
            list.innerHTML = `
                <div class="message-loading">
                    No messages yet. Start the conversation.
                </div>
            `;

            return;
        }

        const messageIds =
            state.messages.map(
                message => message.id
            );

        let attachments = [];

        if (messageIds.length) {
            const result =
                await db
                    .from("chat_attachments")
                    .select("*")
                    .in(
                        "message_id",
                        messageIds
                    );

            attachments =
                result.data || [];
        }

        const attachmentMap =
            new Map();

        attachments.forEach(
            attachment => {
                const current =
                    attachmentMap.get(
                        attachment.message_id
                    ) || [];

                current.push(
                    attachment
                );

                attachmentMap.set(
                    attachment.message_id,
                    current
                );
            }
        );

        list.innerHTML =
            state.messages
                .map(
                    message =>
                        renderMessage(
                            message,
                            attachmentMap.get(
                                message.id
                            ) || []
                        )
                )
                .join("");

        bindMessageActions();

        requestAnimationFrame(
            () => {
                list.scrollTop =
                    list.scrollHeight;
            }
        );
    }


    function renderMessage(
        message,
        attachments
    ) {
        const profile =
            message._profile;

        const name =
            profileName(profile);

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

        let body = "";

        if (deleted) {
            body =
                `<div class="message-body">
                    Message deleted
                </div>`;
        } else {
            body =
                `<div class="message-body">
                    ${escapeHtml(
                        message.content || ""
                    )}
                </div>`;
        }

        const attachmentHtml =
            attachments
                .map(
                    attachment =>
                        renderAttachment(
                            attachment
                        )
                )
                .join("");

        return `
            <article
                class="message ${
                    deleted
                        ? "deleted"
                        : ""
                }"
                data-message-id="${escapeHtml(
                    message.id
                )}"
            >

                <div class="message-avatar">
                    ${renderAvatar(
                        profile,
                        name
                    )}
                </div>

                <div class="message-content">

                    <div class="message-meta">

                        <span class="message-author">
                            ${escapeHtml(
                                name
                            )}
                        </span>

                        <span class="message-time">
                            ${formatTime(
                                message.created_at
                            )}
                        </span>

                    </div>

                    ${body}

                    ${attachmentHtml}

                </div>

                ${
                    own && !deleted
                        ? `
                            <div class="message-actions">
                                <button
                                    class="message-action-button"
                                    type="button"
                                    data-delete-message="${escapeHtml(
                                        message.id
                                    )}"
                                    title="Delete message"
                                >
                                    🗑️
                                </button>
                            </div>
                        `
                        : ""
                }

            </article>
        `;
    }


    function renderAttachment(
        attachment
    ) {
        const mime =
            String(
                attachment.mime_type || ""
            ).toLowerCase();

        const url =
            attachment.file_url;

        if (
            mime.startsWith("image/")
        ) {
            return `
                <div class="attachment-card">
                    <a
                        href="${escapeHtml(
                            url
                        )}"
                        target="_blank"
                        rel="noopener"
                    >
                        <img
                            src="${escapeHtml(
                                url
                            )}"
                            alt="${escapeHtml(
                                attachment.file_name
                            )}"
                        >
                    </a>
                </div>
            `;
        }

        if (
            mime.startsWith("audio/")
        ) {
            return `
                <div class="attachment-card voice-message">
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
            <div class="attachment-card">
                <a
                    href="${escapeHtml(
                        url
                    )}"
                    target="_blank"
                    rel="noopener"
                    class="attachment-file"
                >
                    <span class="attachment-file-icon">
                        📄
                    </span>

                    <span class="attachment-file-name">
                        ${escapeHtml(
                            attachment.file_name
                        )}
                    </span>
                </a>
            </div>
        `;
    }


    function bindMessageActions() {
        document
            .querySelectorAll(
                "[data-delete-message]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    async () => {
                        await deleteMessage(
                            button.dataset.deleteMessage
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
                    String(item.id) ===
                    String(messageId)
            );

        if (!message) return;

        if (
            String(
                message.user_id
            ) !==
            String(
                state.user?.id
            )
        ) {
            showToast(
                "You can only delete your own messages."
            );

            return;
        }

        const {
            error
        } = await db
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
                error
            );

            showToast(
                "Message could not be deleted."
            );

            return;
        }

        showToast(
            "Message deleted."
        );

        await loadMessages();
    }


    /* =========================================================
       SEND TEXT
       ========================================================= */

    async function sendMessage() {
        const input =
            $("messageInput");

        if (!input) return;

        const content =
            input.value.trim();

        if (!content) return;

        if (
            !state.currentChannel ||
            !state.user
        ) {
            showToast(
                "Select a channel first."
            );

            return;
        }

        const button =
            $("sendMessageButton");

        if (button) {
            button.disabled = true;
            button.textContent = "Sending...";
        }

        try {
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
                        "text"
                })
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            input.value = "";
            autoResizeTextarea(input);

            if (data) {
                state.messages.push({
                    ...data,
                    _profile:
                        state.profile
                });

                await renderMessages();
            }

        } catch (error) {
            console.error(
                "Send message failed:",
                error
            );

            showToast(
                error?.message ||
                "Message could not be sent."
            );

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Send";
            }
        }
    }


    /* =========================================================
       ATTACHMENTS
       ========================================================= */

    function setupAttachmentInput() {
        const input =
            $("attachmentInput");

        if (!input) return;

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

                state.selectedFiles =
                    files;

                renderAttachmentPreview();

                openModal(
                    "filePreviewModal"
                );

                renderFilePreviewModal();
            }
        );
    }


    function renderAttachmentPreview() {
        const box =
            $("attachmentPreview");

        if (!box) return;

        if (!state.selectedFiles.length) {
            box.innerHTML = "";
            box.classList.add("hidden");
            return;
        }

        box.classList.remove("hidden");

        box.innerHTML =
            state.selectedFiles
                .map(
                    (file, index) => `
                        <div
                            class="attachment-preview-item"
                        >
                            <span>📎</span>

                            <span>
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

        box
            .querySelectorAll(
                "[data-remove-file]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        state.selectedFiles.splice(
                            Number(
                                button.dataset
                                    .removeFile
                            ),
                            1
                        );

                        renderAttachmentPreview();
                    }
                );
            });
    }


    function renderFilePreviewModal() {
        const box =
            $("filePreviewContent");

        if (!box) return;

        box.innerHTML =
            state.selectedFiles
                .map(file => {
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
                            <div class="attachment-card">
                                <img
                                    src="${url}"
                                    alt=""
                                >

                                <strong>
                                    ${escapeHtml(
                                        file.name
                                    )}
                                </strong>
                            </div>
                        `;
                    }

                    return `
                        <div class="attachment-file">
                            <span class="attachment-file-icon">
                                📄
                            </span>

                            <span class="attachment-file-name">
                                ${escapeHtml(
                                    file.name
                                )}
                            </span>
                        </div>
                    `;
                })
                .join("");
    }


    async function sendAttachments() {
        if (
            !state.selectedFiles.length ||
            !state.currentChannel ||
            !state.user
        ) {
            return;
        }

        const button =
            $("confirmAttachmentButton");

        if (button) {
            button.disabled = true;
            button.textContent =
                "Uploading...";
        }

        try {
            for (
                const file of
                state.selectedFiles
            ) {
                const safeName =
                    file.name
                        .replace(
                            /[^a-zA-Z0-9._-]/g,
                            "_"
                        );

                const path =
                    `chat/${state.user.id}/${Date.now()}-${safeName}`;

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
                    data:
                        publicData
                } = db.storage
                    .from(
                        "chat-attachments"
                    )
                    .getPublicUrl(
                        path
                    );

                const {
                    data:
                        message,
                    error:
                        messageError
                } = await db
                    .from("chat_messages")
                    .insert({
                        channel_id:
                            state.currentChannel.id,
                        user_id:
                            state.user.id,
                        content:
                            file.type.startsWith(
                                "image/"
                            )
                                ? "Image attachment"
                                : `Attachment: ${file.name}`,
                        message_type:
                            "attachment"
                    })
                    .select("*")
                    .single();

                if (messageError) {
                    throw messageError;
                }

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
                            publicData.publicUrl,
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

            state.selectedFiles = [];

            const input =
                $("attachmentInput");

            if (input) {
                input.value = "";
            }

            renderAttachmentPreview();

            closeModal(
                "filePreviewModal"
            );

            showToast(
                "Attachment sent."
            );

            await loadMessages();

        } catch (error) {
            console.error(
                "Attachment upload failed:",
                error
            );

            showToast(
                error?.message ||
                "Attachment could not be uploaded."
            );

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent =
                    "Send";
            }
        }
    }


    /* =========================================================
       VOICE NOTES
       ========================================================= */

    async function startVoiceRecording() {
        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {
            showToast(
                "Voice recording is not supported."
            );

            return;
        }

        if (
            state.voice.recorder
        ) {
            return;
        }

        try {
            const stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });

            state.voice.stream =
                stream;

            state.voice.chunks = [];

            const mimeCandidates = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/ogg;codecs=opus"
            ];

            const mime =
                mimeCandidates.find(
                    value =>
                        MediaRecorder.isTypeSupported(
                            value
                        )
                );

            state.voice.recorder =
                new MediaRecorder(
                    stream,
                    mime
                        ? {
                            mimeType: mime
                        }
                        : undefined
                );

            state.voice.recorder.ondataavailable =
                event => {
                    if (
                        event.data &&
                        event.data.size
                    ) {
                        state.voice.chunks.push(
                            event.data
                        );
                    }
                };

            state.voice.recorder.onstop =
                finalizeVoiceRecording;

            state.voice.recorder.start(
                100
            );

            state.voice.startedAt =
                Date.now();

            $("voiceRecorder")
                ?.classList.remove(
                    "hidden"
                );

            $("sendVoiceButton")
                ?.setAttribute(
                    "disabled",
                    ""
                );

            $("voicePreviewAudio")
                ?.classList.add(
                    "hidden"
                );

            startVoiceTimer();
            startWaveform(stream);

            showToast(
                "Recording started."
            );

        } catch (error) {
            console.error(
                "Voice recording failed:",
                error
            );

            showToast(
                "Microphone permission is required for voice notes."
            );
        }
    }


    function stopVoiceRecording() {
        const recorder =
            state.voice.recorder;

        if (!recorder) return;

        if (
            recorder.state !==
            "inactive"
        ) {
            recorder.stop();
        }
    }


    function finalizeVoiceRecording() {
        stopVoiceVisuals();

        const type =
            state.voice.recorder
                ?.mimeType ||
            "audio/webm";

        state.voice.blob =
            new Blob(
                state.voice.chunks,
                {
                    type
                }
            );

        if (
            state.voice.url
        ) {
            URL.revokeObjectURL(
                state.voice.url
            );
        }

        state.voice.url =
            URL.createObjectURL(
                state.voice.blob
            );

        const audio =
            $("voicePreviewAudio");

        if (audio) {
            audio.src =
                state.voice.url;

            audio.classList.remove(
                "hidden"
            );
        }

        $("sendVoiceButton")
            ?.removeAttribute(
                "disabled"
            );

        state.voice.stream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        state.voice.stream =
            null;

        state.voice.recorder =
            null;

        showToast(
            "Recording ready."
        );
    }


    function startVoiceTimer() {
        clearInterval(
            state.voice.timer
        );

        state.voice.timer =
            setInterval(
                () => {
                    const elapsed =
                        Math.floor(
                            (
                                Date.now() -
                                state.voice.startedAt
                            ) / 1000
                        );

                    const minutes =
                        String(
                            Math.floor(
                                elapsed / 60
                            )
                        ).padStart(
                            2,
                            "0"
                        );

                    const seconds =
                        String(
                            elapsed % 60
                        ).padStart(
                            2,
                            "0"
                        );

                    const timer =
                        $("voiceTimer");

                    if (timer) {
                        timer.textContent =
                            `${minutes}:${seconds}`;
                    }
                },
                250
            );
    }


    function startWaveform(stream) {
        const canvas =
            $("voiceWaveform");

        if (!canvas) return;

        const context =
            canvas.getContext(
                "2d"
            );

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        state.voice.audioContext =
            new AudioContext();

        const source =
            state.voice.audioContext
                .createMediaStreamSource(
                    stream
                );

        const analyser =
            state.voice.audioContext
                .createAnalyser();

        analyser.fftSize = 256;

        source.connect(
            analyser
        );

        state.voice.analyser =
            analyser;

        const data =
            new Uint8Array(
                analyser.frequencyBinCount
            );

        function draw() {
            if (
                !state.voice.analyser
            ) {
                return;
            }

            analyser.getByteTimeDomainData(
                data
            );

            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            context.beginPath();

            const slice =
                canvas.width /
                data.length;

            let x = 0;

            for (
                let i = 0;
                i < data.length;
                i++
            ) {
                const v =
                    data[i] / 128;

                const y =
                    v *
                    canvas.height /
                    2;

                if (i === 0) {
                    context.moveTo(
                        x,
                        y
                    );
                } else {
                    context.lineTo(
                        x,
                        y
                    );
                }

                x += slice;
            }

            context.strokeStyle =
                "#087f73";

            context.lineWidth = 2;

            context.stroke();

            state.voice.animation =
                requestAnimationFrame(
                    draw
                );
        }

        draw();
    }


    function stopVoiceVisuals() {
        clearInterval(
            state.voice.timer
        );

        state.voice.timer =
            null;

        if (
            state.voice.animation
        ) {
            cancelAnimationFrame(
                state.voice.animation
            );

            state.voice.animation =
                null;
        }

        if (
            state.voice.audioContext
        ) {
            state.voice.audioContext
                .close()
                .catch(() => {});

            state.voice.audioContext =
                null;
        }

        state.voice.analyser =
            null;

        const canvas =
            $("voiceWaveform");

        if (canvas) {
            const context =
                canvas.getContext(
                    "2d"
                );

            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );
        }
    }


    function cancelVoiceRecording() {
        if (
            state.voice.recorder
        ) {
            state.voice.recorder.onstop =
                null;

            if (
                state.voice.recorder.state !==
                "inactive"
            ) {
                state.voice.recorder.stop();
            }
        }

        state.voice.stream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        state.voice.stream =
            null;

        state.voice.recorder =
            null;

        state.voice.chunks = [];
        state.voice.blob = null;

        stopVoiceVisuals();

        if (
            state.voice.url
        ) {
            URL.revokeObjectURL(
                state.voice.url
            );

            state.voice.url =
                null;
        }

        const audio =
            $("voicePreviewAudio");

        if (audio) {
            audio.pause();
            audio.src = "";
            audio.classList.add(
                "hidden"
            );
        }

        $("voiceRecorder")
            ?.classList.add(
                "hidden"
            );

        $("sendVoiceButton")
            ?.setAttribute(
                "disabled",
                ""
            );

        showToast(
            "Voice recording cancelled."
        );
    }


    async function sendVoiceNote() {
        const blob =
            state.voice.blob;

        if (
            !blob ||
            !state.currentChannel ||
            !state.user
        ) {
            return;
        }

        const button =
            $("sendVoiceButton");

        if (button) {
            button.disabled = true;
            button.textContent =
                "Uploading...";
        }

        try {
            const extension =
                blob.type.includes(
                    "ogg"
                )
                    ? "ogg"
                    : "webm";

            const path =
                `voice-notes/${state.user.id}/${Date.now()}.${extension}`;

            const {
                error:
                    uploadError
            } = await db.storage
                .from(
                    "chat-attachments"
                )
                .upload(
                    path,
                    blob,
                    {
                        contentType:
                            blob.type ||
                            "audio/webm",
                        upsert: false
                    }
                );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data:
                    publicData
            } = db.storage
                .from(
                    "chat-attachments"
                )
                .getPublicUrl(
                    path
                );

            const {
                data:
                    message,
                error:
                    messageError
            } = await db
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.currentChannel.id,
                    user_id:
                        state.user.id,
                    content:
                        "Voice note",
                    message_type:
                        "voice"
                })
                .select("*")
                .single();

            if (messageError) {
                throw messageError;
            }

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
                        `voice-note-${Date.now()}.${extension}`,
                    file_path:
                        path,
                    file_url:
                        publicData.publicUrl,
                    mime_type:
                        blob.type ||
                        "audio/webm",
                    file_size:
                        blob.size
                });

            if (attachmentError) {
                throw attachmentError;
            }

            cancelVoiceWithoutToast();

            showToast(
                "Voice note sent."
            );

            await loadMessages();

        } catch (error) {
            console.error(
                "Voice note upload failed:",
                error
            );

            showToast(
                error?.message ||
                "Voice note could not be sent."
            );

            if (button) {
                button.disabled = false;
                button.textContent =
                    "Send Voice Note";
            }
        }
    }


    function cancelVoiceWithoutToast() {
        state.voice.stream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        state.voice.stream =
            null;

        state.voice.recorder =
            null;

        state.voice.chunks = [];
        state.voice.blob = null;

        stopVoiceVisuals();

        if (
            state.voice.url
        ) {
            URL.revokeObjectURL(
                state.voice.url
            );

            state.voice.url =
                null;
        }

        const audio =
            $("voicePreviewAudio");

        if (audio) {
            audio.pause();
            audio.src = "";
            audio.classList.add(
                "hidden"
            );
        }

        $("voiceRecorder")
            ?.classList.add(
                "hidden"
            );

        $("sendVoiceButton")
            ?.setAttribute(
                "disabled",
                ""
            );

        $("voiceTimer")
            && (
                $("voiceTimer")
                    .textContent =
                    "00:00"
            );
    }


    /* =========================================================
       EMOJI
       ========================================================= */

    const emojiSets = {
        Smileys: [
            "😀","😃","😄","😁","😆","😅",
            "😂","🤣","😊","😇","🙂","🙃",
            "😉","😌","😍","🥰","😘","😗",
            "😎","🤓","🧐","🤩","🥳","😏",
            "😐","😑","😶","🙄","😮","😴",
            "🤔","🤭","🤗","😱","😭","😤"
        ],

        People: [
            "👋","🤚","🖐️","✋","🤝","👏",
            "🙌","👍","👎","❤️","💙","💚",
            "💛","🧠","🫀","🫁","👨‍⚕️",
            "👩‍⚕️","🧑‍🎓","👨‍🎓","👩‍🎓"
        ],

        Animals: [
            "🐶","🐱","🐭","🐹","🐰","🦊",
            "🐻","🐼","🐨","🐯","🦁","🐮",
            "🐷","🐸","🐵","🐔","🐧","🐦"
        ],

        Food: [
            "🍎","🍌","🍇","🍉","🍊","🍋",
            "🍓","🍒","🥑","🍕","🍔","🍟",
            "🌭","🍿","🍩","🍪","☕","🍵"
        ],

        Symbols: [
            "✅","❌","⭐","🔥","💯","⚕️",
            "📚","📖","🔬","🧪","🩺","🏆",
            "🎯","💡","📌","🚨","❤️","✨"
        ]
    };


    function setupEmojiPicker() {
        const categories =
            $("emojiCategories");

        const grid =
            $("emojiGrid");

        if (!categories || !grid) {
            return;
        }

        const names =
            Object.keys(
                emojiSets
            );

        categories.innerHTML =
            names.map(
                (name, index) => `
                    <button
                        type="button"
                        class="emoji-category ${
                            index === 0
                                ? "active"
                                : ""
                        }"
                        data-emoji-category="${name}"
                    >
                        ${escapeHtml(
                            name
                        )}
                    </button>
                `
            ).join("");

        function render(name, filter = "") {
            const values =
                emojiSets[name] || [];

            grid.innerHTML =
                values
                    .filter(
                        emoji =>
                            !filter ||
                            emoji.includes(
                                filter
                            )
                    )
                    .map(
                        emoji => `
                            <button
                                type="button"
                                class="emoji-item"
                                data-emoji="${emoji}"
                            >
                                ${emoji}
                            </button>
                        `
                    )
                    .join("");

            grid
                .querySelectorAll(
                    "[data-emoji]"
                )
                .forEach(button => {
                    button.addEventListener(
                        "click",
                        () => {
                            insertAtCursor(
                                $("messageInput"),
                                button.dataset.emoji
                            );
                        }
                    );
                });
        }

        render(
            names[0]
        );

        categories
            .querySelectorAll(
                "[data-emoji-category]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        categories
                            .querySelectorAll(
                                ".emoji-category"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        button.classList.add(
                            "active"
                        );

                        render(
                            button.dataset
                                .emojiCategory,
                            $("emojiSearch")
                                ?.value
                                ?.trim() || ""
                        );
                    }
                );
            });

        $("emojiSearch")
            ?.addEventListener(
                "input",
                () => {
                    const active =
                        categories.querySelector(
                            ".emoji-category.active"
                        );

                    render(
                        active?.dataset
                            .emojiCategory ||
                        names[0],
                        $("emojiSearch")
                            .value
                            .trim()
                    );
                }
            );
    }


    function insertAtCursor(
        textarea,
        text
    ) {
        if (!textarea) return;

        const start =
            textarea.selectionStart;

        const end =
            textarea.selectionEnd;

        textarea.value =
            textarea.value.slice(
                0,
                start
            ) +
            text +
            textarea.value.slice(
                end
            );

        textarea.focus();

        textarea.selectionStart =
            textarea.selectionEnd =
                start + text.length;

        autoResizeTextarea(
            textarea
        );
    }


    /* =========================================================
       PICKERS
       ========================================================= */

    function closeAllPickers() {
        [
            "emojiPanel",
            "stickerPanel",
            "gifPanel"
        ].forEach(
            id =>
                $(id)?.classList.add(
                    "hidden"
                )
        );
    }


    function togglePicker(id) {
        const panel = $(id);

        if (!panel) return;

        const wasHidden =
            panel.classList.contains(
                "hidden"
            );

        closeAllPickers();

        if (wasHidden) {
            panel.classList.remove(
                "hidden"
            );
        }
    }


    function setupPickers() {
        $("emojiButton")
            ?.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    togglePicker(
                        "emojiPanel"
                    );
                }
            );

        $("stickerButton")
            ?.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    togglePicker(
                        "stickerPanel"
                    );

                    renderStickers();
                }
            );

        $("gifButton")
            ?.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    togglePicker(
                        "gifPanel"
                    );

                    renderGifs();
                }
            );

        document
            .querySelectorAll(
                "[data-close-picker]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        const id =
                            button.dataset
                                .closePicker;

                        $(id)?.classList.add(
                            "hidden"
                        );
                    }
                );
            });

        document.addEventListener(
            "click",
            event => {
                const target =
                    event.target;

                if (
                    target.closest(
                        ".picker-panel"
                    ) ||
                    target.closest(
                        "#emojiButton"
                    ) ||
                    target.closest(
                        "#stickerButton"
                    ) ||
                    target.closest(
                        "#gifButton"
                    )
                ) {
                    return;
                }

                closeAllPickers();
            }
        );
    }


    function renderStickers() {
        const grid =
            $("stickerGrid");

        if (!grid) return;

        const stickers = [
            "📚","🧪","🔬","🩺",
            "🧠","🫀","🫁","🦠",
            "💊","🧬","🏆","🎓"
        ];

        grid.innerHTML =
            stickers
                .map(
                    sticker => `
                        <button
                            type="button"
                            class="sticker-item"
                            data-sticker="${sticker}"
                        >
                            ${sticker}
                        </button>
                    `
                )
                .join("");

        grid
            .querySelectorAll(
                "[data-sticker]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        insertAtCursor(
                            $("messageInput"),
                            button.dataset.sticker
                        );

                        $("stickerPanel")
                            ?.classList.add(
                                "hidden"
                            );
                    }
                );
            });
    }


    function renderGifs() {
        const grid =
            $("gifGrid");

        if (!grid) return;

        grid.innerHTML = `
            <div class="empty-picker">
                GIF provider is not configured.
                Use the emoji and sticker picker or send an attachment.
            </div>
        `;
    }


    /* =========================================================
       MEMBERS
       ========================================================= */

    async function loadCommunityMembers() {
        if (!state.currentCommunity) {
            return;
        }

        const {
            data,
            error
        } = await db
            .from(
                "chat_community_members"
            )
            .select("*")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq(
                "is_banned",
                false
            )
            .order(
                "joined_at",
                {
                    ascending: true
                }
            );

        if (error) {
            console.error(
                "Member load error:",
                error
            );

            state.members = [];

            renderMembers();

            return;
        }

        state.members =
            data || [];

        const ids =
            state.members.map(
                member =>
                    member.user_id
            );

        if (ids.length) {
            const {
                data:
                    profiles
            } = await db
                .from(
                    "chat_public_profiles"
                )
                .select("*")
                .in(
                    "id",
                    ids
                );

            const map =
                new Map(
                    (
                        profiles ||
                        []
                    ).map(
                        profile => [
                            profile.id,
                            profile
                        ]
                    )
                );

            state.members =
                state.members.map(
                    member => ({
                        ...member,
                        profile:
                            map.get(
                                member.user_id
                            ) || null
                    })
                );
        }

        renderMembers();
    }


    function renderMembers() {
        const list =
            $("memberList");

        const count =
            $("memberCount");

        if (count) {
            count.textContent =
                String(
                    state.members.length
                );
        }

        if (!list) return;

        list.innerHTML =
            state.members
                .map(
                    member => `
                        <div class="member-item">

                            <div class="member-avatar">
                                ${renderAvatar(
                                    member.profile,
                                    member.nickname ||
                                    "Mwaniki Scholar"
                                )}

                                <span class="member-online"></span>
                            </div>

                            <span class="member-name">
                                ${escapeHtml(
                                    profileName(
                                        member.profile
                                    ) ||
                                    member.nickname ||
                                    "Mwaniki Scholar"
                                )}
                            </span>

                        </div>
                    `
                )
                .join("");
    }


    /* =========================================================
       CALL PICKER
       ========================================================= */

    function createCallPicker({
        title,
        users,
        multiple,
        onConfirm
    }) {
        document
            .getElementById(
                "mwanikiCallPicker"
            )
            ?.remove();

        const eligible =
            users.filter(
                user =>
                    String(
                        user.user_id ||
                        user.id
                    ) !==
                    String(
                        state.user?.id
                    )
            );

        const modal =
            document.createElement(
                "div"
            );

        modal.id =
            "mwanikiCallPicker";

        modal.className =
            "modal";

        modal.innerHTML = `
            <div class="modal-card">

                <div class="modal-header">

                    <h2>
                        ${escapeHtml(title)}
                    </h2>

                    <button
                        class="modal-close"
                        type="button"
                        data-picker-close
                    >
                        ×
                    </button>

                </div>

                <div
                    class="call-picker-list"
                    style="
                        display:flex;
                        flex-direction:column;
                        gap:7px;
                        max-height:430px;
                        overflow:auto;
                    "
                >

                    ${
                        eligible.length
                            ? eligible
                                .map(
                                    user => {
                                        const id =
                                            user.user_id ||
                                            user.id;

                                        const profile =
                                            user.profile ||
                                            user;

                                        return `
                                            <label
                                                style="
                                                    display:flex;
                                                    align-items:center;
                                                    gap:10px;
                                                    padding:10px;
                                                    border:1px solid #e1e8ea;
                                                    border-radius:10px;
                                                    cursor:pointer;
                                                "
                                            >
                                                <input
                                                    type="${
                                                        multiple
                                                            ? "checkbox"
                                                            : "radio"
                                                    }"
                                                    name="mwaniki-call-user"
                                                    value="${escapeHtml(
                                                        id
                                                    )}"
                                                >

                                                <span
                                                    class="member-avatar"
                                                >
                                                    ${renderAvatar(
                                                        profile
                                                    )}
                                                </span>

                                                <span>
                                                    <strong>
                                                        ${escapeHtml(
                                                            profileName(
                                                                profile
                                                            )
                                                        )}
                                                    </strong>
                                                </span>
                                            </label>
                                        `;
                                    }
                                )
                                .join("")
                            : `
                                <div class="message-loading">
                                    No other members are currently available.
                                </div>
                            `
                    }

                </div>

                <div class="modal-actions">

                    <button
                        type="button"
                        class="secondary-button"
                        data-picker-close
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        class="primary-button"
                        data-picker-confirm
                    >
                        Start Call
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(
            modal
        );

        modal
            .querySelectorAll(
                "[data-picker-close]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => modal.remove()
                );
            });

        modal
            .querySelector(
                "[data-picker-confirm]"
            )
            ?.addEventListener(
                "click",
                () => {
                    const selected =
                        Array.from(
                            modal.querySelectorAll(
                                'input[name="mwaniki-call-user"]:checked'
                            )
                        ).map(
                            input =>
                                input.value
                        );

                    if (!selected.length) {
                        showToast(
                            "Select at least one member."
                        );

                        return;
                    }

                    modal.remove();

                    onConfirm(
                        selected
                    );
                }
            );
    }


    function openDirectCallPicker() {
        createCallPicker({
            title:
                "Choose someone to call",
            users:
                state.members,
            multiple: false,
            onConfirm:
                userIds => {
                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:call-user",
                            {
                                detail: {
                                    userId:
                                        userIds[0],
                                    mode:
                                        "audio"
                                }
                            }
                        )
                    );
                }
        });
    }


    function openCommunityCallPicker(
        communityId
    ) {
        if (
            !communityId ||
            String(
                communityId
            ) !==
            String(
                state.currentCommunity?.id
            )
        ) {
            showToast(
                "Select the community first."
            );

            return;
        }

        createCallPicker({
            title:
                "Choose community members",
            users:
                state.members,
            multiple: true,
            onConfirm:
                userIds => {
                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:start-community-call",
                            {
                                detail: {
                                    communityId,
                                    userIds,
                                    mode:
                                        "audio"
                                }
                            }
                        )
                    );
                }
        });
    }


    function openGeneralCallPicker() {
        createCallPicker({
            title:
                "Choose members for General Call",
            users:
                state.members,
            multiple: true,
            onConfirm:
                userIds => {
                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:start-general-call",
                            {
                                detail: {
                                    userIds,
                                    mode:
                                        "audio"
                                }
                            }
                        )
                    );
                }
        });
    }


    /* =========================================================
       REALTIME
       ========================================================= */

    function subscribeToChannelRealtime() {
        if (!state.currentChannel) {
            return;
        }

        if (state.channelRealtime) {
            db.removeChannel(
                state.channelRealtime
            );

            state.channelRealtime =
                null;
        }

        state.channelRealtime =
            db.channel(
                `mwaniki-chat-${state.currentChannel.id}`
            );

        state.channelRealtime
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_messages",
                    filter:
                        `channel_id=eq.${state.currentChannel.id}`
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

                            await hydrateMessageProfiles();

                            await renderMessages();
                        }
                    }

                    if (
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
                            state.messages[
                                index
                            ] = {
                                ...state.messages[
                                    index
                                ],
                                ...payload.new
                            };

                            await renderMessages();
                        }
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

                        await renderMessages();
                    }
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


    async function setupCommunityRealtime() {
        if (
            state.realtime
        ) {
            await db.removeChannel(
                state.realtime
            );
        }

        state.realtime =
            db.channel(
                "mwaniki-community-realtime"
            );

        state.realtime
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_communities"
                },
                async () => {
                    await loadCommunities();
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


    /* =========================================================
       UI EVENTS
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
                        event.key ===
                            "Enter" &&
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
                event =>
                    autoResizeTextarea(
                        event.target
                    )
            );

        $("attachButton")
            ?.addEventListener(
                "click",
                () => {
                    $("attachmentInput")
                        ?.click();
                }
            );

        $("confirmAttachmentButton")
            ?.addEventListener(
                "click",
                sendAttachments
            );

        $("voiceNoteButton")
            ?.addEventListener(
                "click",
                () => {
                    if (
                        state.voice.recorder
                    ) {
                        stopVoiceRecording();
                    } else {
                        startVoiceRecording();
                    }
                }
            );

        $("stopVoiceButton")
            ?.addEventListener(
                "click",
                stopVoiceRecording
            );

        $("cancelVoiceButton")
            ?.addEventListener(
                "click",
                cancelVoiceRecording
            );

        $("sendVoiceButton")
            ?.addEventListener(
                "click",
                sendVoiceNote
            );
    }


    function autoResizeTextarea(
        textarea
    ) {
        if (!textarea) return;

        textarea.style.height =
            "auto";

        textarea.style.height =
            Math.min(
                textarea.scrollHeight,
                140
            ) + "px";
    }


    function setupModalClosers() {
        document
            .querySelectorAll(
                "[data-close-modal]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        closeModal(
                            button.dataset
                                .closeModal
                        );
                    }
                );
            });

        document
            .querySelectorAll(
                ".modal"
            )
            .forEach(modal => {
                modal.addEventListener(
                    "click",
                    event => {
                        if (
                            event.target ===
                            modal
                        ) {
                            modal.classList.add(
                                "hidden"
                            );
                        }
                    }
                );
            });
    }


    function setupHeaderButtons() {
        $("profileButton")
            ?.addEventListener(
                "click",
                openProfile
            );

        $("communityRulesButton")
            ?.addEventListener(
                "click",
                () =>
                    openModal(
                        "rulesModal"
                    )
            );

        $("ticketButton")
            ?.addEventListener(
                "click",
                () =>
                    openModal(
                        "ticketModal"
                    )
            );

        $("friendsButton")
            ?.addEventListener(
                "click",
                () =>
                    openModal(
                        "friendsModal"
                    )
            );

        $("generalCallButton")
            ?.addEventListener(
                "click",
                () =>
                    openGeneralCallPicker()
            );

        $("communityCallButton")
            ?.addEventListener(
                "click",
                () => {
                    const id =
                        getCurrentCommunityId();

                    if (!id) {
                        showToast(
                            "Select a community first."
                        );

                        return;
                    }

                    openCommunityCallPicker(
                        id
                    );
                }
            );

        $("callSpecificPersonButton")
            ?.addEventListener(
                "click",
                () => {
                    closeModal(
                        "callModal"
                    );

                    openDirectCallPicker();
                }
            );

        $("callWholeCommunityButton")
            ?.addEventListener(
                "click",
                () => {
                    closeModal(
                        "callModal"
                    );

                    openCommunityCallPicker(
                        getCurrentCommunityId()
                    );
                }
            );

        $("channelMembersButton")
            ?.addEventListener(
                "click",
                () => {
                    $("memberSidebar")
                        ?.scrollIntoView({
                            behavior:
                                "smooth"
                        });
                }
            );

        $("mobileSidebarButton")
            ?.addEventListener(
                "click",
                () => {
                    document
                        .querySelector(
                            ".community-app"
                        )
                        ?.classList.toggle(
                            "mobile-menu-open"
                        );
                }
            );
    }


    function setupTicketForm() {
        $("ticketForm")
            ?.addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    if (!state.user) {
                        return;
                    }

                    const type =
                        $("ticketType")
                            ?.value;

                    const subject =
                        $("ticketSubject")
                            ?.value
                            ?.trim();

                    const description =
                        $("ticketDescription")
                            ?.value
                            ?.trim();

                    if (
                        !type ||
                        !subject ||
                        !description
                    ) {
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
                                getCurrentCommunityId(),
                            report_type:
                                type,
                            subject,
                            description
                        });

                    if (error) {
                        console.error(
                            error
                        );

                        showToast(
                            "Ticket could not be submitted."
                        );

                        return;
                    }

                    event.target.reset();

                    closeModal(
                        "ticketModal"
                    );

                    showToast(
                        "Ticket submitted."
                    );
                }
            );
    }


    function setupCallEvents() {
        window.addEventListener(
            "mwaniki:call-person-picker",
            openDirectCallPicker
        );

        window.addEventListener(
            "mwaniki:community-call-picker-needed",
            event => {
                openCommunityCallPicker(
                    event.detail
                        ?.communityId ||
                    getCurrentCommunityId()
                );
            }
        );

        window.addEventListener(
            "mwaniki:open-general-call-picker",
            openGeneralCallPicker
        );
    }


    /* =========================================================
       PUBLIC API
       ========================================================= */

    function exposeCommunityAPI() {
        window.MwanikiCommunity = {
            getCurrentCommunityId,
            getCurrentCommunity() {
                return state.currentCommunity;
            },
            getCurrentChannel() {
                return state.currentChannel;
            },
            getMembers() {
                return state.members;
            },
            getCurrentCommunityMembers() {
                return state.members;
            }
        };
    }


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {
        if (!db) {
            console.error(
                "❌ Supabase client unavailable."
            );

            return;
        }

        setupCommunityHomeButton();

        setupComposer();

        setupAttachmentInput();

        setupEmojiPicker();

        setupPickers();

        setupModalClosers();

        setupHeaderButtons();

        setupTicketForm();

        setupCallEvents();

        exposeCommunityAPI();

        try {
            const authenticated =
                await initializeAuth();

            if (!authenticated) {
                return;
            }

            await loadProfile();

            await loadCommunities();

            await setupCommunityRealtime();

            console.log(
                "✅ Mwaniki Scholars Community loaded successfully."
            );

        } catch (error) {
            console.error(
                "❌ Community initialization failed:",
                error
            );

            showToast(
                error?.message ||
                "Community could not be loaded."
            );
        }
    }


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
