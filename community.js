/* ============================================================
   MWANIKI SCHOLARS
   community.js
   CLEAN COMMUNITY ENGINE
   ============================================================ */

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community starting...");

    /* ========================================================
       CONFIGURATION
       ======================================================== */

    const CONFIG = {
        attachmentBucket: "chat-attachments",

        maxFileSize: 50 * 1024 * 1024,

        allowedFiles: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",

            "application/pdf",
            "text/plain",
            "text/csv",

            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",

            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

            "audio/webm",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg",
            "audio/wav"
        ],

        reactionEmojis: [
            "❤️",
            "😂",
            "👍",
            "🔥",
            "👏",
            "😮"
        ],

        communityIcons: {
            "mwaniki scholars": "🎓",
            "gaming": "🎮",
            "memes": "😂"
        }
    };

    /* ========================================================
       STATE
       ======================================================== */

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;

    let communities = [];
    let currentCommunity = null;

    let channels = [];
    let currentChannel = null;

    let messages = [];
    let members = [];

    let selectedMessage = null;
    let editingMessageId = null;

    let realtimeChannels = [];

    let currentAttachment = null;

    let voiceRecorder = null;
    let voiceChunks = [];
    let voiceRecording = false;

    let rulesAccepted = false;

    let selectedPrivateUser = null;

    /* ========================================================
       DOM
       ======================================================== */

    const $ = id =>
        document.getElementById(id);

    const DOM = {};

    function cacheDOM() {
        const ids = [
            "rulesGate",
            "communityRulesAgreement",
            "acceptRulesButton",
            "rulesGateMessage",

            "communityRail",
            "communityRailList",

            "selectedCommunityIcon",
            "selectedCommunityName",
            "selectedCommunityDescription",

            "communityChoiceList",

            "channelSidebar",
            "channelList",

            "messageList",
            "memberSidebar",

            "messageInput",
            "messageForm",
            "sendMessageButton",

            "attachButton",
            "fileInput",

            "gifButton",
            "gifPicker",

            "emojiButton",
            "emojiPicker",

            "voiceNoteButton",
            "voiceRecorderBar",
            "voiceRecordingTime",
            "stopVoiceRecordingButton",
            "cancelVoiceRecordingButton",

            "generalCallButton",
            "generalCallUserInput",

            "communityModal",
            "communityModalClose",

            "notificationButton",
            "notificationBadge",

            "memberSearch",

            "privateChatModal",
            "privateChatList",
            "privateChatClose",

            "friendRequestModal",
            "friendRequestClose",

            "ticketModal",
            "ticketModalClose"
        ];

        ids.forEach(id => {
            DOM[id] = $(id);
        });
    }

    /* ========================================================
       SUPABASE
       ======================================================== */

    async function waitForSupabase(
        timeout = 10000
    ) {
        const started = Date.now();

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

    async function initializeSupabase() {
        supabase =
            await waitForSupabase();

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error(
                "❌ Session error:",
                error
            );

            return false;
        }

        if (!data?.session?.user) {
            console.warn(
                "⚠️ You must be signed in."
            );

            showMessage(
                "Please sign in to use the community."
            );

            return false;
        }

        currentUser =
            data.session.user;

        console.log(
            "✅ Authenticated:",
            currentUser.id
        );

        return true;
    }

    /* ========================================================
       PROFILE
       ======================================================== */

    async function loadCurrentProfile() {
        if (!currentUser) return;

        const possibleTables = [
            "chat_public_profiles",
            "profiles",
            "user_profiles"
        ];

        for (const table of possibleTables) {
            try {
                const {
                    data,
                    error
                } = await supabase
                    .from(table)
                    .select("*")
                    .eq(
                        "id",
                        currentUser.id
                    )
                    .maybeSingle();

                if (!error && data) {
                    currentProfile = data;
                    return;
                }
            } catch (_) {}
        }

        currentProfile = {
            id: currentUser.id,
            display_name:
                currentUser.user_metadata
                    ?.full_name ||
                currentUser.user_metadata
                    ?.name ||
                currentUser.email
                    ?.split("@")[0] ||
                "Mwaniki Scholar",

            avatar_url:
                currentUser.user_metadata
                    ?.avatar_url ||
                ""
        };
    }

    function profileName(profile) {
        if (!profile) {
            return "Mwaniki Scholar";
        }

        return (
            profile.display_name ||
            profile.full_name ||
            profile.name ||
            profile.username ||
            "Mwaniki Scholar"
        );
    }

    function profileAvatar(profile) {
        if (!profile) return "";

        return (
            profile.avatar_url ||
            profile.photo_url ||
            profile.profile_image ||
            profile.image_url ||
            ""
        );
    }

    async function getProfile(userId) {
        if (!userId) return null;

        const tables = [
            "chat_public_profiles",
            "profiles",
            "user_profiles"
        ];

        for (const table of tables) {
            try {
                const {
                    data,
                    error
                } = await supabase
                    .from(table)
                    .select("*")
                    .eq(
                        "id",
                        userId
                    )
                    .maybeSingle();

                if (!error && data) {
                    return data;
                }
            } catch (_) {}
        }

        return null;
    }

    /* ========================================================
       COMMUNITY ICONS
       ======================================================== */

    function communityIcon(
        community
    ) {
        const name =
            String(
                community?.name || ""
            )
                .trim()
                .toLowerCase();

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

        if (
            name.includes("mwaniki") ||
            name.includes("scholar") ||
            name.includes("academic")
        ) {
            return "🎓";
        }

        return "🌐";
    }

    /* ========================================================
       LOAD COMMUNITIES
       ======================================================== */

    async function loadCommunities() {
        const {
            data,
            error
        } = await supabase
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
            console.error(
                "❌ Communities failed:",
                error
            );

            showMessage(
                "Unable to load communities."
            );

            return;
        }

        communities = data || [];

        console.log(
            `✅ Communities loaded: ${communities.length}`
        );

        renderCommunityRail();
        renderCommunityChoices();

        if (!communities.length) {
            return;
        }

        const saved =
            localStorage.getItem(
                "mwanikiSelectedCommunity"
            );

        const found =
            communities.find(
                c => c.id === saved
            );

        await selectCommunity(
            found || communities[0]
        );
    }

    function renderCommunityRail() {
        const container =
            DOM.communityRailList ||
            DOM.communityRail;

        if (!container) return;

        container.innerHTML = "";

        communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "community-rail-item";

                button.dataset.communityId =
                    community.id;

                if (
                    currentCommunity?.id ===
                    community.id
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.innerHTML = `
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
                `;

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community
                        )
                );

                container.appendChild(
                    button
                );
            }
        );
    }

    function renderCommunityChoices() {
        const container =
            DOM.communityChoiceList;

        if (!container) return;

        container.innerHTML = "";

        communities.forEach(
            community => {
                const item =
                    document.createElement(
                        "button"
                    );

                item.type = "button";

                item.className =
                    "community-choice";

                item.innerHTML = `
                    <span class="community-choice-icon">
                        ${communityIcon(
                            community
                        )}
                    </span>

                    <span>
                        <strong>
                            ${escapeHtml(
                                community.name
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                community.description ||
                                ""
                            )}
                        </small>
                    </span>
                `;

                item.addEventListener(
                    "click",
                    async () => {
                        await selectCommunity(
                            community
                        );

                        closeCommunityModal();
                    }
                );

                container.appendChild(
                    item
                );
            }
        );
    }

    /* ========================================================
       SELECT COMMUNITY
       ======================================================== */

    async function selectCommunity(
        community
    ) {
        if (!community) return;

        currentCommunity =
            community;

        localStorage.setItem(
            "mwanikiSelectedCommunity",
            community.id
        );

        renderCommunityHeader();
        renderCommunityRail();

        await loadCommunityRules();
        await loadChannels();
        await loadCommunityMembers();

        subscribeCommunityRealtime();
    }

    function renderCommunityHeader() {
        if (
            DOM.selectedCommunityIcon
        ) {
            DOM.selectedCommunityIcon.textContent =
                communityIcon(
                    currentCommunity
                );
        }

        if (
            DOM.selectedCommunityName
        ) {
            DOM.selectedCommunityName.textContent =
                currentCommunity.name;
        }

        if (
            DOM.selectedCommunityDescription
        ) {
            DOM.selectedCommunityDescription.textContent =
                currentCommunity.description ||
                "";
        }
    }

    /* ========================================================
       COMMUNITY RULES
       ======================================================== */

    async function loadCommunityRules() {
        if (!currentCommunity) {
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("chat_rules")
            .select("*")
            .eq(
                "community_id",
                currentCommunity.id
            )
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
            console.warn(
                "Rules could not be loaded:",
                error
            );

            return;
        }

        if (!data?.length) {
            hideRulesGate();
            return;
        }

        const key =
            `mwanikiRulesAccepted_${currentCommunity.id}`;

        rulesAccepted =
            localStorage.getItem(
                key
            ) === "true";

        if (rulesAccepted) {
            hideRulesGate();
            return;
        }

        showRulesGate(data);
    }

    function showRulesGate(
        rules
    ) {
        if (!DOM.rulesGate) return;

        DOM.rulesGate.hidden = false;
        DOM.rulesGate.classList.add(
            "open"
        );

        if (
            DOM.communityRulesAgreement
        ) {
            DOM.communityRulesAgreement.innerHTML =
                rules
                    .map(
                        rule => `
                            <div class="community-rule">
                                <strong>
                                    ${escapeHtml(
                                        rule.title
                                    )}
                                </strong>

                                <p>
                                    ${escapeHtml(
                                        rule.description ||
                                        ""
                                    )}
                                </p>
                            </div>
                        `
                    )
                    .join("");
        }
    }

    function hideRulesGate() {
        if (!DOM.rulesGate) return;

        DOM.rulesGate.classList.remove(
            "open"
        );

        DOM.rulesGate.hidden = true;
    }

    async function acceptRules() {
        if (!currentCommunity) return;

        const key =
            `mwanikiRulesAccepted_${currentCommunity.id}`;

        localStorage.setItem(
            key,
            "true"
        );

        rulesAccepted = true;

        hideRulesGate();
    }

    /* ========================================================
       CHANNELS
       ======================================================== */

    async function loadChannels() {
        if (!currentCommunity) {
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("chat_channels")
            .select("*")
            .eq(
                "community_id",
                currentCommunity.id
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
            );

        if (error) {
            console.error(
                "❌ Channels failed:",
                error
            );

            return;
        }

        channels = data || [];

        renderChannels();

        if (!channels.length) {
            clearMessages();

            return;
        }

        const saved =
            localStorage.getItem(
                "mwanikiSelectedChannel"
            );

        const found =
            channels.find(
                channel =>
                    channel.id === saved
            );

        await selectChannel(
            found || channels[0]
        );
    }

    function renderChannels() {
        const container =
            DOM.channelList;

        if (!container) return;

        container.innerHTML = "";

        let lastCategory = "";

        channels.forEach(
            channel => {
                const category =
                    channel.channel_type ||
                    "general";

                if (
                    category !==
                    lastCategory
                ) {
                    const heading =
                        document.createElement(
                            "div"
                        );

                    heading.className =
                        "channel-category";

                    heading.textContent =
                        category
                            .replaceAll(
                                "_",
                                " "
                            )
                            .toUpperCase();

                    container.appendChild(
                        heading
                    );

                    lastCategory =
                        category;
                }

                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";

                button.className =
                    "channel-item";

                button.dataset.channelId =
                    channel.id;

                if (
                    currentChannel?.id ===
                    channel.id
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                const icon =
                    channel.icon ||
                    "#";

                button.innerHTML = `
                    <span class="channel-icon">
                        ${escapeHtml(
                            icon
                        )}
                    </span>

                    <span class="channel-name">
                        ${escapeHtml(
                            channel.name
                        )}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () =>
                        selectChannel(
                            channel
                        )
                );

                container.appendChild(
                    button
                );
            }
        );
    }

    /* ========================================================
       SELECT CHANNEL
       ======================================================== */

    async function selectChannel(
        channel
    ) {
        if (!channel) return;

        currentChannel =
            channel;

        localStorage.setItem(
            "mwanikiSelectedChannel",
            channel.id
        );

        renderChannels();

        await loadMessages();

        await markChannelRead();

        updateComposerState();
    }

    /* ========================================================
       MESSAGES
       ======================================================== */

    async function loadMessages() {
        if (!currentChannel) {
            clearMessages();
            return;
        }

        const {
            data,
            error
        } = await supabase
            .from("chat_messages")
            .select(`
                *,
                chat_attachments(*)
            `)
            .eq(
                "channel_id",
                currentChannel.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            )
            .limit(300);

        if (error) {
            console.error(
                "❌ Messages failed:",
                error
            );

            return;
        }

        messages = data || [];

        await enrichMessages();

        renderMessages();
    }

    async function enrichMessages() {
        const ids =
            [
                ...new Set(
                    messages
                        .map(
                            m =>
                                m.user_id
                        )
                        .filter(Boolean)
                )
            ];

        const profileMap =
            new Map();

        await Promise.all(
            ids.map(
                async userId => {
                    const profile =
                        await getProfile(
                            userId
                        );

                    if (profile) {
                        profileMap.set(
                            userId,
                            profile
                        );
                    }
                }
            )
        );

        messages =
            messages.map(
                message => ({
                    ...message,

                    profile:
                        profileMap.get(
                            message.user_id
                        ) || null
                })
            );
    }

    function renderMessages() {
        const container =
            DOM.messageList;

        if (!container) return;

        container.innerHTML = "";

        if (!messages.length) {
            container.innerHTML = `
                <div class="empty-community-state">
                    <div>💬</div>

                    <strong>
                        No messages yet
                    </strong>

                    <span>
                        Start the conversation.
                    </span>
                </div>
            `;

            return;
        }

        messages.forEach(
            message => {
                container.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );

        requestAnimationFrame(
            scrollMessagesToBottom
        );
    }

    function createMessageElement(
        message
    ) {
        const article =
            document.createElement(
                "article"
            );

        article.className =
            "community-message";

        article.dataset.messageId =
            message.id;

        if (
            message.user_id ===
            currentUser.id
        ) {
            article.classList.add(
                "own-message"
            );
        }

        if (message.is_deleted) {
            article.classList.add(
                "deleted-message"
            );
        }

        const name =
            profileName(
                message.profile
            );

        const avatar =
            profileAvatar(
                message.profile
            );

        const avatarHTML =
            avatar
                ? `
                    <img
                        src="${escapeAttribute(
                            avatar
                        )}"
                        alt="${escapeAttribute(
                            name
                        )}"
                        class="message-avatar"
                    >
                `
                : `
                    <div class="message-avatar fallback-avatar">
                        ${escapeHtml(
                            initials(name)
                        )}
                    </div>
                `;

        const time =
            formatTime(
                message.created_at
            );

        const content =
            message.is_deleted
                ? `<em>This message was deleted.</em>`
                : formatMessageContent(
                      message.content
                  );

        article.innerHTML = `
            <div class="message-avatar-wrap">
                ${avatarHTML}
            </div>

            <div class="message-main">

                <div class="message-header">

                    <strong class="message-author">
                        ${escapeHtml(name)}
                    </strong>

                    <span class="message-time">
                        ${time}
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
                    ${content}
                </div>

                <div class="message-attachments">
                    ${renderAttachments(
                        message.chat_attachments ||
                        []
                    )}
                </div>

                <div class="message-actions">

                    ${renderReactionButtons(
                        message
                    )}

                    <button
                        type="button"
                        class="message-action-btn message-reply-btn"
                        data-message-id="${message.id}"
                    >
                        ↩️
                    </button>

                    ${
                        message.user_id ===
                        currentUser.id
                            ? `
                                <button
                                    type="button"
                                    class="message-action-btn message-edit-btn"
                                    data-message-id="${message.id}"
                                >
                                    ✏️
                                </button>

                                <button
                                    type="button"
                                    class="message-action-btn message-delete-btn"
                                    data-message-id="${message.id}"
                                >
                                    🗑️
                                </button>
                            `
                            : ""
                    }

                </div>

            </div>
        `;

        attachMessageEvents(
            article,
            message
        );

        return article;
    }

    function renderAttachments(
        attachments
    ) {
        if (!attachments?.length) {
            return "";
        }

        return attachments
            .map(
                attachment => {
                    const type =
                        attachment.mime_type ||
                        "";

                    if (
                        type.startsWith(
                            "image/"
                        )
                    ) {
                        return `
                            <a
                                href="${escapeAttribute(
                                    attachment.file_url
                                )}"
                                target="_blank"
                                rel="noopener"
                                class="message-image-link"
                            >
                                <img
                                    src="${escapeAttribute(
                                        attachment.file_url
                                    )}"
                                    alt="${escapeAttribute(
                                        attachment.file_name
                                    )}"
                                    class="message-image"
                                >
                            </a>
                        `;
                    }

                    return `
                        <a
                            href="${escapeAttribute(
                                attachment.file_url
                            )}"
                            target="_blank"
                            rel="noopener"
                            class="message-file"
                        >
                            📎
                            ${escapeHtml(
                                attachment.file_name
                            )}
                        </a>
                    `;
                }
            )
            .join("");
    }

    function renderReactionButtons(
        message
    ) {
        return `
            <div class="message-reactions">
                ${CONFIG.reactionEmojis
                    .map(
                        emoji => `
                            <button
                                type="button"
                                class="reaction-btn"
                                data-message-id="${message.id}"
                                data-reaction="${emoji}"
                                title="React ${emoji}"
                            >
                                ${emoji}
                            </button>
                        `
                    )
                    .join("")}
            </div>
        `;
    }

    function attachMessageEvents(
        article,
        message
    ) {
        article
            .querySelectorAll(
                ".reaction-btn"
            )
            .forEach(
                button => {
                    button.addEventListener(
                        "click",
                        () =>
                            toggleReaction(
                                message.id,
                                button.dataset
                                    .reaction
                            )
                    );
                }
            );

        article
            .querySelector(
                ".message-delete-btn"
            )
            ?.addEventListener(
                "click",
                () =>
                    deleteMessage(
                        message.id
                    )
            );

        article
            .querySelector(
                ".message-edit-btn"
            )
            ?.addEventListener(
                "click",
                () =>
                    beginEditMessage(
                        message
                    )
            );

        article
            .querySelector(
                ".message-reply-btn"
            )
            ?.addEventListener(
                "click",
                () =>
                    replyToMessage(
                        message
                    )
            );
    }

    /* ========================================================
       SEND MESSAGE
       ======================================================== */

    async function sendMessage() {
        if (!currentUser) {
            showMessage(
                "Please sign in first."
            );

            return;
        }

        if (!currentChannel) {
            showMessage(
                "Select a channel first."
            );

            return;
        }

        if (
            isCurrentUserRestricted()
        ) {
            showMessage(
                "You cannot send messages in this channel."
            );

            return;
        }

        const input =
            DOM.messageInput;

        if (!input) return;

        const content =
            input.value.trim();

        if (
            !content &&
            !currentAttachment
        ) {
            return;
        }

        try {
            let messageId = null;

            if (editingMessageId) {
                await updateMessage(
                    editingMessageId,
                    content
                );

                editingMessageId =
                    null;

                input.value = "";

                return;
            }

            const {
                data,
                error
            } = await supabase
                .from("chat_messages")
                .insert({
                    channel_id:
                        currentChannel.id,

                    user_id:
                        currentUser.id,

                    content:
                        content ||
                        "",

                    message_type:
                        currentAttachment
                            ? attachmentMessageType(
                                  currentAttachment
                              )
                            : "text"
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            messageId = data.id;

            if (currentAttachment) {
                await saveAttachment(
                    messageId,
                    currentAttachment
                );

                currentAttachment =
                    null;
            }

            input.value = "";

            resetAttachmentUI();

        } catch (error) {
            console.error(
                "❌ Send message failed:",
                error
            );

            showMessage(
                friendlySupabaseError(
                    error
                )
            );
        }
    }

    async function updateMessage(
        messageId,
        content
    ) {
        const {
            error
        } = await supabase
            .from("chat_messages")
            .update({
                content,
                is_edited: true,
                edited_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                messageId
            )
            .eq(
                "user_id",
                currentUser.id
            );

        if (error) {
            console.error(
                "❌ Message update failed:",
                error
            );

            return;
        }

        const input =
            DOM.messageInput;

        if (input) {
            input.value = "";
        }

        updateComposerState();
    }

    async function deleteMessage(
        messageId
    ) {
        const message =
            messages.find(
                m =>
                    m.id ===
                    messageId
            );

        if (!message) return;

        if (
            message.user_id !==
            currentUser.id
        ) {
            showMessage(
                "You can only delete your own messages."
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
        } = await supabase
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
                currentUser.id
            );

        if (error) {
            console.error(
                "❌ Delete failed:",
                error
            );

            showMessage(
                friendlySupabaseError(
                    error
                )
            );

            return;
        }

        await loadMessages();
    }

    function beginEditMessage(
        message
    ) {
        if (
            message.user_id !==
            currentUser.id
        ) {
            return;
        }

        editingMessageId =
            message.id;

        if (DOM.messageInput) {
            DOM.messageInput.value =
                message.content || "";

            DOM.messageInput.focus();

            updateComposerState();
        }
    }

    function replyToMessage(
        message
    ) {
        if (!DOM.messageInput) {
            return;
        }

        DOM.messageInput.focus();

        DOM.messageInput.dataset.replyTo =
            message.id;
    }

    /* ========================================================
       REACTIONS
       ======================================================== */

    async function toggleReaction(
        messageId,
        reaction
    ) {
        const {
            data: existing,
            error: selectError
        } = await supabase
            .from("chat_message_reactions")
            .select("id")
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
                reaction
            )
            .maybeSingle();

        if (selectError) {
            console.error(
                "Reaction lookup failed:",
                selectError
            );

            return;
        }

        if (existing) {
            await supabase
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
        } = await supabase
            .from(
                "chat_message_reactions"
            )
            .insert({
                message_id:
                    messageId,

                user_id:
                    currentUser.id,

                reaction
            });

        if (error) {
            console.error(
                "Reaction failed:",
                error
            );
        }
    }

    /* ========================================================
       ATTACHMENTS
       ======================================================== */

    function openAttachmentPicker() {
        let input =
            DOM.fileInput;

        if (!input) {
            input =
                document.createElement(
                    "input"
                );

            input.type = "file";
            input.id = "fileInput";

            input.accept =
                CONFIG.allowedFiles.join(
                    ","
                );

            input.hidden = true;

            document.body.appendChild(
                input
            );

            DOM.fileInput =
                input;

            input.addEventListener(
                "change",
                handleFileSelected
            );
        }

        input.click();
    }

    async function handleFileSelected(
        event
    ) {
        const file =
            event.target.files?.[0];

        if (!file) return;

        if (
            file.size >
            CONFIG.maxFileSize
        ) {
            showMessage(
                "This file is larger than 50 MB."
            );

            event.target.value = "";

            return;
        }

        if (
            !CONFIG.allowedFiles.includes(
                file.type
            )
        ) {
            showMessage(
                "This file type is not supported."
            );

            event.target.value = "";

            return;
        }

        currentAttachment =
            file;

        showAttachmentPreview(
            file
        );
    }

    function showAttachmentPreview(
        file
    ) {
        let preview =
            document.getElementById(
                "chatAttachmentPreview"
            );

        if (!preview) {
            preview =
                document.createElement(
                    "div"
                );

            preview.id =
                "chatAttachmentPreview";

            preview.className =
                "chat-attachment-preview";

            const composer =
                DOM.messageInput
                    ?.parentElement;

            composer?.appendChild(
                preview
            );
        }

        preview.innerHTML = `
            <span>
                📎
                ${escapeHtml(
                    file.name
                )}
            </span>

            <button
                type="button"
                id="removeChatAttachment"
            >
                ×
            </button>
        `;

        document
            .getElementById(
                "removeChatAttachment"
            )
            ?.addEventListener(
                "click",
                () => {
                    currentAttachment =
                        null;

                    resetAttachmentUI();
                }
            );
    }

    function resetAttachmentUI() {
        const preview =
            document.getElementById(
                "chatAttachmentPreview"
            );

        preview?.remove();

        if (DOM.fileInput) {
            DOM.fileInput.value = "";
        }
    }

    async function saveAttachment(
        messageId,
        file
    ) {
        const path =
            `${currentUser.id}/${Date.now()}-${sanitizeFileName(
                file.name
            )}`;

        const {
            error: uploadError
        } = await supabase
            .storage
            .from(
                CONFIG.attachmentBucket
            )
            .upload(
                path,
                file,
                {
                    upsert: false,
                    contentType:
                        file.type
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
                    CONFIG.attachmentBucket
                )
                .getPublicUrl(
                    path
                );

        const {
            error
        } = await supabase
            .from(
                "chat_attachments"
            )
            .insert({
                message_id:
                    messageId,

                uploaded_by:
                    currentUser.id,

                file_name:
                    file.name,

                file_path:
                    path,

                file_url:
                    data.publicUrl,

                mime_type:
                    file.type,

                file_size:
                    file.size
            });

        if (error) {
            throw error;
        }
    }

    function attachmentMessageType(
        file
    ) {
        if (
            file.type.startsWith(
                "image/"
            )
        ) {
            return "image";
        }

        if (
            file.type.startsWith(
                "audio/"
            )
        ) {
            return "audio";
        }

        return "file";
    }

    /* ========================================================
       EMOJI
       ======================================================== */

    function setupEmojiPicker() {
        const button =
            DOM.emojiButton;

        const picker =
            DOM.emojiPicker;

        if (!button || !picker) {
            return;
        }

        picker.hidden = true;

        button.addEventListener(
            "click",
            event => {
                event.stopPropagation();

                picker.hidden =
                    !picker.hidden;

                picker.classList.toggle(
                    "open",
                    !picker.hidden
                );
            }
        );

        picker.addEventListener(
            "emoji-click",
            event => {
                const emoji =
                    event.detail
                        ?.unicode;

                if (
                    !emoji ||
                    !DOM.messageInput
                ) {
                    return;
                }

                insertAtCursor(
                    DOM.messageInput,
                    emoji
                );

                picker.hidden = true;

                picker.classList.remove(
                    "open"
                );
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
                    picker.hidden =
                        true;

                    picker.classList.remove(
                        "open"
                    );
                }
            }
        );
    }

    /* ========================================================
       GIF / STICKERS
       ======================================================== */

    function toggleGifPicker() {
        if (!DOM.gifPicker) {
            return;
        }

        DOM.gifPicker.hidden =
            !DOM.gifPicker.hidden;

        DOM.gifPicker.classList.toggle(
            "open",
            !DOM.gifPicker.hidden
        );
    }

    function insertGif(
        url
    ) {
        if (!url || !DOM.messageInput) {
            return;
        }

        insertAtCursor(
            DOM.messageInput,
            url
        );

        DOM.gifPicker.hidden =
            true;
    }

    /* ========================================================
       VOICE NOTES
       ======================================================== */

    async function toggleVoiceRecording() {
        if (voiceRecording) {
            stopVoiceRecording();
            return;
        }

        await startVoiceRecording();
    }

    async function startVoiceRecording() {
        if (
            !navigator.mediaDevices
                ?.getUserMedia
        ) {
            showMessage(
                "Voice recording is not supported by this browser."
            );

            return;
        }

        try {
            const stream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio: true
                    }
                );

            voiceChunks = [];

            voiceRecorder =
                new MediaRecorder(
                    stream
                );

            voiceRecorder.ondataavailable =
                event => {
                    if (
                        event.data.size
                    ) {
                        voiceChunks.push(
                            event.data
                        );
                    }
                };

            voiceRecorder.onstop =
                async () => {
                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    const blob =
                        new Blob(
                            voiceChunks,
                            {
                                type:
                                    voiceRecorder.mimeType ||
                                    "audio/webm"
                            }
                        );

                    await sendVoiceNote(
                        blob
                    );
                };

            voiceRecorder.start();

            voiceRecording = true;

            DOM.voiceRecorderBar?.classList.add(
                "recording"
            );

        } catch (error) {
            console.error(
                "Voice recording failed:",
                error
            );

            showMessage(
                "Microphone permission was not granted."
            );
        }
    }

    function stopVoiceRecording() {
        if (
            voiceRecorder &&
            voiceRecorder.state !==
                "inactive"
        ) {
            voiceRecorder.stop();
        }

        voiceRecording = false;

        DOM.voiceRecorderBar?.classList.remove(
            "recording"
        );
    }

    async function sendVoiceNote(
        blob
    ) {
        const extension =
            blob.type.includes(
                "ogg"
            )
                ? "ogg"
                : "webm";

        const file =
            new File(
                [
                    blob
                ],
                `voice-${Date.now()}.${extension}`,
                {
                    type:
                        blob.type ||
                        "audio/webm"
                }
            );

        currentAttachment =
            file;

        await sendMessage();
    }

    /* ========================================================
       MEMBERS
       ======================================================== */

    async function loadCommunityMembers() {
        if (!currentCommunity) {
            return;
        }

        const {
            data,
            error
        } = await supabase
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
                badge,
                membership_status,
                is_muted,
                is_banned
            `)
            .eq(
                "community_id",
                currentCommunity.id
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
                "❌ Members failed:",
                error
            );

            return;
        }

        members = data || [];

        await enrichMembers();

        renderMembers();
    }

    async function enrichMembers() {
        await Promise.all(
            members.map(
                async member => {
                    const profile =
                        await getProfile(
                            member.user_id
                        );

                    member.profile =
                        profile;

                    member.name =
                        member.display_name ||
                        member.nickname ||
                        profileName(
                            profile
                        );

                    member.avatar =
                        member.avatar_url ||
                        profileAvatar(
                            profile
                        );
                }
            )
        );
    }

    function renderMembers(
        filter = ""
    ) {
        const container =
            DOM.memberSidebar;

        if (!container) return;

        const search =
            String(filter)
                .trim()
                .toLowerCase();

        const visible =
            members.filter(
                member =>
                    !search ||
                    String(
                        member.name
                    )
                        .toLowerCase()
                        .includes(search)
            );

        container.innerHTML = "";

        if (!visible.length) {
            container.innerHTML = `
                <div class="empty-members">
                    No members found.
                </div>
            `;

            return;
        }

        visible.forEach(
            member => {
                const card =
                    createMemberCard(
                        member
                    );

                container.appendChild(
                    card
                );
            }
        );
    }

    function createMemberCard(
        member
    ) {
        const card =
            document.createElement(
                "div"
            );

        card.className =
            "community-member-card";

        card.dataset.userId =
            member.user_id;

        const status =
            String(
                member.status ||
                "offline"
            ).toLowerCase();

        const avatar =
            member.avatar;

        card.innerHTML = `
            <div class="member-avatar-wrap">

                ${
                    avatar
                        ? `
                            <img
                                src="${escapeAttribute(
                                    avatar
                                )}"
                                alt="${escapeAttribute(
                                    member.name
                                )}"
                                class="member-avatar"
                            >
                        `
                        : `
                            <div class="member-avatar fallback-avatar">
                                ${escapeHtml(
                                    initials(
                                        member.name
                                    )
                                )}
                            </div>
                        `
                }

                <span
                    class="member-status-dot ${escapeAttribute(
                        status
                    )}"
                ></span>

            </div>

            <div class="member-info">

                <strong>
                    ${escapeHtml(
                        member.name
                    )}
                </strong>

                <small>
                    ${escapeHtml(
                        member.role ||
                        "Student"
                    )}

                    ${
                        member.badge
                            ? `
                                ·
                                ${escapeHtml(
                                    member.badge
                                )}
                            `
                            : ""
                    }
                </small>

            </div>

            <div class="member-actions">

                ${
                    member.user_id !==
                    currentUser.id
                        ? `
                            <button
                                type="button"
                                class="member-call-button"
                                title="Call ${escapeAttribute(
                                    member.name
                                )}"
                            >
                                📞
                            </button>

                            <button
                                type="button"
                                class="member-video-button"
                                title="Video call ${escapeAttribute(
                                    member.name
                                )}"
                            >
                                📹
                            </button>

                            <button
                                type="button"
                                class="member-message-button"
                                title="Message ${escapeAttribute(
                                    member.name
                                )}"
                            >
                                💬
                            </button>

                            <button
                                type="button"
                                class="member-friend-button"
                                title="Add ${escapeAttribute(
                                    member.name
                                )} as a friend"
                            >
                                👥
                            </button>
                        `
                        : `
                            <span class="member-you">
                                You
                            </span>
                        `
                }

            </div>
        `;

        card
            .querySelector(
                ".member-call-button"
            )
            ?.addEventListener(
                "click",
                () =>
                    dispatchCall(
                        member.user_id,
                        "audio"
                    )
            );

        card
            .querySelector(
                ".member-video-button"
            )
            ?.addEventListener(
                "click",
                () =>
                    dispatchCall(
                        member.user_id,
                        "video"
                    )
            );

        card
            .querySelector(
                ".member-message-button"
            )
            ?.addEventListener(
                "click",
                () =>
                    openPrivateChat(
                        member
                    )
            );

        card
            .querySelector(
                ".member-friend-button"
            )
            ?.addEventListener(
                "click",
                () =>
                    sendFriendRequest(
                        member.user_id
                    )
            );

        return card;
    }

    /* ========================================================
       CALLING UI BRIDGE
       ======================================================== */

    function dispatchCall(
        userId,
        mode
    ) {
        if (!userId) {
            return;
        }

        /*
         * The UUID stays internal.
         *
         * The user never types it.
         *
         * call.js receives it from the
         * selected member card.
         */

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:call-user",
                {
                    detail: {
                        userId,
                        mode
                    }
                }
            )
        );
    }

    function dispatchCommunityCall(
        mode = "audio"
    ) {
        if (
            !currentCommunity
        ) {
            showMessage(
                "Select a community first."
            );

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:community-call",
                {
                    detail: {
                        communityId:
                            currentCommunity.id,
                        mode
                    }
                }
            )
        );
    }

    function dispatchGeneralCall(
        mode = "audio"
    ) {
        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:general-call",
                {
                    detail: {
                        mode
                    }
                }
            )
        );
    }

    /* ========================================================
       FRIEND REQUESTS
       ======================================================== */

    async function sendFriendRequest(
        receiverId
    ) {
        if (!receiverId) return;

        if (
            receiverId ===
            currentUser.id
        ) {
            return;
        }

        const {
            data: existing
        } = await supabase
            .from(
                "chat_friend_requests"
            )
            .select("id,status")
            .or(
                `and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`
            )
            .maybeSingle();

        if (existing) {
            showMessage(
                `Friend request already exists: ${existing.status}`
            );

            return;
        }

        const {
            error
        } = await supabase
            .from(
                "chat_friend_requests"
            )
            .insert({
                sender_id:
                    currentUser.id,

                receiver_id:
                    receiverId,

                status:
                    "pending"
            });

        if (error) {
            console.error(
                "Friend request failed:",
                error
            );

            showMessage(
                friendlySupabaseError(
                    error
                )
            );

            return;
        }

        showMessage(
            "Friend request sent."
        );
    }

    /* ========================================================
       PRIVATE CHAT
       ======================================================== */

    async function openPrivateChat(
        member
    ) {
        if (!member?.user_id) {
            return;
        }

        selectedPrivateUser =
            member;

        /*
         * Find an existing conversation
         * containing both users.
         */

        const {
            data: myMemberships,
            error
        } = await supabase
            .from(
                "chat_private_conversation_members"
            )
            .select(
                "conversation_id"
            )
            .eq(
                "user_id",
                currentUser.id
            );

        if (error) {
            console.error(
                "Private conversation lookup failed:",
                error
            );

            return;
        }

        let conversationId = null;

        for (
            const membership of
            myMemberships || []
        ) {
            const {
                data: other
            } = await supabase
                .from(
                    "chat_private_conversation_members"
                )
                .select("id")
                .eq(
                    "conversation_id",
                    membership.conversation_id
                )
                .eq(
                    "user_id",
                    member.user_id
                )
                .maybeSingle();

            if (other) {
                conversationId =
                    membership.conversation_id;

                break;
            }
        }

        if (!conversationId) {
            const {
                data: conversation,
                error:
                    conversationError
            } = await supabase
                .from(
                    "chat_private_conversations"
                )
                .insert({
                    conversation_type:
                        "direct",

                    created_by:
                        currentUser.id
                })
                .select()
                .single();

            if (conversationError) {
                console.error(
                    "Private conversation creation failed:",
                    conversationError
                );

                return;
            }

            conversationId =
                conversation.id;

            await supabase
                .from(
                    "chat_private_conversation_members"
                )
                .insert([
                    {
                        conversation_id:
                            conversationId,

                        user_id:
                            currentUser.id
                    },
                    {
                        conversation_id:
                            conversationId,

                        user_id:
                            member.user_id
                    }
                ]);
        }

        /*
         * Tell the private-chat interface
         * to open the conversation.
         */

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:open-private-chat",
                {
                    detail: {
                        conversationId,
                        userId:
                            member.user_id,
                        name:
                            member.name,
                        avatar:
                            member.avatar
                    }
                }
            )
        );
    }

    /* ========================================================
       REALTIME
       ======================================================== */

    function subscribeCommunityRealtime() {
        cleanupRealtime();

        if (!currentCommunity) {
            return;
        }

        const communityChannel =
            supabase.channel(
                `community-${currentCommunity.id}`
            );

        communityChannel
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "chat_channels",
                    filter:
                        `community_id=eq.${currentCommunity.id}`
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
                    table:
                        "chat_community_members",
                    filter:
                        `community_id=eq.${currentCommunity.id}`
                },
                async () => {
                    await loadCommunityMembers();
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

        realtimeChannels.push(
            communityChannel
        );

        subscribeChannelRealtime();
    }

    function subscribeChannelRealtime() {
        if (!currentChannel) {
            return;
        }

        const channel =
            supabase.channel(
                `channel-${currentChannel.id}`
            );

        channel
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table:
                        "chat_messages",
                    filter:
                        `channel_id=eq.${currentChannel.id}`
                },
                async payload => {
                    if (
                        messages.some(
                            message =>
                                message.id ===
                                payload.new.id
                        )
                    ) {
                        return;
                    }

                    const message =
                        {
                            ...payload.new
                        };

                    message.profile =
                        await getProfile(
                            message.user_id
                        );

                    messages.push(
                        message
                    );

                    renderMessages();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table:
                        "chat_messages",
                    filter:
                        `channel_id=eq.${currentChannel.id}`
                },
                async payload => {
                    const index =
                        messages.findIndex(
                            message =>
                                message.id ===
                                payload.new.id
                        );

                    if (index < 0) {
                        await loadMessages();
                        return;
                    }

                    messages[index] = {
                        ...messages[index],
                        ...payload.new
                    };

                    renderMessages();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table:
                        "chat_message_reactions"
                },
                async () => {
                    await loadMessages();
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table:
                        "chat_message_reactions"
                },
                async () => {
                    await loadMessages();
                }
            )
            .subscribe();

        realtimeChannels.push(
            channel
        );
    }

    function cleanupRealtime() {
        realtimeChannels.forEach(
            channel => {
                try {
                    supabase.removeChannel(
                        channel
                    );
                } catch (_) {}
            }
        );

        realtimeChannels = [];
    }

    /* ========================================================
       READ STATUS
       ======================================================== */

    async function markChannelRead() {
        if (
            !currentChannel ||
            !currentUser
        ) {
            return;
        }

        await supabase
            .from("chat_read_status")
            .upsert(
                {
                    channel_id:
                        currentChannel.id,

                    user_id:
                        currentUser.id,

                    last_read_at:
                        new Date().toISOString()
                },
                {
                    onConflict:
                        "channel_id,user_id"
                }
            );
    }

    /* ========================================================
       PRESENCE
       ======================================================== */

    async function updatePresence(
        status = "online"
    ) {
        if (!currentUser) return;

        try {
            await supabase
                .from("chat_presence")
                .upsert(
                    {
                        user_id:
                            currentUser.id,

                        status,

                        last_seen_at:
                            new Date().toISOString(),

                        last_active_at:
                            new Date().toISOString(),

                        current_community_id:
                            currentCommunity
                                ?.id ||
                            null,

                        current_channel_id:
                            currentChannel
                                ?.id ||
                            null,

                        updated_at:
                            new Date().toISOString()
                    },
                    {
                        onConflict:
                            "user_id"
                    }
                );
        } catch (error) {
            console.warn(
                "Presence update failed:",
                error
            );
        }
    }

    /* ========================================================
       COMPOSER
       ======================================================== */

    function updateComposerState() {
        if (!DOM.messageInput) {
            return;
        }

        const restricted =
            isCurrentUserRestricted();

        DOM.messageInput.disabled =
            restricted ||
            !currentChannel;

        if (DOM.sendMessageButton) {
            DOM.sendMessageButton.disabled =
                restricted ||
                !currentChannel;
        }
    }

    function isCurrentUserRestricted() {
        const member =
            members.find(
                item =>
                    item.user_id ===
                    currentUser?.id
            );

        if (!member) {
            return false;
        }

        return (
            member.is_banned === true ||
            member.is_muted === true
        );
    }

    /* ========================================================
       GENERAL CALL BUTTON
       ======================================================== */

    function setupCallButtons() {
        DOM.generalCallButton
            ?.addEventListener(
                "click",
                () =>
                    dispatchGeneralCall(
                        "audio"
                    )
            );

        /*
         * These optional buttons can exist in
         * community.html.
         */

        document
            .querySelectorAll(
                "[data-community-call]"
            )
            .forEach(
                button => {
                    button.addEventListener(
                        "click",
                        () => {
                            dispatchCommunityCall(
                                button.dataset
                                    .communityCall ||
                                    "audio"
                            );
                        }
                    );
                }
            );
    }

    /* ========================================================
       MODALS
       ======================================================== */

    function openCommunityModal() {
        DOM.communityModal?.classList.add(
            "open"
        );

        if (DOM.communityModal) {
            DOM.communityModal.hidden =
                false;
        }
    }

    function closeCommunityModal() {
        if (!DOM.communityModal) {
            return;
        }

        DOM.communityModal.classList.remove(
            "open"
        );

        setTimeout(() => {
            DOM.communityModal.hidden =
                true;
        }, 150);
    }

    /* ========================================================
       EVENTS
       ======================================================== */

    function setupEvents() {
        DOM.acceptRulesButton
            ?.addEventListener(
                "click",
                acceptRules
            );

        DOM.attachButton
            ?.addEventListener(
                "click",
                openAttachmentPicker
            );

        DOM.voiceNoteButton
            ?.addEventListener(
                "click",
                toggleVoiceRecording
            );

        DOM.stopVoiceRecordingButton
            ?.addEventListener(
                "click",
                stopVoiceRecording
            );

        DOM.cancelVoiceRecordingButton
            ?.addEventListener(
                "click",
                () => {
                    if (
                        voiceRecorder &&
                        voiceRecorder.state !==
                            "inactive"
                    ) {
                        voiceRecorder.stop();
                    }

                    voiceChunks = [];
                    voiceRecording = false;

                    DOM.voiceRecorderBar?.classList.remove(
                        "recording"
                    );
                }
            );

        DOM.gifButton
            ?.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    toggleGifPicker();
                }
            );

        DOM.messageForm
            ?.addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    sendMessage();
                }
            );

        DOM.sendMessageButton
            ?.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    sendMessage();
                }
            );

        DOM.messageInput
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

        DOM.memberSearch
            ?.addEventListener(
                "input",
                event => {
                    renderMembers(
                        event.target.value
                    );
                }
            );

        DOM.communityModalClose
            ?.addEventListener(
                "click",
                closeCommunityModal
            );

        DOM.communityRail
            ?.addEventListener(
                "dblclick",
                openCommunityModal
            );

        setupEmojiPicker();
        setupCallButtons();

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                closeCommunityModal();

                if (
                    DOM.emojiPicker
                ) {
                    DOM.emojiPicker.hidden =
                        true;

                    DOM.emojiPicker.classList.remove(
                        "open"
                    );
                }

                if (
                    DOM.gifPicker
                ) {
                    DOM.gifPicker.hidden =
                        true;

                    DOM.gifPicker.classList.remove(
                        "open"
                    );
                }
            }
        );

        window.addEventListener(
            "beforeunload",
            () => {
                updatePresence(
                    "offline"
                );
            }
        );

        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    document.hidden
                ) {
                    updatePresence(
                        "idle"
                    );
                } else {
                    updatePresence(
                        "online"
                    );
                }
            }
        );
    }

    /* ========================================================
       INITIALIZATION
       ======================================================== */

    async function initialize() {
        try {
            cacheDOM();

            setupEvents();

            const ready =
                await initializeSupabase();

            if (!ready) {
                return;
            }

            await loadCurrentProfile();

            await loadCommunities();

            await updatePresence(
                "online"
            );

            console.log(
                "✅ Community loaded successfully."
            );

        } catch (error) {
            console.error(
                "❌ Community initialization failed:",
                error
            );

            showMessage(
                "Community could not be initialized."
            );
        }
    }

    /* ========================================================
       UTILITIES
       ======================================================== */

    function sleep(ms) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    }

    function scrollMessagesToBottom() {
        const container =
            DOM.messageList;

        if (!container) return;

        container.scrollTop =
            container.scrollHeight;
    }

    function clearMessages() {
        messages = [];

        if (DOM.messageList) {
            DOM.messageList.innerHTML = `
                <div class="empty-community-state">
                    <div>💬</div>

                    <strong>
                        Select a channel
                    </strong>

                    <span>
                        Choose a channel to start chatting.
                    </span>
                </div>
            `;
        }
    }

    function insertAtCursor(
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

        input.selectionStart =
            input.selectionEnd =
                start + text.length;

        input.focus();
    }

    function initials(name) {
        const parts =
            String(name || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {
            return "MS";
        }

        if (
            parts.length ===
            1
        ) {
            return parts[0]
                .slice(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[
                parts.length - 1
            ][0]
        ).toUpperCase();
    }

    function formatTime(
        value
    ) {
        if (!value) return "";

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

    function formatMessageContent(
        value
    ) {
        return escapeHtml(
            value || ""
        )
            .replace(
                /\n/g,
                "<br>"
            )
            .replace(
                /(https?:\/\/[^\s<]+)/g,
                '<a href="$1" target="_blank" rel="noopener">$1</a>'
            );
    }

    function sanitizeFileName(
        value
    ) {
        return String(
            value || "file"
        )
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            )
            .slice(
                0,
                180
            );
    }

    function escapeHtml(
        value
    ) {
        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }

    function escapeAttribute(
        value
    ) {
        return escapeHtml(value);
    }

    function friendlySupabaseError(
        error
    ) {
        if (!error) {
            return "Something went wrong.";
        }

        if (
            error.code ===
            "42501"
        ) {
            return "You do not have permission to perform that action.";
        }

        if (
            error.code ===
            "23505"
        ) {
            return "That action already exists.";
        }

        return (
            error.message ||
            "Something went wrong."
        );
    }

    function showMessage(
        message
    ) {
        console.info(
            "Mwaniki Community:",
            message
        );

        if (
            typeof window.showNotification ===
            "function"
        ) {
            window.showNotification(
                message
            );

            return;
        }

        /*
         * Avoid blocking the interface with
         * alert() for normal messages.
         */

        let notice =
            document.getElementById(
                "mwanikiCommunityNotice"
            );

        if (!notice) {
            notice =
                document.createElement(
                    "div"
                );

            notice.id =
                "mwanikiCommunityNotice";

            notice.className =
                "mwaniki-community-notice";

            document.body.appendChild(
                notice
            );
        }

        notice.textContent =
            message;

        notice.classList.add(
            "show"
        );

        clearTimeout(
            notice._timer
        );

        notice._timer =
            setTimeout(
                () => {
                    notice.classList.remove(
                        "show"
                    );
                },
                3500
            );
    }

    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.MwanikiCommunity = {
        get currentCommunity() {
            return currentCommunity;
        },

        get currentChannel() {
            return currentChannel;
        },

        get members() {
            return members;
        },

        selectCommunity,

        selectChannel,

        loadCommunities,

        loadCommunityMembers,

        sendMessage,

        deleteMessage,

        dispatchCall,

        dispatchCommunityCall,

        dispatchGeneralCall,

        openPrivateChat,

        sendFriendRequest
    };

    /* ========================================================
       START
       ======================================================== */

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
