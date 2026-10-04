import { supabase } from "./supabase.js";

(() => {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {
        user: null,
        profile: null,

        communities: [],
        currentCommunity: null,
        currentCommunityId: null,

        channels: [],
        currentChannel: null,
        currentChannelId: null,

        members: [],

        messageSubscription: null,

        selectedFiles: [],

        rulesCommunity: null,

        callPickerMode: "specific",

        voice: {
            recorder: null,
            stream: null,
            chunks: [],
            blob: null,
            url: null,
            timer: null,
            startedAt: null,
            audioContext: null,
            analyser: null,
            animation: null
        }
    };


    /* =====================================================
       DOM
       ===================================================== */

    const $ = id => document.getElementById(id);


    /* =====================================================
       HELPERS
       ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function safeUrl(value) {

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


    function showNotice(message) {

        const toast = $("toast");

        if (!toast) return;

        toast.textContent = message;
        toast.classList.remove("hidden");

        clearTimeout(showNotice.timer);

        showNotice.timer = setTimeout(() => {
            toast.classList.add("hidden");
        }, 3200);
    }


    function openModal(id) {

        $(id)?.classList.remove("hidden");
    }


    function closeModal(id) {

        $(id)?.classList.add("hidden");
    }


    function formatDate(value) {

        if (!value) return "";

        const date = new Date(value);

        return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }


    function formatTime(value) {

        if (!value) return "";

        return new Date(value).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }


    function getInitials(name) {

        const parts = String(name || "User")
            .trim()
            .split(/\s+/)
            .slice(0, 2);

        return parts
            .map(part => part[0]?.toUpperCase() || "")
            .join("") || "U";
    }


    function avatarHTML(profile, className = "avatar avatar-small") {

        const avatar = safeUrl(profile?.avatar_url);

        if (avatar) {

            return `
                <span class="${className}">
                    <img
                        src="${escapeHTML(avatar)}"
                        alt=""
                    >
                </span>
            `;
        }

        return `
            <span class="${className}">
                ${escapeHTML(
                    getInitials(
                        profile?.display_name ||
                        profile?.full_name ||
                        "User"
                    )
                )}
            </span>
        `;
    }


    function iconHTML(iconUrl, fallback = "🎓") {

        const url = safeUrl(iconUrl);

        if (url) {

            return `
                <span class="community-rail-icon">
                    <img
                        src="${escapeHTML(url)}"
                        alt=""
                    >
                </span>
            `;
        }

        return `
            <span class="community-rail-icon">
                <span class="community-rail-icon-fallback">
                    ${fallback}
                </span>
            </span>
        `;
    }


    function communityFallback(community) {

        const slug = String(
            community?.slug || ""
        ).toLowerCase();

        if (slug.includes("gaming")) return "🎮";
        if (slug.includes("meme")) return "😂";
        if (slug.includes("medical")) return "🩺";

        return "🎓";
    }


    /* =====================================================
       AUTH
       ===================================================== */

    async function loadSession() {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) throw error;

        state.user = data.session?.user || null;

        if (!state.user) {

            window.location.href = "./index.html";
            return false;
        }

        return true;
    }


    async function loadProfile() {

        const { data } = await supabase
            .from("chat_public_profiles")
            .select("*")
            .eq("id", state.user.id)
            .maybeSingle();

        state.profile = data || {
            id: state.user.id,
            display_name:
                state.user.email?.split("@")[0] ||
                "Student"
        };

        $("headerProfileName").textContent =
            state.profile.display_name ||
            state.profile.full_name ||
            "Student";

        const avatar = safeUrl(
            state.profile.avatar_url
        );

        if (avatar) {

            $("headerProfileAvatar").innerHTML = `
                <img
                    src="${escapeHTML(avatar)}"
                    alt=""
                >
            `;
        }
    }


    /* =====================================================
       COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        const {
            data,
            error
        } = await supabase
            .from("chat_communities")
            .select("*")
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) throw error;

        state.communities = data || [];

        renderCommunityRail();

        if (!state.currentCommunityId && state.communities.length) {

            await selectCommunity(
                state.communities[0].id
            );
        }
    }


    function renderCommunityRail() {

        const rail = $("communityRailList");

        rail.innerHTML = "";

        for (const community of state.communities) {

            const button = document.createElement("button");

            button.type = "button";

            button.className =
                "community-rail-button" +
                (
                    community.id === state.currentCommunityId
                        ? " active"
                        : ""
                );

            button.title = community.name;

            button.innerHTML =
                iconHTML(
                    community.icon_url,
                    communityFallback(community)
                );

            button.addEventListener(
                "click",
                () => selectCommunity(community.id)
            );

            rail.appendChild(button);
        }
    }


    async function selectCommunity(communityId) {

        const community =
            state.communities.find(
                item => item.id === communityId
            );

        if (!community) return;

        state.currentCommunity = community;
        state.currentCommunityId = community.id;

        renderCommunityRail();

        await ensureCommunityAccess();
    }


    /* =====================================================
       RULES / MEMBERSHIP
       ===================================================== */

    async function ensureCommunityAccess() {

        const community = state.currentCommunity;

        if (!community) return;

        const {
            data: membership,
            error
        } = await supabase
            .from("chat_community_members")
            .select("id,user_id,role")
            .eq("community_id", community.id)
            .eq("user_id", state.user.id)
            .maybeSingle();

        if (error) {

            console.warn(
                "Membership lookup:",
                error
            );
        }

        const { data: agreement } =
            await supabase
                .from("chat_community_rule_acceptances")
                .select("id,agreed_at")
                .eq(
                    "community_id",
                    community.id
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .maybeSingle();

        if (!agreement) {

            state.rulesCommunity = community;

            await renderRules(
                community,
                Boolean(membership)
            );

            openModal("rulesModal");

            return;
        }

        await activateCommunity();
    }


    async function renderRules(
        community,
        alreadyMember
    ) {

        $("rulesCommunityName").textContent =
            community.name;

        $("rulesCommunityIcon").textContent =
            communityFallback(community);

        $("rulesContent").textContent =
            community.rules ||
            `Welcome to ${community.name}.

1. Respect other members.
2. Keep discussions academic and constructive.
3. Do not spam.
4. Do not impersonate other members.
5. Respect moderators and community decisions.
6. Keep personal information private.
7. Use the correct channels.
8. Report harmful or inappropriate content.
9. Do not disrupt calls, events or study sessions.
10. Follow Mwaniki Scholars platform rules.`;

        $("rulesAgreementCheckbox").checked = false;

        $("agreeRulesButton").disabled = true;

        $("agreeRulesButton").dataset.alreadyMember =
            alreadyMember
                ? "true"
                : "false";
    }


    async function agreeToRules() {

        const community =
            state.rulesCommunity;

        if (!community) return;

        if (!$("rulesAgreementCheckbox").checked) {

            showNotice(
                "Please read and agree to the rules first."
            );

            return;
        }

        const {
            error: agreementError
        } = await supabase
            .from("chat_community_rule_acceptances")
            .upsert({
                community_id: community.id,
                user_id: state.user.id,
                agreed_at:
                    new Date().toISOString()
            }, {
                onConflict:
                    "community_id,user_id"
            });

        if (agreementError) {

            console.error(agreementError);

            showNotice(
                "Could not save your rules agreement."
            );

            return;
        }


        const alreadyMember =
            $("agreeRulesButton")
                .dataset
                .alreadyMember === "true";

        if (!alreadyMember) {

            const {
                error: joinError
            } = await supabase
                .from("chat_community_members")
                .insert({
                    community_id: community.id,
                    user_id: state.user.id,
                    role: "Student"
                });

            if (
                joinError &&
                !String(joinError.message)
                    .toLowerCase()
                    .includes("duplicate")
            ) {

                console.error(joinError);

                showNotice(
                    "Rules accepted, but joining the community failed."
                );

                return;
            }
        }

        closeModal("rulesModal");

        await activateCommunity();
    }


    async function activateCommunity() {

        const community =
            state.currentCommunity;

        $("selectedCommunityName").textContent =
            community.name;

        $("selectedCommunityDescription").textContent =
            community.description ||
            "Community";

        const url = safeUrl(
            community.icon_url
        );

        if (url) {

            $("selectedCommunityIcon").innerHTML = `
                <img
                    src="${escapeHTML(url)}"
                    alt=""
                >
            `;

        } else {

            $("selectedCommunityIcon").textContent =
                communityFallback(community);
        }

        await loadChannels();
        await loadMembers();
        await loadEvents();
    }


    /* =====================================================
       CHANNELS
       ===================================================== */

    async function loadChannels() {

        const {
            data,
            error
        } = await supabase
            .from("chat_channels")
            .select("*")
            .eq(
                "community_id",
                state.currentCommunityId
            )
            .eq("is_active", true)
            .eq("is_archived", false)
            .order("position", {
                ascending: true
            });

        if (error) {

            console.error(error);

            showNotice(
                "Could not load community channels."
            );

            return;
        }

        state.channels = data || [];

        renderChannels();

        if (
            !state.currentChannelId &&
            state.channels.length
        ) {

            await openChannel(
                state.channels[0]
            );
        }
    }


    function classifyChannel(channel) {

        const text = (
            `${channel.name || ""} ${channel.slug || ""}`
        ).toLowerCase();

        if (
            channel.course_id != null
        ) {
            return "courses";
        }

        if (
            text.includes("rule") ||
            text.includes("welcome") ||
            text.includes("announcement") ||
            text.includes("changelog") ||
            text.includes("information")
        ) {
            return "information";
        }

        return "community";
    }


    function channelButton(channel) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "channel-button" +
            (
                channel.id === state.currentChannelId
                    ? " active"
                    : ""
            );

        const isVoice =
            String(channel.channel_type || "")
                .toLowerCase()
                .includes("voice");

        button.innerHTML = `
            <span>
                ${
                    isVoice
                        ? "🔊"
                        : channel.course_id != null
                            ? "📚"
                            : "#"
                }
            </span>

            <span>
                ${escapeHTML(channel.name)}
            </span>
        `;

        button.addEventListener(
            "click",
            () => openChannel(channel)
        );

        return button;
    }


    function renderChannels() {

        $("informationChannels").innerHTML = "";
        $("courseChannels").innerHTML = "";
        $("communityChannels").innerHTML = "";

        const buckets = {
            information: $("informationChannels"),
            courses: $("courseChannels"),
            community: $("communityChannels")
        };

        for (const channel of state.channels) {

            const type =
                classifyChannel(channel);

            buckets[type]
                .appendChild(
                    channelButton(channel)
                );
        }
    }


    async function openChannel(channel) {

        if (!channel) return;

        state.currentChannel = channel;
        state.currentChannelId = channel.id;

        renderChannels();

        $("currentChannelIcon").textContent =
            channel.course_id != null
                ? "📚"
                : "#";

        $("currentChannelName").textContent =
            channel.name;

        $("currentChannelDescription").textContent =
            channel.description ||
            "Community channel";

        await loadMessages();

        subscribeToMessages();
    }


    /* =====================================================
       MESSAGES
       ===================================================== */

    async function loadMessages() {

        if (!state.currentChannelId) return;

        $("messageLoading")
            .classList
            .remove("hidden");

        const {
            data: messages,
            error
        } = await supabase
            .from("chat_messages")
            .select("*")
            .eq(
                "channel_id",
                state.currentChannelId
            )
            .order("created_at", {
                ascending: true
            })
            .limit(300);

        if (error) {

            console.error(error);

            $("messageLoading")
                .classList
                .add("hidden");

            return;
        }

        const userIds = [
            ...new Set(
                (messages || [])
                    .map(message => message.user_id)
            )
        ];

        const profiles = {};

        if (userIds.length) {

            const {
                data: profileRows
            } = await supabase
                .from("chat_public_profiles")
                .select("*")
                .in("id", userIds);

            for (const profile of profileRows || []) {
                profiles[profile.id] = profile;
            }
        }


        const messageIds =
            (messages || []).map(
                message => message.id
            );

        const attachmentsByMessage = {};

        if (messageIds.length) {

            const {
                data: attachments
            } = await supabase
                .from("chat_attachments")
                .select("*")
                .in(
                    "message_id",
                    messageIds
                );

            for (const attachment of attachments || []) {

                if (
                    !attachmentsByMessage[
                        attachment.message_id
                    ]
                ) {
                    attachmentsByMessage[
                        attachment.message_id
                    ] = [];
                }

                attachmentsByMessage[
                    attachment.message_id
                ].push(attachment);
            }
        }


        const reactionsByMessage = {};

        if (messageIds.length) {

            const {
                data: reactions
            } = await supabase
                .from("chat_message_reactions")
                .select("*")
                .in(
                    "message_id",
                    messageIds
                );

            for (const reaction of reactions || []) {

                if (
                    !reactionsByMessage[
                        reaction.message_id
                    ]
                ) {
                    reactionsByMessage[
                        reaction.message_id
                    ] = [];
                }

                reactionsByMessage[
                    reaction.message_id
                ].push(reaction);
            }
        }


        renderMessages(
            messages || [],
            profiles,
            attachmentsByMessage,
            reactionsByMessage
        );

        $("messageLoading")
            .classList
            .add("hidden");
    }


    function renderMessages(
        messages,
        profiles,
        attachmentsByMessage,
        reactionsByMessage
    ) {

        const list = $("messageList");

        list.innerHTML = "";

        for (const message of messages) {

            const profile =
                profiles[message.user_id] || {
                    display_name:
                        message.user_id === state.user.id
                            ? state.profile?.display_name
                            : "Member"
                };

            const wrapper =
                document.createElement("article");

            wrapper.className = "message";

            const deleted =
                Boolean(message.is_deleted);

            const name =
                profile.display_name ||
                profile.full_name ||
                "Member";

            const own =
                message.user_id === state.user.id;

            const content =
                deleted
                    ? "Message deleted"
                    : message.content || "";

            wrapper.innerHTML = `
                <div class="message-avatar">
                    ${
                        avatarHTML(
                            profile,
                            "avatar"
                        )
                    }
                </div>

                <div class="message-body">

                    <div class="message-meta">

                        <span class="message-author">
                            ${escapeHTML(name)}
                        </span>

                        <span class="message-time">
                            ${formatTime(message.created_at)}
                        </span>

                    </div>

                    <div class="
                        message-content
                        ${deleted ? "deleted-message" : ""}
                    ">
                        ${escapeHTML(content)}
                    </div>

                    <div class="message-attachment-area"></div>

                    <div class="message-reactions"></div>

                    ${
                        deleted
                            ? ""
                            : `
                                <div class="message-actions">

                                    <button
                                        class="message-action react-message"
                                        type="button"
                                    >
                                        😊 React
                                    </button>

                                    ${
                                        own
                                            ? `
                                                <button
                                                    class="message-action delete-message"
                                                    type="button"
                                                >
                                                    Delete
                                                </button>
                                            `
                                            : ""
                                    }

                                </div>
                            `
                    }

                </div>
            `;


            const attachmentArea =
                wrapper.querySelector(
                    ".message-attachment-area"
                );

            for (
                const attachment of
                attachmentsByMessage[
                    message.id
                ] || []
            ) {

                renderAttachment(
                    attachmentArea,
                    attachment
                );
            }


            renderReactions(
                wrapper.querySelector(
                    ".message-reactions"
                ),
                message.id,
                reactionsByMessage[
                    message.id
                ] || []
            );


            const reactButton =
                wrapper.querySelector(
                    ".react-message"
                );

            if (reactButton) {

                reactButton.addEventListener(
                    "click",
                    () => openReactionPicker(
                        message.id,
                        reactButton
                    )
                );
            }


            const deleteButton =
                wrapper.querySelector(
                    ".delete-message"
                );

            if (deleteButton) {

                deleteButton.addEventListener(
                    "click",
                    () => deleteMessage(
                        message
                    )
                );
            }

            list.appendChild(wrapper);
        }

        list.scrollTop =
            list.scrollHeight;
    }


    function renderAttachment(
        container,
        attachment
    ) {

        const url =
            safeUrl(attachment.file_url);

        if (!url) return;

        const mime =
            String(
                attachment.mime_type || ""
            ).toLowerCase();

        const item =
            document.createElement("div");

        item.className =
            "message-attachment";


        if (mime.startsWith("image/")) {

            item.innerHTML = `
                <a
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener"
                >
                    <img
                        src="${escapeHTML(url)}"
                        alt="${escapeHTML(
                            attachment.file_name
                        )}"
                    >
                </a>
            `;

        } else if (mime.startsWith("audio/")) {

            item.innerHTML = `
                <audio
                    controls
                    preload="metadata"
                    src="${escapeHTML(url)}"
                ></audio>
            `;

        } else {

            item.innerHTML = `
                <a
                    class="file-card"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener"
                >
                    <strong>📄</strong>

                    <span>
                        ${escapeHTML(
                            attachment.file_name
                        )}
                    </span>
                </a>
            `;
        }

        container.appendChild(item);
    }


    /* =====================================================
       REACTIONS
       ===================================================== */

    function renderReactions(
        container,
        messageId,
        reactions
    ) {

        container.innerHTML = "";

        const grouped = {};

        for (const reaction of reactions) {

            if (!grouped[reaction.reaction]) {

                grouped[reaction.reaction] = {
                    count: 0,
                    mine: false
                };
            }

            grouped[
                reaction.reaction
            ].count++;

            if (
                reaction.user_id ===
                state.user.id
            ) {
                grouped[
                    reaction.reaction
                ].mine = true;
            }
        }


        for (const [
            emoji,
            value
        ] of Object.entries(grouped)) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "reaction-button" +
                (
                    value.mine
                        ? " active"
                        : ""
                );

            button.textContent =
                `${emoji} ${value.count}`;

            button.addEventListener(
                "click",
                () => toggleReaction(
                    messageId,
                    emoji
                )
            );

            container.appendChild(button);
        }
    }


    function openReactionPicker(
        messageId,
        anchor
    ) {

        const existing =
            document.querySelector(
                ".reaction-picker"
            );

        existing?.remove();

        const picker =
            document.createElement("div");

        picker.className =
            "reaction-picker";

        picker.style.position = "fixed";

        const rect =
            anchor.getBoundingClientRect();

        picker.style.left =
            `${Math.min(
                rect.left,
                window.innerWidth - 250
            )}px`;

        picker.style.top =
            `${Math.max(
                10,
                rect.top - 48
            )}px`;

        picker.style.zIndex = "600";

        picker.style.padding = "7px";

        picker.style.border =
            "1px solid rgba(255,255,255,.1)";

        picker.style.borderRadius = "10px";

        picker.style.background =
            "#151d26";

        picker.style.boxShadow =
            "0 15px 40px rgba(0,0,0,.35)";

        const emojis = [
            "👍",
            "❤️",
            "😂",
            "😮",
            "😢",
            "🔥",
            "👏",
            "🎉",
            "💯",
            "🩺"
        ];

        for (const emoji of emojis) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.textContent = emoji;

            button.style.background =
                "transparent";

            button.style.color = "white";

            button.style.fontSize = "19px";

            button.style.padding = "5px";

            button.addEventListener(
                "click",
                async () => {

                    picker.remove();

                    await toggleReaction(
                        messageId,
                        emoji
                    );
                }
            );

            picker.appendChild(button);
        }

        document.body.appendChild(picker);


        setTimeout(() => {

            const close =
                event => {

                    if (
                        !picker.contains(
                            event.target
                        )
                    ) {

                        picker.remove();

                        document.removeEventListener(
                            "click",
                            close
                        );
                    }
                };

            document.addEventListener(
                "click",
                close
            );

        }, 0);
    }


    async function toggleReaction(
        messageId,
        reaction
    ) {

        const {
            data: existing
        } = await supabase
            .from("chat_message_reactions")
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

        let error = null;

        if (existing) {

            ({
                error
            } = await supabase
                .from("chat_message_reactions")
                .delete()
                .eq("id", existing.id));

        } else {

            ({
                error
            } = await supabase
                .from("chat_message_reactions")
                .insert({
                    message_id: messageId,
                    user_id: state.user.id,
                    reaction
                }));
        }

        if (error) {

            console.error(error);

            showNotice(
                "Reaction could not be saved."
            );

            return;
        }

        await loadMessages();
    }


    /* =====================================================
       DELETE MESSAGE
       ===================================================== */

    async function deleteMessage(message) {

        if (
            message.user_id !==
            state.user.id
        ) {
            return;
        }

        if (
            !confirm(
                "Delete this message?"
            )
        ) {
            return;
        }

        const {
            error
        } = await supabase
            .from("chat_messages")
            .update({
                is_deleted: true,
                deleted_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                message.id
            )
            .eq(
                "user_id",
                state.user.id
            );

        if (error) {

            console.error(error);

            showNotice(
                "Message could not be deleted."
            );

            return;
        }

        showNotice(
            "Message deleted."
        );

        await loadMessages();
    }


    /* =====================================================
       TEXT MESSAGE
       ===================================================== */

    async function sendTextMessage() {

        const input =
            $("messageInput");

        const content =
            input.value.trim();

        if (!content) return;

        if (!state.currentChannelId) {

            showNotice(
                "Select a channel first."
            );

            return;
        }

        const {
            error
        } = await supabase
            .from("chat_messages")
            .insert({
                channel_id:
                    state.currentChannelId,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text"
            });

        if (error) {

            console.error(error);

            showNotice(
                error.message ||
                "Message could not be sent."
            );

            return;
        }

        input.value = "";

        resizeTextarea();

        await loadMessages();
    }


    /* =====================================================
       FILE ATTACHMENTS
       ===================================================== */

    function handleSelectedFiles(
        files
    ) {

        state.selectedFiles =
            Array.from(files || []);

        const preview =
            $("attachmentPreview");

        preview.innerHTML = "";

        if (!state.selectedFiles.length) {

            preview.classList.add("hidden");

            return;
        }

        preview.classList.remove("hidden");

        for (const file of state.selectedFiles) {

            const item =
                document.createElement("div");

            item.className =
                "preview-file";

            item.textContent =
                `${file.name} (${Math.round(
                    file.size / 1024
                )} KB)`;

            preview.appendChild(item);
        }

        openModal("filePreviewModal");
    }


    async function uploadAttachments() {

        if (!state.currentChannelId) {

            showNotice(
                "Select a channel first."
            );

            return;
        }

        for (const file of state.selectedFiles) {

            await uploadSingleAttachment(file);
        }

        state.selectedFiles = [];

        $("attachmentInput").value = "";

        $("attachmentPreview")
            .classList
            .add("hidden");

        $("attachmentPreview").innerHTML = "";

        closeModal("filePreviewModal");

        await loadMessages();
    }


    async function uploadSingleAttachment(
        file
    ) {

        const safeName =
            file.name
                .replace(/[^a-zA-Z0-9._-]/g, "_");

        const path =
            `${state.user.id}/chat/${Date.now()}-${safeName}`;


        /*
         * IMPORTANT:
         * MESSAGE FIRST.
         * ATTACHMENT SECOND.
         */

        const {
            data: message,
            error: messageError
        } = await supabase
            .from("chat_messages")
            .insert({
                channel_id:
                    state.currentChannelId,

                user_id:
                    state.user.id,

                content:
                    `📎 ${file.name}`,

                message_type:
                    "file"
            })
            .select()
            .single();

        if (messageError) {

            throw messageError;
        }


        const {
            error: uploadError
        } = await supabase
            .storage
            .from("chat-attachments")
            .upload(
                path,
                file,
                {
                    contentType:
                        file.type ||
                        "application/octet-stream",

                    upsert: false
                }
            );

        if (uploadError) {

            await supabase
                .from("chat_messages")
                .update({
                    is_deleted: true,
                    deleted_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    message.id
                );

            throw uploadError;
        }


        const {
            data: publicData
        } = supabase
            .storage
            .from("chat-attachments")
            .getPublicUrl(path);


        const {
            error: attachmentError
        } = await supabase
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
                    publicData.publicUrl,

                mime_type:
                    file.type ||
                    "application/octet-stream",

                file_size:
                    file.size
            });


        if (attachmentError) {

            await supabase
                .storage
                .from("chat-attachments")
                .remove([path]);

            await supabase
                .from("chat_messages")
                .update({
                    is_deleted: true,
                    deleted_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    message.id
                );

            throw attachmentError;
        }
    }


    /* =====================================================
       VOICE NOTES
       ===================================================== */

    function supportedMimeType() {

        const types = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/mp4"
        ];

        return types.find(
            type =>
                MediaRecorder.isTypeSupported(type)
        ) || "";
    }


    async function startVoiceRecording() {

        if (!state.currentChannelId) {

            showNotice(
                "Select a channel first."
            );

            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {

            showNotice(
                "Your browser does not support microphone access."
            );

            return;
        }

        try {

            state.voice.stream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });


            const mime =
                supportedMimeType();

            state.voice.recorder =
                new MediaRecorder(
                    state.voice.stream,
                    mime
                        ? {
                            mimeType: mime
                        }
                        : undefined
                );


            state.voice.chunks = [];

            state.voice.recorder.ondataavailable =
                event => {

                    if (event.data?.size) {

                        state.voice.chunks.push(
                            event.data
                        );
                    }
                };


            state.voice.recorder.onstop =
                finishVoiceRecording;


            state.voice.recorder.start(
                250
            );

            state.voice.startedAt =
                Date.now();

            state.voice.timer =
                setInterval(
                    updateVoiceTimer,
                    250
                );


            $("voiceRecorder")
                .classList
                .remove("hidden");

            $("sendVoiceButton")
                .classList
                .add("hidden");

            $("stopVoiceButton")
                .classList
                .remove("hidden");

            startWaveform();

        } catch (error) {

            console.error(error);

            showNotice(
                "Microphone permission was not granted."
            );
        }
    }


    function updateVoiceTimer() {

        if (!state.voice.startedAt) return;

        const seconds =
            Math.floor(
                (
                    Date.now() -
                    state.voice.startedAt
                ) / 1000
            );

        const minutes =
            Math.floor(seconds / 60);

        const remainder =
            seconds % 60;

        $("voiceRecordingTimer")
            .textContent =
            `${String(minutes).padStart(2, "0")}:${String(
                remainder
            ).padStart(2, "0")}`;
    }


    function stopVoiceRecording() {

        if (
            state.voice.recorder &&
            state.voice.recorder.state !== "inactive"
        ) {

            state.voice.recorder.stop();
        }
    }


    async function finishVoiceRecording() {

        clearInterval(
            state.voice.timer
        );

        stopWaveform();

        state.voice.stream
            ?.getTracks()
            .forEach(track => track.stop());

        const type =
            state.voice.recorder?.mimeType ||
            "audio/webm";

        state.voice.blob =
            new Blob(
                state.voice.chunks,
                {
                    type
                }
            );

        state.voice.url =
            URL.createObjectURL(
                state.voice.blob
            );

        $("voicePreviewAudio").src =
            state.voice.url;

        $("voicePreviewAudio")
            .classList
            .remove("hidden");

        $("stopVoiceButton")
            .classList
            .add("hidden");

        $("sendVoiceButton")
            .classList
            .remove("hidden");
    }


    function cancelVoiceRecording() {

        if (
            state.voice.recorder &&
            state.voice.recorder.state !==
            "inactive"
        ) {

            state.voice.recorder.onstop =
                null;

            state.voice.recorder.stop();
        }

        state.voice.stream
            ?.getTracks()
            .forEach(track => track.stop());

        clearInterval(
            state.voice.timer
        );

        stopWaveform();

        if (state.voice.url) {

            URL.revokeObjectURL(
                state.voice.url
            );
        }

        state.voice = {
            recorder: null,
            stream: null,
            chunks: [],
            blob: null,
            url: null,
            timer: null,
            startedAt: null,
            audioContext: null,
            analyser: null,
            animation: null
        };

        $("voiceRecorder")
            .classList
            .add("hidden");

        $("voicePreviewAudio")
            .classList
            .add("hidden");

        $("voicePreviewAudio").src = "";
    }


    async function sendVoiceNote() {

        const blob =
            state.voice.blob;

        if (!blob) {

            showNotice(
                "Record a voice note first."
            );

            return;
        }


        try {

            /*
             * STEP 1:
             * Create message first.
             */

            const {
                data: message,
                error: messageError
            } = await supabase
                .from("chat_messages")
                .insert({
                    channel_id:
                        state.currentChannelId,

                    user_id:
                        state.user.id,

                    content:
                        "🎙️ Voice note",

                    message_type:
                        "voice"
                })
                .select()
                .single();


            if (messageError) {

                throw messageError;
            }


            /*
             * STEP 2:
             * Upload audio.
             */

            const extension =
                blob.type.includes("ogg")
                    ? "ogg"
                    : "webm";

            const path =
                `${state.user.id}/voice/${Date.now()}-voice.${extension}`;


            const {
                error: uploadError
            } = await supabase
                .storage
                .from("chat-attachments")
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

                await supabase
                    .from("chat_messages")
                    .update({
                        is_deleted: true,
                        deleted_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        message.id
                    );

                throw uploadError;
            }


            /*
             * STEP 3:
             * Attachment AFTER message exists.
             */

            const {
                data: publicData
            } = supabase
                .storage
                .from("chat-attachments")
                .getPublicUrl(path);


            const {
                error: attachmentError
            } = await supabase
                .from("chat_attachments")
                .insert({
                    message_id:
                        message.id,

                    uploaded_by:
                        state.user.id,

                    file_name:
                        `voice-note.${extension}`,

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

                await supabase
                    .storage
                    .from("chat-attachments")
                    .remove([path]);

                await supabase
                    .from("chat_messages")
                    .update({
                        is_deleted: true,
                        deleted_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        message.id
                    );

                throw attachmentError;
            }


            cancelVoiceRecording();

            showNotice(
                "Voice note sent."
            );

            await loadMessages();

        } catch (error) {

            console.error(
                "Voice note:",
                error
            );

            showNotice(
                error.message ||
                "Voice note could not be sent."
            );
        }
    }


    function startWaveform() {

        const canvas =
            $("voiceWaveform");

        const context =
            canvas.getContext("2d");

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        state.voice.audioContext =
            new AudioContext();

        state.voice.analyser =
            state.voice.audioContext
                .createAnalyser();

        state.voice.analyser.fftSize =
            256;

        const source =
            state.voice.audioContext
                .createMediaStreamSource(
                    state.voice.stream
                );

        source.connect(
            state.voice.analyser
        );

        const data =
            new Uint8Array(
                state.voice.analyser.frequencyBinCount
            );


        const draw = () => {

            if (
                !state.voice.analyser
            ) {
                return;
            }

            state.voice.animation =
                requestAnimationFrame(draw);

            state.voice.analyser
                .getByteFrequencyData(data);

            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

            const width =
                canvas.width /
                data.length;

            for (
                let i = 0;
                i < data.length;
                i++
            ) {

                const value =
                    data[i] / 255;

                const height =
                    Math.max(
                        3,
                        value * canvas.height
                    );

                context.fillStyle =
                    "#087f73";

                context.fillRect(
                    i * width,
                    (
                        canvas.height -
                        height
                    ) / 2,
                    Math.max(
                        1,
                        width - 1
                    ),
                    height
                );
            }
        };

        draw();
    }


    function stopWaveform() {

        if (state.voice.animation) {

            cancelAnimationFrame(
                state.voice.animation
            );
        }

        state.voice.animation = null;

        state.voice.audioContext
            ?.close()
            .catch(() => {});

        state.voice.audioContext = null;
        state.voice.analyser = null;
    }


    /* =====================================================
       EVENTS
       ===================================================== */

    async function loadEvents() {

        const {
            data,
            error
        } = await supabase
            .from("chat_community_events")
            .select("*")
            .eq(
                "community_id",
                state.currentCommunityId
            )
            .order("starts_at", {
                ascending: true
            })
            .limit(100);

        if (error) {

            console.warn(
                "Events:",
                error
            );

            return;
        }

        state.events = data || [];

        renderEvents();
    }


    function renderEvents() {

        const list =
            $("eventsList");

        if (!list) return;

        list.innerHTML = "";

        if (!state.events?.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No events have been created yet.
                </div>
            `;

            return;
        }

        for (const event of state.events) {

            const card =
                document.createElement("article");

            card.className =
                "event-card";

            const typeLabel = {
                audio: "🎙️ Audio",
                video: "📹 Video",
                audio_video: "🎙️📹 Audio + Video"
            }[
                event.event_type
            ] || event.event_type;

            card.innerHTML = `
                <div class="event-card-top">

                    <h3>
                        ${escapeHTML(event.title)}
                    </h3>

                    <span class="event-type">
                        ${escapeHTML(typeLabel)}
                    </span>

                </div>

                <div class="event-date">
                    ${formatDate(event.starts_at)}
                </div>

                <div class="event-description">
                    ${escapeHTML(
                        event.description || ""
                    )}
                </div>
            `;

            list.appendChild(card);
        }
    }


    async function createEvent(event) {

        event.preventDefault();

        const title =
            $("eventTitle").value.trim();

        const type =
            $("eventType").value;

        const startsAt =
            $("eventStartsAt").value;

        const endsAt =
            $("eventEndsAt").value ||
            null;

        const description =
            $("eventDescription").value.trim();

        if (!title || !startsAt) {

            showNotice(
                "Title and start time are required."
            );

            return;
        }

        const {
            error
        } = await supabase
            .from("chat_community_events")
            .insert({
                community_id:
                    state.currentCommunityId,

                created_by:
                    state.user.id,

                title,

                event_type:
                    type,

                description,

                starts_at:
                    new Date(
                        startsAt
                    ).toISOString(),

                ends_at:
                    endsAt
                        ? new Date(
                            endsAt
                        ).toISOString()
                        : null,

                is_public:
                    $("eventPublic").checked
            });

        if (error) {

            console.error(error);

            showNotice(
                error.message ||
                "Event could not be created."
            );

            return;
        }

        $("eventForm").reset();

        closeModal("eventModal");

        showNotice(
            "Event created."
        );

        await loadEvents();
    }


    /* =====================================================
       MEMBERS
       ===================================================== */

    async function loadMembers() {

        const {
            data,
            error
        } = await supabase
            .from("chat_community_members")
            .select(`
                user_id,
                role,
                joined_at
            `)
            .eq(
                "community_id",
                state.currentCommunityId
            );

        if (error) {

            console.warn(
                "Members:",
                error
            );

            return;
        }

        const userIds =
            (data || []).map(
                row => row.user_id
            );

        const profiles = {};

        if (userIds.length) {

            const {
                data: rows
            } = await supabase
                .from("chat_public_profiles")
                .select("*")
                .in(
                    "id",
                    userIds
                );

            for (const profile of rows || []) {
                profiles[profile.id] =
                    profile;
            }
        }

        state.members =
            (data || []).map(
                row => ({
                    ...row,
                    profile:
                        profiles[row.user_id] ||
                        {}
                })
            );

        renderMembers();
    }


    function renderMembers() {

        $("memberCount").textContent =
            state.members.length;

        const list =
            $("memberList");

        list.innerHTML = "";

        for (const member of state.members) {

            const profile =
                member.profile || {};

            const row =
                document.createElement("div");

            row.className =
                "member-row";

            row.innerHTML = `
                ${avatarHTML(
                    profile,
                    "avatar avatar-small"
                )}

                <div class="member-row-info">

                    <strong>
                        ${escapeHTML(
                            profile.display_name ||
                            profile.full_name ||
                            "Member"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            member.role || "Student"
                        )}
                    </small>

                </div>

                <span class="presence-dot"></span>
            `;

            list.appendChild(row);
        }
    }


    /* =====================================================
       CALL PICKER
       ===================================================== */

    function getCallMode() {

        return document
            .querySelector(
                'input[name="callMode"]:checked'
            )
            ?.value || "audio";
    }


    async function openCallPicker(
        mode
    ) {

        state.callPickerMode =
            mode;

        $("callPickerList").innerHTML =
            `<div class="message-loading">
                Loading people...
            </div>`;

        $("callWholeCommunityButton")
            .classList
            .toggle(
                "hidden",
                mode !== "community"
            );

        openModal("callModal");

        if (mode === "specific") {

            $("callModalTitle").textContent =
                "Call a Person";

            $("callModalDescription").textContent =
                "Select one person to call.";

        } else if (mode === "community") {

            $("callModalTitle").textContent =
                "Community Call";

            $("callModalDescription").textContent =
                "Select people or call the whole community.";

        } else {

            $("callModalTitle").textContent =
                "General Call";

            $("callModalDescription").textContent =
                "Select people to call.";
        }


        let members = [];

        if (mode === "community") {

            members =
                state.members;

        } else {

            /*
             * General call:
             * collect members from all communities.
             */

            const allRows = [];

            for (
                const community
                of state.communities
            ) {

                const {
                    data
                } = await supabase
                    .from("chat_community_members")
                    .select("user_id,role")
                    .eq(
                        "community_id",
                        community.id
                    );

                allRows.push(
                    ...(data || [])
                );
            }

            const ids = [
                ...new Set(
                    allRows.map(
                        row => row.user_id
                    )
                )
            ];

            if (ids.length) {

                const {
                    data: profiles
                } = await supabase
                    .from("chat_public_profiles")
                    .select("*")
                    .in(
                        "id",
                        ids
                    );

                members =
                    ids.map(id => ({
                        user_id: id,
                        profile:
                            (
                                profiles || []
                            ).find(
                                profile =>
                                    profile.id === id
                            ) || {}
                    }));
            }
        }


        members =
            members.filter(
                member =>
                    member.user_id !==
                    state.user.id
            );


        const list =
            $("callPickerList");

        list.innerHTML = "";


        if (!members.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No other members are available.
                </div>
            `;

            return;
        }


        for (const member of members) {

            const profile =
                member.profile || {};

            const row =
                document.createElement("label");

            row.className =
                "call-picker-user";

            row.innerHTML = `
                ${avatarHTML(
                    profile,
                    "avatar avatar-small"
                )}

                <span class="call-picker-user-info">

                    <strong>
                        ${escapeHTML(
                            profile.display_name ||
                            profile.full_name ||
                            "Member"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            member.role ||
                            "Member"
                        )}
                    </small>

                </span>

                <input
                    type="${
                        mode === "specific"
                            ? "radio"
                            : "checkbox"
                    }"
                    name="callPerson"
                    value="${escapeHTML(
                        member.user_id
                    )}"
                >
            `;

            list.appendChild(row);
        }
    }


    function selectedCallUsers() {

        return [
            ...document.querySelectorAll(
                'input[name="callPerson"]:checked'
            )
        ].map(
            input => input.value
        );
    }


    function startSelectedCall() {

        const users =
            selectedCallUsers();

        if (!users.length) {

            showNotice(
                "Select at least one person."
            );

            return;
        }

        closeModal("callModal");

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:start-general-call",
                {
                    detail: {
                        userIds: users,
                        mode:
                            getCallMode()
                    }
                }
            )
        );
    }


    function startCommunityCall() {

        const users =
            selectedCallUsers();

        closeModal("callModal");

        window.dispatchEvent(
            new CustomEvent(
                "mwaniki:start-community-call",
                {
                    detail: {
                        communityId:
                            state.currentCommunityId,

                        userIds: users,

                        mode:
                            getCallMode(),

                        wholeCommunity:
                            true
                    }
                }
            )
        );
    }


    /* =====================================================
       EMOJI / STICKERS / GIF
       ===================================================== */

    const emojiSet = [
        "😀","😃","😄","😁","😆","😅","😂","🤣",
        "😊","😇","🙂","🙃","😉","😌","😍","🥰",
        "😘","😎","🤓","🧐","🤔","😐","😑","😶",
        "🙄","😏","😣","😥","😮","🤐","😯","😪",
        "😫","🥱","😴","😌","🤗","🤩","🥳","😱",
        "😡","😠","🤬","😢","😭","😤","👍","👎",
        "👏","🙏","🔥","❤️","💯","🎉","🎓","🩺"
    ];


    function setupPickers() {

        $("emojiGrid").innerHTML =
            emojiSet
                .map(
                    emoji => `
                        <button
                            type="button"
                            data-emoji="${emoji}"
                        >
                            ${emoji}
                        </button>
                    `
                )
                .join("");

        $("emojiGrid")
            .querySelectorAll("button")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => insertAtCursor(
                        button.dataset.emoji
                    )
                );
            });


        const stickers = [
            "🩺","🧬","🔬","🧫",
            "📚","🧠","💉","🫀",
            "🫁","🩸","🎓","🔥"
        ];

        $("stickerGrid").innerHTML =
            stickers
                .map(
                    item => `
                        <button
                            type="button"
                        >
                            ${item}
                        </button>
                    `
                )
                .join("");

        $("stickerGrid")
            .querySelectorAll("button")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        insertAtCursor(
                            button.textContent
                        );

                        closePickerPanels();
                    }
                );
            });


        renderGifs();
    }


    function renderGifs(
        query = ""
    ) {

        const gifs = [
            "😂 LOL",
            "👏 Applause",
            "🔥 Fire",
            "🎉 Celebration",
            "🧠 Brain",
            "🩺 Doctor",
            "📚 Study",
            "💯 Perfect",
            "😮 Wow",
            "👍 Approved"
        ];

        const filtered =
            gifs.filter(
                item =>
                    item
                        .toLowerCase()
                        .includes(
                            query.toLowerCase()
                        )
            );

        $("gifGrid").innerHTML =
            filtered
                .map(
                    item => `
                        <button
                            type="button"
                        >
                            ${escapeHTML(item)}
                        </button>
                    `
                )
                .join("");

        $("gifGrid")
            .querySelectorAll("button")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        insertAtCursor(
                            `[GIF: ${button.textContent}]`
                        );

                        closePickerPanels();
                    }
                );
            });
    }


    function insertAtCursor(text) {

        const input =
            $("messageInput");

        const start =
            input.selectionStart;

        const end =
            input.selectionEnd;

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

        resizeTextarea();
    }


    function closePickerPanels() {

        [
            "emojiPanel",
            "stickerPanel",
            "gifPanel"
        ].forEach(
            id =>
                $(id)
                    ?.classList
                    .add("hidden")
        );
    }


    /* =====================================================
       REALTIME
       ===================================================== */

    function subscribeToMessages() {

        if (state.messageSubscription) {

            supabase.removeChannel(
                state.messageSubscription
            );
        }

        if (!state.currentChannelId) return;


        state.messageSubscription =
            supabase
                .channel(
                    `mwaniki-chat-${state.currentChannelId}-${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${state.currentChannelId}`
                    },
                    async () => {

                        await loadMessages();
                    }
                )
                .subscribe(
                    status => {

                        const connected =
                            status ===
                            "SUBSCRIBED";

                        $("connectionDot")
                            .style.background =
                            connected
                                ? "#39c172"
                                : "#d9534f";

                        $("connectionText")
                            .textContent =
                            connected
                                ? "Connected"
                                : status;
                    }
                );
    }


    /* =====================================================
       UI
       ===================================================== */

    function resizeTextarea() {

        const input =
            $("messageInput");

        input.style.height = "auto";

        input.style.height =
            `${Math.min(
                input.scrollHeight,
                140
            )}px`;
    }


    function setupUI() {

        $("communityHomeButton")
            .addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./dashboard.html";
                }
            );


        $("mobileSidebarButton")
            .addEventListener(
                "click",
                () => {

                    $("channelSidebar")
                        .classList
                        .toggle(
                            "mobile-open"
                        );
                }
            );


        $("messageInput")
            .addEventListener(
                "input",
                resizeTextarea
            );


        $("messageInput")
            .addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendTextMessage();
                    }
                }
            );


        $("sendMessageButton")
            .addEventListener(
                "click",
                sendTextMessage
            );


        $("attachButton")
            .addEventListener(
                "click",
                () =>
                    $("attachmentInput")
                        .click()
            );


        $("attachmentInput")
            .addEventListener(
                "change",
                event =>
                    handleSelectedFiles(
                        event.target.files
                    )
            );


        $("confirmAttachmentButton")
            .addEventListener(
                "click",
                async () => {

                    try {

                        await uploadAttachments();

                    } catch (error) {

                        console.error(error);

                        showNotice(
                            error.message ||
                            "Upload failed."
                        );
                    }
                }
            );


        $("cancelAttachmentButton")
            .addEventListener(
                "click",
                () => {

                    state.selectedFiles = [];

                    $("attachmentInput")
                        .value = "";

                    $("attachmentPreview")
                        .classList
                        .add("hidden");

                    closeModal(
                        "filePreviewModal"
                    );
                }
            );


        $("emojiButton")
            .addEventListener(
                "click",
                () => {

                    closePickerPanels();

                    $("emojiPanel")
                        .classList
                        .toggle(
                            "hidden"
                        );
                }
            );


        $("stickerButton")
            .addEventListener(
                "click",
                () => {

                    closePickerPanels();

                    $("stickerPanel")
                        .classList
                        .remove("hidden");
                }
            );


        $("gifButton")
            .addEventListener(
                "click",
                () => {

                    closePickerPanels();

                    $("gifPanel")
                        .classList
                        .remove("hidden");
                }
            );


        $("closeEmojiButton")
            .addEventListener(
                "click",
                closePickerPanels
            );

        $("closeStickerButton")
            .addEventListener(
                "click",
                closePickerPanels
            );

        $("closeGifButton")
            .addEventListener(
                "click",
                closePickerPanels
            );


        $("gifSearch")
            .addEventListener(
                "input",
                event =>
                    renderGifs(
                        event.target.value
                    )
            );


        $("emojiSearch")
            .addEventListener(
                "input",
                event => {

                    const query =
                        event.target.value
                            .toLowerCase();

                    document
                        .querySelectorAll(
                            "#emojiGrid button"
                        )
                        .forEach(button => {

                            button.style.display =
                                button.textContent
                                    .toLowerCase()
                                    .includes(query)
                                        ? ""
                                        : "none";
                        });
                }
            );


        $("voiceNoteButton")
            .addEventListener(
                "click",
                startVoiceRecording
            );

        $("stopVoiceButton")
            .addEventListener(
                "click",
                stopVoiceRecording
            );

        $("cancelVoiceButton")
            .addEventListener(
                "click",
                cancelVoiceRecording
            );

        $("sendVoiceButton")
            .addEventListener(
                "click",
                sendVoiceNote
            );


        $("friendsButton")
            .addEventListener(
                "click",
                async () => {

                    openModal(
                        "friendsModal"
                    );

                    await renderFriends();
                }
            );


        $("profileButton")
            .addEventListener(
                "click",
                openProfile
            );


        $("communityRulesButton")
            .addEventListener(
                () => {},
                () => {}
            );

        $("communityRulesButton")
            .addEventListener(
                "click",
                async () => {

                    state.rulesCommunity =
                        state.currentCommunity;

                    await renderRules(
                        state.currentCommunity,
                        true
                    );

                    openModal(
                        "rulesModal"
                    );
                }
            );


        $("rulesAgreementCheckbox")
            .addEventListener(
                "change",
                event => {

                    $("agreeRulesButton")
                        .disabled =
                        !event.target.checked;
                }
            );


        $("agreeRulesButton")
            .addEventListener(
                "click",
                agreeToRules
            );


        $("createEventButton")
            .addEventListener(
                "click",
                () => openModal(
                    "eventModal"
                )
            );


        $("eventsCreateButton")
            .addEventListener(
                "click",
                () => {

                    closeModal(
                        "eventsModal"
                    );

                    openModal(
                        "eventModal"
                    );
                }
            );


        $("eventsChannelButton")
            .addEventListener(
                "click",
                () => {

                    renderEvents();

                    openModal(
                        "eventsModal"
                    );
                }
            );


        $("eventForm")
            .addEventListener(
                "submit",
                createEvent
            );


        $("ticketButton")
            .addEventListener(
                "click",
                () => openModal(
                    "ticketModal"
                )
            );


        $("ticketForm")
            .addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    showNotice(
                        "Support request captured. Connect this form to your support table when that table is ready."
                    );

                    event.target.reset();

                    closeModal(
                        "ticketModal"
                    );
                }
            );


        $("communityCallButton")
            .addEventListener(
                "click",
                () =>
                    openCallPicker(
                        "community"
                    )
            );


        $("generalCallButton")
            .addEventListener(
                "click",
                () =>
                    openCallPicker(
                        "general"
                    )
            );


        $("callSpecificPersonButton")
            .addEventListener(
                "click",
                startSelectedCall
            );


        $("callWholeCommunityButton")
            .addEventListener(
                "click",
                startCommunityCall
            );


        $("cancelCallPickerButton")
            .addEventListener(
                "click",
                () =>
                    closeModal(
                        "callModal"
                    )
            );


        $("channelMembersButton")
            .addEventListener(
                "click",
                () => {

                    $("memberSidebar")
                        .scrollIntoView({
                            behavior: "smooth"
                        });
                }
            );


        document
            .querySelectorAll(
                "[data-close]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () =>
                        closeModal(
                            button.dataset.close
                        )
                );
            });


        document
            .querySelectorAll(".modal")
            .forEach(modal => {

                modal.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target ===
                            modal
                        ) {

                            modal.classList
                                .add("hidden");
                        }
                    }
                );
            });
    }


    /* =====================================================
       FRIENDS / PROFILE
       ===================================================== */

    async function renderFriends() {

        const content =
            $("friendsContent");

        content.innerHTML = "";

        for (
            const member
            of state.members
        ) {

            const profile =
                member.profile || {};

            const row =
                document.createElement("div");

            row.className =
                "member-row";

            row.innerHTML = `
                ${avatarHTML(
                    profile,
                    "avatar avatar-small"
                )}

                <div class="member-row-info">

                    <strong>
                        ${escapeHTML(
                            profile.display_name ||
                            profile.full_name ||
                            "Member"
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            member.role || "Student"
                        )}
                    </small>

                </div>

                ${
                    member.user_id !==
                    state.user.id
                        ? `
                            <button
                                class="primary-button friend-call"
                                type="button"
                                data-user="${escapeHTML(
                                    member.user_id
                                )}"
                            >
                                Call
                            </button>
                        `
                        : ""
                }
            `;

            content.appendChild(row);
        }


        content
            .querySelectorAll(
                ".friend-call"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        closeModal(
                            "friendsModal"
                        );

                        window.dispatchEvent(
                            new CustomEvent(
                                "mwaniki:call-user",
                                {
                                    detail: {
                                        userId:
                                            button.dataset.user,

                                        mode:
                                            getCallModeSafe()
                                    }
                                }
                            )
                        );
                    }
                );
            });
    }


    function getCallModeSafe() {

        return "audio";
    }


    function openProfile() {

        const profile =
            state.profile || {};

        $("profileModalContent")
            .innerHTML = `

                <div class="rules-heading">

                    ${avatarHTML(
                        profile,
                        "avatar avatar-medium"
                    )}

                    <div>

                        <h2>
                            ${escapeHTML(
                                profile.display_name ||
                                profile.full_name ||
                                "Student"
                            )}
                        </h2>

                        <p>
                            Mwaniki Scholars member
                        </p>

                    </div>

                </div>

                <p>
                    Role:
                    ${escapeHTML(
                        profile.role ||
                        "Student"
                    )}
                </p>
            `;

        openModal(
            "profileModal"
        );
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.MwanikiCommunity = {

        getCurrentCommunityId() {
            return state.currentCommunityId;
        },

        getCurrentCommunity() {
            return state.currentCommunity;
        },

        getCurrentUser() {
            return state.user;
        },

        refresh() {
            return loadCommunities();
        }
    };


    /* =====================================================
       START
       ===================================================== */

    async function init() {

        try {

            const authenticated =
                await loadSession();

            if (!authenticated) return;

            await loadProfile();

            setupPickers();

            setupUI();

            await loadCommunities();

            console.log(
                "Mwaniki Community ready."
            );

        } catch (error) {

            console.error(
                "Community startup:",
                error
            );

            showNotice(
                error.message ||
                "Community could not start."
            );
        }
    }


    init();

})();
