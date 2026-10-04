/* =========================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   Chat / Communities / Channels / Reactions / Voice Notes
   ========================================================= */

(() => {

    "use strict";


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        db: null,
        user: null,
        profile: null,

        communities: [],
        currentCommunity: null,
        currentChannel: null,

        messages: [],
        profiles: new Map(),
        attachments: new Map(),

        selectedFiles: [],

        messageRealtime: null,

        contestCourses: [],
        contestQuestions: [],
        contestIndex: 0,
        contestScore: 0,

        recorder: null,
        recordingStream: null,
        recordingChunks: [],
        recordingBlob: null,
        recordingUrl: null,

        waveformAnimation: null,
        recordingStartedAt: null

    };


    /* =====================================================
       DOM
       ===================================================== */

    const $ = id => document.getElementById(id);


    /* =====================================================
       START
       ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        initialise
    );


    async function initialise() {

        state.db =
            window.supabaseClient ||
            window.supabase ||
            window.sb ||
            window.mwanikiSupabase;

        if (!state.db) {

            console.error(
                "Mwaniki Community: Supabase client unavailable."
            );

            return;

        }

        bindEvents();

        await loadSession();

        if (!state.user) {
            showNotice("Please sign in first.");
            return;
        }

        await loadProfile();

        renderProfileHeader();

        await loadCommunities();

        initialiseEmojiPicker();

        initialiseStickerPicker();

        initialiseGifPicker();

    }


    /* =====================================================
       SESSION
       ===================================================== */

    async function loadSession() {

        const {
            data,
            error
        } = await state.db.auth.getSession();

        if (error) {

            console.error(error);

            return;

        }

        state.user =
            data?.session?.user || null;

    }


    /* =====================================================
       PROFILE
       ===================================================== */

    async function loadProfile() {

        if (!state.user) return;

        const {
            data,
            error
        } = await state.db
            .from("chat_public_profiles")
            .select("*")
            .eq("id", state.user.id)
            .maybeSingle();

        if (error) {

            console.warn(
                "Profile lookup failed:",
                error
            );

            state.profile = {

                id: state.user.id,

                display_name:
                    state.user.user_metadata?.full_name ||
                    state.user.email?.split("@")[0] ||
                    "Student",

                avatar_url:
                    state.user.user_metadata?.avatar_url ||
                    null

            };

            return;

        }

        state.profile =
            data || {

                id: state.user.id,

                display_name:
                    state.user.user_metadata?.full_name ||
                    "Student"

            };

    }


    function renderProfileHeader() {

        const name =
            state.profile?.display_name ||
            state.profile?.full_name ||
            "Student";

        $("headerProfileName").textContent = name;

        const avatar =
            state.profile?.avatar_url ||
            state.profile?.photo_url;

        renderAvatar(
            $("headerProfileAvatar"),
            avatar,
            name
        );

    }


    /* =====================================================
       COMMUNITIES
       ===================================================== */

    async function loadCommunities() {

        const {
            data,
            error
        } = await state.db
            .from("chat_communities")
            .select("*")
            .eq("is_active", true)
            .order("created_at", {
                ascending: true
            });

        if (error) {

            console.error(
                "Communities:",
                error
            );

            showNotice(
                "Unable to load communities."
            );

            return;

        }

        state.communities = data || [];

        renderCommunityRail();

        if (!state.currentCommunity && state.communities.length) {

            const mwaniki =
                state.communities.find(
                    c =>
                        String(c.slug || "")
                            .toLowerCase()
                            .includes("mwaniki")
                );

            await selectCommunity(
                mwaniki ||
                state.communities[0]
            );

        }

    }


    function renderCommunityRail() {

        const rail =
            $("communityRailList");

        rail.innerHTML = "";

        state.communities.forEach(
            community => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "community-rail-item";

                if (
                    state.currentCommunity &&
                    state.currentCommunity.id === community.id
                ) {

                    button.classList.add("active");

                }

                button.title =
                    community.name || "Community";

                button.innerHTML =
                    communityIconHTML(
                        community.icon_url,
                        fallbackCommunityEmoji(
                            community
                        )
                    );

                button.addEventListener(
                    "click",
                    () => selectCommunity(community)
                );

                rail.appendChild(button);

            }
        );

    }


    function communityIconHTML(
        iconUrl,
        fallback
    ) {

        if (iconUrl) {

            return `
                <span class="community-rail-icon">
                    <img
                        src="${escapeHTML(iconUrl)}"
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


    function fallbackCommunityEmoji(community) {

        const slug =
            String(
                community?.slug ||
                community?.name ||
                ""
            ).toLowerCase();

        if (slug.includes("gaming")) return "🎮";

        if (slug.includes("meme")) return "😂";

        return "🎓";

    }


    async function selectCommunity(community) {

        if (!community) return;

        state.currentCommunity =
            community;

        renderCommunityRail();

        $("selectedCommunityName")
            .textContent =
                community.name || "Community";

        $("selectedCommunityDescription")
            .textContent =
                community.description ||
                "Community discussion";

        $("selectedCommunityIcon")
            .innerHTML =
                community.icon_url
                    ? `<img
                            src="${escapeHTML(community.icon_url)}"
                            alt=""
                            style="width:100%;height:100%;object-fit:cover;border-radius:13px;"
                       >`
                    : fallbackCommunityEmoji(community);

        await loadChannels();

        await loadMembers();

        updateRules();

    }


    /* =====================================================
       CHANNELS
       ===================================================== */

    async function loadChannels() {

        if (!state.currentCommunity) return;

        const {
            data,
            error
        } = await state.db
            .from("chat_channels")
            .select("*")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .eq("is_active", true)
            .order("position", {
                ascending: true
            })
            .order("created_at", {
                ascending: true
            });

        if (error) {

            console.error(
                "Channels:",
                error
            );

            return;

        }

        const channels =
            data || [];

        const info =
            channels.filter(
                channel =>
                    isInformationChannel(channel)
            );

        const courses =
            channels.filter(
                channel =>
                    channel.course_id !== null &&
                    channel.course_id !== undefined
            );

        const community =
            channels.filter(
                channel =>
                    !isInformationChannel(channel) &&
                    channel.course_id === null &&
                    !channel.unit_id
            );

        renderChannelGroup(
            $("informationChannels"),
            info
        );

        renderChannelGroup(
            $("courseChannels"),
            courses
        );

        renderChannelGroup(
            $("communityChannels"),
            community
        );

        if (
            state.currentChannel &&
            channels.some(
                c => c.id === state.currentChannel.id
            )
        ) {

            await selectChannel(
                state.currentChannel
            );

        } else if (channels.length) {

            await selectChannel(
                channels[0]
            );

        }

    }


    function isInformationChannel(channel) {

        const value =
            `${channel.channel_type || ""} ${
                channel.slug || ""
            } ${
                channel.name || ""
            }`.toLowerCase();

        return (
            value.includes("information") ||
            value.includes("announcement") ||
            value.includes("rules") ||
            value.includes("changelog")
        );

    }


    function renderChannelGroup(
        container,
        channels
    ) {

        container.innerHTML = "";

        channels.forEach(
            channel => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "channel-button";

                if (
                    state.currentChannel &&
                    state.currentChannel.id === channel.id
                ) {

                    button.classList.add("active");

                }

                const icon =
                    channel.icon ||
                    channelIcon(channel);

                button.innerHTML = `
                    <span>${escapeHTML(icon)}</span>
                    <span>${escapeHTML(channel.name)}</span>
                `;

                button.addEventListener(
                    "click",
                    () => selectChannel(channel)
                );

                container.appendChild(button);

            }
        );

    }


    function channelIcon(channel) {

        const text =
            `${channel.name || ""} ${
                channel.slug || ""
            }`.toLowerCase();

        if (text.includes("rules")) return "📜";

        if (text.includes("changelog")) return "📋";

        if (text.includes("discussion")) return "💬";

        if (text.includes("misc")) return "🧩";

        if (text.includes("dead")) return "💀";

        if (channel.course_id) return "📚";

        return "💬";

    }


    async function selectChannel(channel) {

        if (!channel) return;

        state.currentChannel =
            channel;

        document
            .querySelectorAll(".channel-button")
            .forEach(
                button =>
                    button.classList.remove("active")
            );

        $("currentChannelName")
            .textContent =
                channel.name || "Channel";

        $("currentChannelDescription")
            .textContent =
                channel.description ||
                "Community discussion";

        $("currentChannelIcon")
            .textContent =
                channel.icon ||
                channelIcon(channel);

        await loadMessages();

        subscribeToMessages();

    }


    /* =====================================================
       MESSAGES
       ===================================================== */

    async function loadMessages() {

        if (!state.currentChannel) return;

        $("messageLoading")
            .textContent =
                "Loading messages…";

        const {
            data,
            error
        } = await state.db
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
            .limit(300);

        if (error) {

            console.error(
                "Messages:",
                error
            );

            $("messageList").innerHTML = `
                <div class="empty-state">
                    Unable to load messages.
                </div>
            `;

            return;

        }

        state.messages =
            data || [];

        await loadMessageProfiles();

        await loadMessageAttachments();

        renderMessages();

    }


    async function loadMessageProfiles() {

        const ids = [
            ...new Set(
                state.messages
                    .map(message => message.user_id)
                    .filter(Boolean)
            )
        ];

        if (!ids.length) return;

        const {
            data,
            error
        } = await state.db
            .from("chat_public_profiles")
            .select("*")
            .in("id", ids);

        if (error) {

            console.warn(
                "Message profiles:",
                error
            );

            return;

        }

        (data || []).forEach(
            profile =>
                state.profiles.set(
                    profile.id,
                    profile
                )
        );

    }


    async function loadMessageAttachments() {

        state.attachments.clear();

        const ids =
            state.messages
                .map(message => message.id)
                .filter(Boolean);

        if (!ids.length) return;

        const {
            data,
            error
        } = await state.db
            .from("chat_attachments")
            .select("*")
            .in("message_id", ids);

        if (error) {

            console.warn(
                "Attachments:",
                error
            );

            return;

        }

        (data || []).forEach(
            attachment => {

                if (
                    !state.attachments.has(
                        attachment.message_id
                    )
                ) {

                    state.attachments.set(
                        attachment.message_id,
                        []
                    );

                }

                state.attachments
                    .get(attachment.message_id)
                    .push(attachment);

            }
        );

    }


    function renderMessages() {

        const list =
            $("messageList");

        list.innerHTML = "";

        if (!state.messages.length) {

            list.innerHTML = `
                <div class="empty-state">
                    No messages yet.<br>
                    Start the discussion.
                </div>
            `;

            return;

        }

        state.messages.forEach(
            message =>
                list.appendChild(
                    createMessageElement(message)
                )
        );

        requestAnimationFrame(
            () => {
                list.scrollTop =
                    list.scrollHeight;
            }
        );

    }


    function createMessageElement(message) {

        const wrapper =
            document.createElement("article");

        wrapper.className =
            "message-group";

        const profile =
            state.profiles.get(
                message.user_id
            );

        const name =
            profile?.display_name ||
            profile?.full_name ||
            "Student";

        const avatar =
            profile?.avatar_url ||
            profile?.photo_url ||
            null;

        const deleted =
            Boolean(message.is_deleted);

        const attachments =
            state.attachments.get(
                message.id
            ) || [];

        wrapper.innerHTML = `

            <div class="message-avatar">
                ${
                    avatar
                    ? `
                        <img
                            src="${escapeHTML(avatar)}"
                            alt="${escapeHTML(name)}"
                        >
                    `
                    : "👤"
                }
            </div>

            <div class="message-body">

                <div class="message-meta">

                    <strong class="message-author">
                        ${escapeHTML(name)}
                    </strong>

                    <span class="message-time">
                        ${formatTime(message.created_at)}
                    </span>

                    ${
                        message.user_id === state.user?.id
                        ? `
                            <div class="message-actions">

                                <button
                                    class="message-action"
                                    data-message-action="react"
                                    data-message-id="${message.id}"
                                    type="button"
                                    title="React"
                                >
                                    😊
                                </button>

                                <button
                                    class="message-action"
                                    data-message-action="delete"
                                    data-message-id="${message.id}"
                                    type="button"
                                    title="Delete"
                                >
                                    🗑️
                                </button>

                            </div>
                        `
                        : `
                            <div class="message-actions">

                                <button
                                    class="message-action"
                                    data-message-action="react"
                                    data-message-id="${message.id}"
                                    type="button"
                                    title="React"
                                >
                                    😊
                                </button>

                            </div>
                        `
                    }

                </div>

                <div
                    class="message-content ${
                        deleted
                            ? "deleted-message"
                            : ""
                    }"
                >
                    ${
                        deleted
                        ? "Message deleted"
                        : escapeHTML(
                            message.content || ""
                        )
                    }
                </div>

                <div
                    class="message-attachments"
                    data-message-attachments="${message.id}"
                ></div>

                <div
                    class="reaction-row"
                    data-reactions="${message.id}"
                ></div>

            </div>

        `;

        renderAttachmentsInside(
            wrapper,
            attachments
        );

        wrapper
            .querySelectorAll(
                "[data-message-action='react']"
            )
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            openReactionPicker(
                                button,
                                message.id
                            );

                        }
                    )
            );

        wrapper
            .querySelectorAll(
                "[data-message-action='delete']"
            )
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            deleteMessage(
                                message.id
                            );

                        }
                    )
            );

        loadReactions(
            message.id,
            wrapper.querySelector(
                `[data-reactions="${message.id}"]`
            )
        );

        return wrapper;

    }


    function renderAttachmentsInside(
        wrapper,
        attachments
    ) {

        const target =
            wrapper.querySelector(
                ".message-attachments"
            );

        attachments.forEach(
            attachment => {

                const mime =
                    attachment.mime_type || "";

                if (
                    mime.startsWith("image/")
                ) {

                    const image =
                        document.createElement("img");

                    image.className =
                        "chat-image";

                    image.src =
                        attachment.file_url;

                    image.alt =
                        attachment.file_name ||
                        "Image";

                    target.appendChild(image);

                    return;

                }

                if (
                    mime.startsWith("audio/")
                ) {

                    const box =
                        document.createElement("div");

                    box.className =
                        "voice-message";

                    box.innerHTML = `
                        <audio
                            controls
                            preload="metadata"
                            src="${escapeHTML(
                                attachment.file_url
                            )}"
                        ></audio>
                    `;

                    target.appendChild(box);

                    return;

                }

                const file =
                    document.createElement("a");

                file.className =
                    "file-attachment";

                file.href =
                    attachment.file_url;

                file.target =
                    "_blank";

                file.rel =
                    "noopener";

                file.innerHTML = `
                    <span>📄</span>
                    <span>
                        ${escapeHTML(
                            attachment.file_name ||
                            "Attachment"
                        )}
                    </span>
                `;

                target.appendChild(file);

            }
        );

    }


    /* =====================================================
       REALTIME MESSAGES
       ===================================================== */

    function subscribeToMessages() {

        if (
            state.messageRealtime
        ) {

            state.db.removeChannel(
                state.messageRealtime
            );

            state.messageRealtime = null;

        }

        if (!state.currentChannel) return;

        state.messageRealtime =
            state.db
                .channel(
                    `mwaniki-chat-${
                        state.currentChannel.id
                    }`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "chat_messages",
                        filter:
                            `channel_id=eq.${
                                state.currentChannel.id
                            }`
                    },
                    async () => {

                        await loadMessages();

                    }
                )
                .subscribe();

    }


    /* =====================================================
       SEND TEXT
       ===================================================== */

    async function sendMessage() {

        if (
            !state.user ||
            !state.currentChannel
        ) {

            showNotice(
                "Select a channel first."
            );

            return;

        }

        const input =
            $("messageInput");

        const content =
            input.value.trim();

        if (!content) return;

        input.value = "";

        const {
            error
        } = await state.db
            .from("chat_messages")
            .insert({

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content,

                message_type:
                    "text"

            });

        if (error) {

            console.error(error);

            input.value = content;

            showNotice(
                "Message could not be sent."
            );

            return;

        }

    }


    /* =====================================================
       FILE ATTACHMENTS
       ===================================================== */

    function prepareFiles(files) {

        state.selectedFiles =
            [...files];

        if (!state.selectedFiles.length) {

            $("attachmentPreview")
                .classList.add("hidden");

            return;

        }

        const preview =
            $("attachmentPreview");

        preview.innerHTML = "";

        state.selectedFiles.forEach(
            file => {

                const item =
                    document.createElement("div");

                item.className =
                    "file-attachment";

                item.innerHTML = `
                    <span>📎</span>
                    <span>
                        ${escapeHTML(file.name)}
                    </span>
                `;

                preview.appendChild(item);

            }
        );

        preview.classList.remove(
            "hidden"
        );

        openModal(
            "filePreviewModal"
        );

    }


    async function uploadSelectedFiles() {

        if (
            !state.selectedFiles.length ||
            !state.currentChannel ||
            !state.user
        ) {

            closeModal(
                "filePreviewModal"
            );

            return;

        }

        for (
            const file of state.selectedFiles
        ) {

            await uploadChatFile(file);

        }

        state.selectedFiles = [];

        $("attachmentPreview")
            .classList.add("hidden");

        closeModal(
            "filePreviewModal"
        );

    }


    async function uploadChatFile(file) {

        /*
         * IMPORTANT:
         * MESSAGE FIRST
         * STORAGE SECOND
         * ATTACHMENT ROW THIRD
         *
         * This prevents attachment RLS from seeing
         * a parent message that does not exist yet.
         */

        const {
            data: message,
            error: messageError
        } = await state.db
            .from("chat_messages")
            .insert({

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    `📎 ${file.name}`,

                message_type:
                    file.type.startsWith("image/")
                        ? "image"
                        : "file"

            })
            .select("id")
            .single();

        if (
            messageError ||
            !message
        ) {

            console.error(
                "Message creation:",
                messageError
            );

            showNotice(
                "Attachment message could not be created."
            );

            return;

        }

        const safeName =
            file.name
                .replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

        const path =
            `attachments/${
                state.user.id
            }/${
                Date.now()
            }-${
                safeName
            }`;

        const {
            error: uploadError
        } = await state.db
            .storage
            .from("chat-attachments")
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
                "Storage upload:",
                uploadError
            );

            await softDeleteMessage(
                message.id
            );

            showNotice(
                "File upload failed."
            );

            return;

        }

        const {
            data: publicData
        } = state.db
            .storage
            .from("chat-attachments")
            .getPublicUrl(path);

        const fileUrl =
            publicData?.publicUrl;

        const {
            error: attachmentError
        } = await state.db
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
                "Attachment row:",
                attachmentError
            );

            await state.db
                .storage
                .from("chat-attachments")
                .remove([path]);

            await softDeleteMessage(
                message.id
            );

            showNotice(
                "Attachment database permission failed."
            );

            return;

        }

    }


    /* =====================================================
       VOICE NOTES
       ===================================================== */

    async function startVoiceRecording() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            showNotice(
                "Your browser does not support voice recording."
            );

            return;

        }

        try {

            state.recordingStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });

            const mimeType =
                getRecorderMimeType();

            state.recordingChunks = [];

            state.recorder =
                new MediaRecorder(
                    state.recordingStream,
                    mimeType
                        ? { mimeType }
                        : undefined
                );

            state.recordingStartedAt =
                Date.now();

            state.recorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size
                    ) {

                        state.recordingChunks
                            .push(event.data);

                    }

                };

            state.recorder.onstop =
                finishVoiceRecording;

            state.recorder.start(
                250
            );

            renderVoiceRecorder();

        } catch (error) {

            console.error(
                "Voice recording:",
                error
            );

            showNotice(
                "Microphone permission was not granted."
            );

        }

    }


    function getRecorderMimeType() {

        const types = [

            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus"

        ];

        return types.find(
            type =>
                MediaRecorder.isTypeSupported(
                    type
                )
        ) || "";

    }


    function renderVoiceRecorder() {

        const area =
            $("attachmentPreview");

        area.classList.remove(
            "hidden"
        );

        area.innerHTML = `

            <div class="voice-recorder">

                <div class="voice-recorder-status">
                    <span class="recording-dot"></span>

                    <strong>
                        Recording voice note
                    </strong>

                    <span
                        id="voiceRecordingTimer"
                    >
                        00:00
                    </span>
                </div>

                <canvas
                    id="voiceWaveform"
                    class="voice-waveform"
                    width="500"
                    height="70"
                ></canvas>

                <div class="voice-recorder-actions">

                    <button
                        id="cancelVoiceRecording"
                        type="button"
                    >
                        Cancel
                    </button>

                    <button
                        id="stopVoiceRecording"
                        type="button"
                    >
                        Stop
                    </button>

                </div>

            </div>
        `;

        $("cancelVoiceRecording")
            .addEventListener(
                "click",
                cancelVoiceRecording
            );

        $("stopVoiceRecording")
            .addEventListener(
                "click",
                () => {

                    if (
                        state.recorder &&
                        state.recorder.state !== "inactive"
                    ) {

                        state.recorder.stop();

                    }

                }
            );

        startRecordingTimer();

        drawWaveform();

    }


    let voiceTimer = null;

    function startRecordingTimer() {

        clearInterval(
            voiceTimer
        );

        voiceTimer =
            setInterval(
                () => {

                    if (
                        !state.recordingStartedAt
                    ) return;

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
                        $("voiceRecordingTimer");

                    if (timer) {

                        timer.textContent =
                            `${minutes}:${remainder}`;

                    }

                },
                500
            );

    }


    async function drawWaveform() {

        const canvas =
            $("voiceWaveform");

        if (
            !canvas ||
            !state.recordingStream
        ) return;

        try {

            const audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

            const analyser =
                audioContext.createAnalyser();

            analyser.fftSize =
                256;

            const source =
                audioContext.createMediaStreamSource(
                    state.recordingStream
                );

            source.connect(
                analyser
            );

            const data =
                new Uint8Array(
                    analyser.frequencyBinCount
                );

            const ctx =
                canvas.getContext("2d");

            const draw =
                () => {

                    if (
                        !state.recorder ||
                        state.recorder.state ===
                            "inactive"
                    ) {

                        audioContext.close()
                            .catch(() => {});

                        return;

                    }

                    analyser.getByteTimeDomainData(
                        data
                    );

                    ctx.clearRect(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );

                    ctx.beginPath();

                    for (
                        let i = 0;
                        i < data.length;
                        i++
                    ) {

                        const x =
                            i /
                            (data.length - 1) *
                            canvas.width;

                        const y =
                            (
                                data[i] / 255
                            ) *
                            canvas.height;

                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }

                    }

                    ctx.strokeStyle =
                        "#087f73";

                    ctx.lineWidth =
                        2;

                    ctx.stroke();

                    state.waveformAnimation =
                        requestAnimationFrame(
                            draw
                        );

                };

            draw();

        } catch (error) {

            console.warn(
                "Waveform unavailable:",
                error
            );

        }

    }


    async function finishVoiceRecording() {

        clearInterval(
            voiceTimer
        );

        if (
            state.waveformAnimation
        ) {

            cancelAnimationFrame(
                state.waveformAnimation
            );

        }

        state.recordingBlob =
            new Blob(
                state.recordingChunks,
                {
                    type:
                        state.recorder?.mimeType ||
                        "audio/webm"
                }
            );

        if (
            state.recordingUrl
        ) {

            URL.revokeObjectURL(
                state.recordingUrl
            );

        }

        state.recordingUrl =
            URL.createObjectURL(
                state.recordingBlob
            );

        stopRecordingStream();

        renderVoicePreview();

    }


    function renderVoicePreview() {

        const area =
            $("attachmentPreview");

        area.classList.remove(
            "hidden"
        );

        area.innerHTML = `

            <div class="voice-recorder">

                <strong>
                    Voice note ready
                </strong>

                <audio
                    controls
                    src="${state.recordingUrl}"
                ></audio>

                <div class="voice-recorder-actions">

                    <button
                        id="discardVoiceRecording"
                        type="button"
                    >
                        Delete
                    </button>

                    <button
                        id="sendVoiceRecording"
                        type="button"
                        class="primary-button"
                    >
                        Send voice note
                    </button>

                </div>

            </div>
        `;

        $("discardVoiceRecording")
            .addEventListener(
                "click",
                cancelVoiceRecording
            );

        $("sendVoiceRecording")
            .addEventListener(
                "click",
                sendVoiceNote
            );

    }


    async function sendVoiceNote() {

        if (
            !state.recordingBlob ||
            !state.currentChannel ||
            !state.user
        ) {

            return;

        }

        const blob =
            state.recordingBlob;

        /*
         * AGAIN:
         * 1. create message
         * 2. upload audio
         * 3. insert attachment
         */

        const {
            data: message,
            error: messageError
        } = await state.db
            .from("chat_messages")
            .insert({

                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content:
                    "🎙️ Voice note",

                message_type:
                    "voice"

            })
            .select("id")
            .single();

        if (
            messageError ||
            !message
        ) {

            console.error(
                messageError
            );

            showNotice(
                "Voice note message could not be created."
            );

            return;

        }

        const extension =
            blob.type.includes("ogg")
                ? "ogg"
                : "webm";

        const path =
            `voice-notes/${
                state.user.id
            }/${
                Date.now()
            }.${extension}`;

        const {
            error: uploadError
        } = await state.db
            .storage
            .from("chat-attachments")
            .upload(
                path,
                blob,
                {
                    upsert: false,
                    contentType:
                        blob.type ||
                        "audio/webm"
                }
            );

        if (uploadError) {

            console.error(
                uploadError
            );

            await softDeleteMessage(
                message.id
            );

            showNotice(
                "Voice note upload failed."
            );

            return;

        }

        const {
            data: publicData
        } = state.db
            .storage
            .from("chat-attachments")
            .getPublicUrl(path);

        const {
            error: attachmentError
        } = await state.db
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
                    publicData?.publicUrl,

                mime_type:
                    blob.type ||
                    "audio/webm",

                file_size:
                    blob.size

            });

        if (attachmentError) {

            console.error(
                attachmentError
            );

            await state.db
                .storage
                .from("chat-attachments")
                .remove([path]);

            await softDeleteMessage(
                message.id
            );

            showNotice(
                "Voice note attachment permission failed."
            );

            return;

        }

        cleanupRecording();

        $("attachmentPreview")
            .classList.add(
                "hidden"
            );

    }


    function cancelVoiceRecording() {

        if (
            state.recorder &&
            state.recorder.state !== "inactive"
        ) {

            state.recorder.stop();

        }

        stopRecordingStream();

        cleanupRecording();

        $("attachmentPreview")
            .classList.add(
                "hidden"
            );

    }


    function stopRecordingStream() {

        if (
            state.recordingStream
        ) {

            state.recordingStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

        state.recordingStream = null;

    }


    function cleanupRecording() {

        clearInterval(
            voiceTimer
        );

        if (
            state.waveformAnimation
        ) {

            cancelAnimationFrame(
                state.waveformAnimation
            );

        }

        stopRecordingStream();

        if (
            state.recordingUrl
        ) {

            URL.revokeObjectURL(
                state.recordingUrl
            );

        }

        state.recordingUrl = null;
        state.recordingBlob = null;
        state.recordingChunks = [];
        state.recorder = null;
        state.recordingStartedAt = null;

    }


    /* =====================================================
       DELETE MESSAGE
       ===================================================== */

    async function deleteMessage(
        messageId
    ) {

        const message =
            state.messages.find(
                item =>
                    item.id === messageId
            );

        if (
            !message ||
            message.user_id !== state.user?.id
        ) {

            showNotice(
                "You can only delete your own messages."
            );

            return;

        }

        const attachments =
            state.attachments.get(
                messageId
            ) || [];

        /*
         * Delete/soft-delete the message first.
         * The UI no longer depends on attachment deletion
         * succeeding.
         */

        const {
            error
        } = await state.db
            .from("chat_messages")
            .update({

                is_deleted: true,

                deleted_at:
                    new Date().toISOString(),

                content:
                    null

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
                "Delete message:",
                error
            );

            showNotice(
                "Message could not be deleted."
            );

            return;

        }

        /*
         * Cleanup attachments afterward.
         * Failure here must NOT resurrect the message.
         */

        for (
            const attachment of attachments
        ) {

            if (attachment.file_path) {

                await state.db
                    .storage
                    .from("chat-attachments")
                    .remove([
                        attachment.file_path
                    ])
                    .catch(
                        error =>
                            console.warn(
                                "Storage cleanup:",
                                error
                            )
                    );

            }

            await state.db
                .from("chat_attachments")
                .delete()
                .eq(
                    "id",
                    attachment.id
                )
                .catch(
                    error =>
                        console.warn(
                            "Attachment cleanup:",
                            error
                        )
                );

        }

        await loadMessages();

    }


    async function softDeleteMessage(
        messageId
    ) {

        await state.db
            .from("chat_messages")
            .update({

                is_deleted: true,

                deleted_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                messageId
            );

    }


    /* =====================================================
       REACTIONS
       ===================================================== */

    function openReactionPicker(
        button,
        messageId
    ) {

        document
            .querySelectorAll(
                ".reaction-picker"
            )
            .forEach(
                picker =>
                    picker.remove()
            );

        const picker =
            document.createElement("div");

        picker.className =
            "reaction-picker";

        [
            "❤️",
            "👍",
            "😂",
            "🔥",
            "👏",
            "😮",
            "😢",
            "🎉"
        ].forEach(
            emoji => {

                const item =
                    document.createElement("button");

                item.type = "button";

                item.textContent =
                    emoji;

                item.addEventListener(
                    "click",
                    async event => {

                        event.stopPropagation();

                        await addReaction(
                            messageId,
                            emoji
                        );

                        picker.remove();

                    }
                );

                picker.appendChild(item);

            }
        );

        document.body.appendChild(
            picker
        );

        const rect =
            button.getBoundingClientRect();

        picker.style.left =
            `${Math.min(
                rect.left,
                window.innerWidth - 300
            )}px`;

        picker.style.top =
            `${rect.bottom + 5}px`;

        setTimeout(
            () => {

                const close =
                    event => {

                        if (
                            !picker.contains(
                                event.target
                            ) &&
                            event.target !== button
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

            },
            0
        );

    }


    async function addReaction(
        messageId,
        reaction
    ) {

        const {
            error
        } = await state.db
            .from("chat_message_reactions")
            .upsert(
                {
                    message_id:
                        messageId,

                    user_id:
                        state.user.id,

                    reaction
                },
                {
                    onConflict:
                        "message_id,user_id"
                }
            );

        if (error) {

            console.error(
                "Reaction:",
                error
            );

            showNotice(
                "Reaction could not be added."
            );

            return;

        }

        await loadReactions(
            messageId
        );

    }


    async function loadReactions(
        messageId,
        target = null
    ) {

        const {
            data,
            error
        } = await state.db
            .from("chat_message_reactions")
            .select("*")
            .eq(
                "message_id",
                messageId
            );

        if (error) return;

        const counts = {};

        (data || []).forEach(
            reaction => {

                counts[
                    reaction.reaction
                ] =
                    (
                        counts[
                            reaction.reaction
                        ] || 0
                    ) + 1;

            }
        );

        const element =
            target ||
            document.querySelector(
                `[data-reactions="${messageId}"]`
            );

        if (!element) return;

        element.innerHTML =
            Object.entries(counts)
                .map(
                    ([emoji, count]) =>
                        `
                        <button
                            class="reaction-pill"
                            type="button"
                            data-reaction-message="${messageId}"
                            data-reaction="${emoji}"
                        >
                            ${emoji} ${count}
                        </button>
                        `
                )
                .join("");

    }


    /* =====================================================
       EMOJI
       ===================================================== */

    function initialiseEmojiPicker() {

        const emojis = [
            "😀","😃","😄","😁","😆","😅","😂","🤣",
            "😊","😇","🙂","🙃","😉","😌","😍","🥰",
            "😘","😎","🤓","🧐","🤔","🤨","😐","😑",
            "😶","🙄","😏","😣","😥","😮","🤐","😯",
            "😪","😫","🥱","😴","😌","🤩","🥳","😤",
            "😭","😢","😡","🤯","😱","👍","👎","👏",
            "🙏","🔥","❤️","💯","🎉","🎓","📚","🧪"
        ];

        const grid =
            $("emojiGrid");

        grid.innerHTML =
            emojis
                .map(
                    emoji =>
                        `
                        <button
                            type="button"
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
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        () => {

                            insertAtCursor(
                                $("messageInput"),
                                button.dataset.emoji
                            );

                            closeAllPickers();

                        }
                    )
            );

    }


    /* =====================================================
       STICKERS
       ===================================================== */

    function initialiseStickerPicker() {

        const stickers = [
            "🎓",
            "🧪",
            "🩺",
            "📚",
            "🔥",
            "😂",
            "👏",
            "💯",
            "🧠",
            "🏆",
            "🚀",
            "❤️"
        ];

        $("stickerGrid").innerHTML =
            stickers
                .map(
                    sticker =>
                        `
                        <button
                            type="button"
                            data-sticker="${sticker}"
                            style="font-size:30px"
                        >
                            ${sticker}
                        </button>
                        `
                )
                .join("");

        $("stickerGrid")
            .querySelectorAll(
                "[data-sticker]"
            )
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        () => {

                            insertAtCursor(
                                $("messageInput"),
                                button.dataset.sticker
                            );

                            closeAllPickers();

                        }
                    )
            );

    }


    /* =====================================================
       GIF
       ===================================================== */

    function initialiseGifPicker() {

        const gifs = [
            "😂",
            "🤣",
            "🔥",
            "👏",
            "🎉",
            "😎",
            "🤯",
            "💯"
        ];

        $("gifGrid").innerHTML =
            gifs
                .map(
                    gif =>
                        `
                        <button
                            type="button"
                            data-gif="${gif}"
                            style="font-size:30px"
                        >
                            ${gif}
                        </button>
                        `
                )
                .join("");

        $("gifGrid")
            .querySelectorAll(
                "[data-gif]"
            )
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        () => {

                            insertAtCursor(
                                $("messageInput"),
                                button.dataset.gif
                            );

                            closeAllPickers();

                        }
                    )
            );

    }


    function insertAtCursor(
        input,
        text
    ) {

        const start =
            input.selectionStart;

        const end =
            input.selectionEnd;

        input.value =
            input.value.substring(
                0,
                start
            ) +
            text +
            input.value.substring(
                end
            );

        input.focus();

        input.selectionStart =
            input.selectionEnd =
                start + text.length;

    }


    /* =====================================================
       MEMBERS
       ===================================================== */

    async function loadMembers() {

        if (!state.currentCommunity) return;

        const {
            data,
            error
        } = await state.db
            .from("chat_community_members")
            .select("*")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .limit(500);

        if (error) {

            console.error(
                "Members:",
                error
            );

            return;

        }

        const members =
            data || [];

        $("memberCount")
            .textContent =
                members.length;

        const ids =
            members
                .map(
                    member =>
                        member.user_id
                )
                .filter(Boolean);

        if (!ids.length) {

            $("memberList").innerHTML = "";

            return;

        }

        const {
            data: profiles
        } = await state.db
            .from("chat_public_profiles")
            .select("*")
            .in(
                "id",
                ids
            );

        const profileMap =
            new Map(
                (profiles || [])
                    .map(
                        profile =>
                            [
                                profile.id,
                                profile
                            ]
                    )
            );

        $("memberList").innerHTML = "";

        members.forEach(
            member => {

                const profile =
                    profileMap.get(
                        member.user_id
                    );

                const name =
                    profile?.display_name ||
                    profile?.full_name ||
                    member.nickname ||
                    "Student";

                const avatar =
                    profile?.avatar_url ||
                    profile?.photo_url ||
                    null;

                const item =
                    document.createElement("div");

                item.className =
                    "member-card";

                item.innerHTML = `

                    <div class="member-avatar">

                        ${
                            avatar
                            ? `
                                <img
                                    src="${escapeHTML(avatar)}"
                                    alt=""
                                >
                            `
                            : "👤"
                        }

                    </div>

                    <div class="member-name">

                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <small>
                            ${escapeHTML(
                                member.role ||
                                "Student"
                            )}
                        </small>

                    </div>
                `;

                $("memberList")
                    .appendChild(item);

            }
        );

    }


    /* =====================================================
       RULES
       ===================================================== */

    function updateRules() {

        if (!state.currentCommunity) return;

        $("rulesContent").innerHTML = `

            <h3>
                ${escapeHTML(
                    state.currentCommunity.name
                )}
            </h3>

            <p>
                Please keep this community academic,
                respectful and useful to other students.
            </p>

            <ul>
                <li>Respect other members.</li>
                <li>No harassment or abuse.</li>
                <li>Keep academic discussions relevant.</li>
                <li>Do not spam channels.</li>
                <li>Do not impersonate another student.</li>
                <li>Use course channels for course discussions.</li>
                <li>Follow moderator instructions.</li>
            </ul>

            <p>
                Community-specific rules can be expanded
                from the Rules channel.
            </p>

        `;

    }


    /* =====================================================
       CONTESTS
       ===================================================== */

    async function openContest() {

        const courses =
            state.currentCommunity
                ? await loadCommunityCourses()
                : [];

        state.contestCourses =
            courses;

        const selector =
            $("contestCourseSelector");

        selector.innerHTML = "";

        if (!courses.length) {

            selector.innerHTML = `
                <div class="empty-state">
                    No course channels are available
                    in this community yet.
                </div>
            `;

            openModal(
                "contestModal"
            );

            return;

        }

        courses.forEach(
            course => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "contest-course-button";

                button.textContent =
                    course.title;

                button.addEventListener(
                    "click",
                    () =>
                        loadContestQuestions(
                            course
                        )
                );

                selector.appendChild(
                    button
                );

            }
        );

        openModal(
            "contestModal"
        );

    }


    async function loadCommunityCourses() {

        const {
            data: channels,
            error
        } = await state.db
            .from("chat_channels")
            .select("course_id")
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .not(
                "course_id",
                "is",
                null
            );

        if (error) {

            console.error(error);

            return [];

        }

        const ids =
            [
                ...new Set(
                    (channels || [])
                        .map(
                            channel =>
                                channel.course_id
                        )
                        .filter(Boolean)
                )
            ];

        if (!ids.length) return [];

        const {
            data: courses
        } = await state.db
            .from("courses")
            .select(
                "id,title,description,image"
            )
            .in(
                "id",
                ids
            )
            .order(
                "title",
                {
                    ascending: true
                }
            );

        return courses || [];

    }


    async function loadContestQuestions(
        course
    ) {

        $("contestCourseName")
            .textContent =
                course.title;

        $("contestQuestionArea")
            .innerHTML = `
                <div class="empty-state">
                    Loading questions…
                </div>
            `;

        /*
         * SAME quizzes table used by the main quiz system.
         */

        const {
            data,
            error
        } = await state.db
            .from("quizzes")
            .select("*")
            .eq(
                "course_id",
                course.id
            )
            .limit(50);

        if (error) {

            console.error(
                "Contest questions:",
                error
            );

            $("contestQuestionArea")
                .innerHTML = `
                    <div class="empty-state">
                        Questions could not be loaded.
                    </div>
                `;

            return;

        }

        state.contestQuestions =
            shuffle(
                data || []
            );

        state.contestIndex = 0;
        state.contestScore = 0;

        if (!state.contestQuestions.length) {

            $("contestQuestionArea")
                .innerHTML = `
                    <div class="empty-state">
                        This course has no quiz questions
                        loaded yet.
                    </div>
                `;

            return;

        }

        renderContestQuestion();

    }


    function renderContestQuestion() {

        const question =
            state.contestQuestions[
                state.contestIndex
            ];

        if (!question) {

            $("contestQuestionArea")
                .innerHTML = `

                    <div class="contest-question-card">

                        <h2>
                            Contest complete 🎉
                        </h2>

                        <p>
                            Score:
                            <strong>
                                ${state.contestScore}
                            </strong>
                            /
                            ${state.contestQuestions.length}
                        </p>

                    </div>

                `;

            return;

        }

        const options = [

            {
                key: "a",
                text: question.option_a
            },

            {
                key: "b",
                text: question.option_b
            },

            {
                key: "c",
                text: question.option_c
            },

            {
                key: "d",
                text: question.option_d
            }

        ].filter(
            option =>
                option.text
        );

        $("contestQuestionArea")
            .innerHTML = `

                <div class="contest-question-card">

                    <p>
                        Question
                        ${state.contestIndex + 1}
                        of
                        ${state.contestQuestions.length}
                    </p>

                    <h3>
                        ${escapeHTML(
                            question.question ||
                            ""
                        )}
                    </h3>

                    <div
                        id="contestOptions"
                    ></div>

                </div>

            `;

        const container =
            $("contestOptions");

        options.forEach(
            option => {

                const button =
                    document.createElement("button");

                button.type = "button";

                button.className =
                    "contest-option";

                button.textContent =
                    `${option.key.toUpperCase()}. ${
                        option.text
                    }`;

                button.addEventListener(
                    "click",
                    () =>
                        answerContestQuestion(
                            option,
                            question,
                            container
                        )
                );

                container.appendChild(
                    button
                );

            }
        );

    }


    function answerContestQuestion(
        selected,
        question,
        container
    ) {

        const correct =
            String(
                question.correct_answer ||
                ""
            ).toLowerCase()
            .trim();

        const selectedKey =
            selected.key.toLowerCase();

        const buttons =
            container.querySelectorAll(
                ".contest-option"
            );

        buttons.forEach(
            button =>
                button.disabled = true
        );

        if (
            correct === selectedKey ||
            correct ===
                String(
                    selected.text || ""
                ).toLowerCase()
        ) {

            state.contestScore++;

            buttons[
                ["a","b","c","d"]
                    .indexOf(selectedKey)
            ]?.classList.add(
                "correct"
            );

        } else {

            buttons[
                ["a","b","c","d"]
                    .indexOf(selectedKey)
            ]?.classList.add(
                "wrong"
            );

        }

        setTimeout(
            () => {

                state.contestIndex++;

                renderContestQuestion();

            },
            800
        );

    }


    /* =====================================================
       UI EVENTS
       ===================================================== */

    function bindEvents() {

        $("communityHomeButton")
            .addEventListener(
                "click",
                () =>
                    window.location.href =
                        "./dashboard.html"
            );

        $("profileButton")
            .addEventListener(
                "click",
                openProfile
            );

        $("communityRulesButton")
            .addEventListener(
                "click",
                () =>
                    openModal("rulesModal")
            );

        $("friendsButton")
            .addEventListener(
                "click",
                openFriends
            );

        $("ticketButton")
            .addEventListener(
                "click",
                () =>
                    openModal("ticketModal")
            );

        $("attachButton")
            .addEventListener(
                "click",
                () =>
                    $("attachmentInput").click()
            );

        $("attachmentInput")
            .addEventListener(
                "change",
                event =>
                    prepareFiles(
                        event.target.files
                    )
            );

        $("confirmAttachmentButton")
            .addEventListener(
                "click",
                uploadSelectedFiles
            );

        $("emojiButton")
            .addEventListener(
                "click",
                () =>
                    togglePicker("emojiPanel")
            );

        $("stickerButton")
            .addEventListener(
                "click",
                () =>
                    togglePicker("stickerPanel")
            );

        $("gifButton")
            .addEventListener(
                "click",
                () =>
                    togglePicker("gifPanel")
            );

        $("voiceNoteButton")
            .addEventListener(
                "click",
                () => {

                    if (
                        state.recorder &&
                        state.recorder.state !== "inactive"
                    ) {

                        cancelVoiceRecording();

                    } else {

                        startVoiceRecording();

                    }

                }
            );

        $("sendMessageButton")
            .addEventListener(
                "click",
                sendMessage
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

                        sendMessage();

                    }

                }
            );

        $("contestChannelButton")
            .addEventListener(
                "click",
                openContest
            );

        $("channelMembersButton")
            .addEventListener(
                "click",
                () =>
                    $("memberSidebar")
                        .scrollIntoView({
                            behavior: "smooth"
                        })
            );

        $("mobileSidebarButton")
            .addEventListener(
                "click",
                () => {

                    $("channelSidebar")
                        .classList.toggle(
                            "mobile-open"
                        );

                }
            );

        $("communityCallButton")
            .addEventListener(
                "click",
                () => {

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:community-call-picker"
                        )
                    );

                }
            );

        $("generalCallButton")
            .addEventListener(
                "click",
                () => {

                    window.dispatchEvent(
                        new CustomEvent(
                            "mwaniki:general-call-picker"
                        )
                    );

                }
            );

        document
            .querySelectorAll(
                "[data-close-modal]"
            )
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        () =>
                            closeModal(
                                button.dataset.closeModal
                            )
                    )
            );

        document
            .querySelectorAll(
                "[data-close-picker]"
            )
            .forEach(
                button =>
                    button.addEventListener(
                        "click",
                        () =>
                            closePicker(
                                button.dataset.closePicker
                            )
                    )
            );

    }


    /* =====================================================
       FRIENDS
       ===================================================== */

    async function openFriends() {

        const content =
            $("friendsContent");

        content.innerHTML = `
            <div class="empty-state">
                Loading online students…
            </div>
        `;

        openModal(
            "friendsModal"
        );

        const {
            data,
            error
        } = await state.db
            .from("chat_public_profiles")
            .select("*")
            .limit(100);

        if (error) {

            content.innerHTML = `
                <div class="empty-state">
                    Could not load students.
                </div>
            `;

            return;

        }

        content.innerHTML = "";

        (data || []).forEach(
            profile => {

                const item =
                    document.createElement("div");

                item.className =
                    "member-card";

                item.innerHTML = `

                    <div class="member-avatar">

                        ${
                            profile.avatar_url
                            ? `
                                <img
                                    src="${escapeHTML(
                                        profile.avatar_url
                                    )}"
                                    alt=""
                                >
                            `
                            : "👤"
                        }

                    </div>

                    <div class="member-name">

                        <strong>
                            ${escapeHTML(
                                profile.display_name ||
                                profile.full_name ||
                                "Student"
                            )}
                        </strong>

                        <small>
                            Student
                        </small>

                    </div>

                `;

                content.appendChild(
                    item
                );

            }
        );

    }


    /* =====================================================
       PROFILE
       ===================================================== */

    function openProfile() {

        const name =
            state.profile?.display_name ||
            state.profile?.full_name ||
            "Student";

        const avatar =
            state.profile?.avatar_url ||
            state.profile?.photo_url;

        $("profileModalContent")
            .innerHTML = `

                <div
                    style="
                        display:grid;
                        place-items:center;
                        gap:10px;
                        padding:20px;
                    "
                >

                    <div
                        class="avatar"
                        style="
                            width:90px;
                            height:90px;
                            font-size:35px;
                        "
                    >

                        ${
                            avatar
                            ? `
                                <img
                                    src="${escapeHTML(avatar)}"
                                    alt=""
                                >
                            `
                            : "👤"
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

                </div>
            `;

        openModal(
            "profileModal"
        );

    }


    /* =====================================================
       MODALS / PICKERS
       ===================================================== */

    function openModal(id) {

        $(id)?.classList.remove(
            "hidden"
        );

    }


    function closeModal(id) {

        $(id)?.classList.add(
            "hidden"
        );

    }


    function togglePicker(id) {

        const panel =
            $(id);

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


    function closePicker(id) {

        $(id)?.classList.add(
            "hidden"
        );

    }


    function closeAllPickers() {

        [
            "emojiPanel",
            "stickerPanel",
            "gifPanel"
        ].forEach(
            id =>
                closePicker(id)
        );

    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function renderAvatar(
        element,
        url,
        name
    ) {

        if (!element) return;

        if (url) {

            element.innerHTML = `
                <img
                    src="${escapeHTML(url)}"
                    alt="${escapeHTML(name || "")}"
                >
            `;

        } else {

            element.textContent =
                "👤";

        }

    }


    function formatTime(
        value
    ) {

        if (!value) return "";

        const date =
            new Date(value);

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }


    function shuffle(array) {

        return [...array]
            .sort(
                () =>
                    Math.random() - .5
            );

    }


    function showNotice(
        message
    ) {

        const toast =
            $("toast");

        if (!toast) return;

        toast.textContent =
            message;

        toast.classList.remove(
            "hidden"
        );

        clearTimeout(
            toast._timer
        );

        toast._timer =
            setTimeout(
                () =>
                    toast.classList.add(
                        "hidden"
                    ),
                3500
            );

    }


    /* =====================================================
       PUBLIC COMMUNITY API
       ===================================================== */

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

        getCurrentChannelId() {

            return (
                state.currentChannel?.id ||
                null
            );

        },

        getUser() {

            return state.user;

        },

        getProfile() {

            return state.profile;

        }

    };


})();
