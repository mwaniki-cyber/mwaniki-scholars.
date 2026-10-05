/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   VERSION: 2026
   PRESENCE ENGINE: CORRECTED
   ============================================================ */

(() => {
    "use strict";


    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const PRESENCE_HEARTBEAT = 15000;      // 15 seconds

    /*
     * A heartbeat older than this is considered offline.
     *
     * Because the heartbeat is sent every 15 seconds,
     * 60 seconds gives enough tolerance for a slow request.
     */
    const PRESENCE_STALE_AFTER = 60000;

    /*
     * User becomes Away / Idle after 2 minutes
     * without actual interaction.
     */
    const IDLE_AFTER = 120000;


    /* ============================================================
       STATE
       ============================================================ */

    const state = {
        db: null,
        user: null,
        profile: null,

        communities: [],
        channels: [],
        members: [],
        messages: [],

        currentCommunity: null,
        currentChannel: null,

        presenceRows: new Map(),

        messageChannel: null,
        presenceChannel: null,

        presenceTimer: null,
        presenceRefreshTimer: null,

        lastActivity: Date.now(),

        currentPresenceStatus: "online",

        presenceWriteInProgress: false,

        /*
         * We keep references to every listener we install
         * so stopPresence() can remove them correctly.
         */
        presenceActivityHandlers: [],

        presenceVisibilityHandler: null,

        initialized: false,

        loadingMessages: false,
        sendingMessage: false,

        recording: false,
        mediaRecorder: null,
        recordingStream: null,
        recordingChunks: [],

        courses: []
    };


    /* ============================================================
       DOM HELPERS
       ============================================================ */

    const $ = id =>
        document.getElementById(id);


    function show(element) {
        if (element) {
            element.classList.remove("hidden");
        }
    }


    function hide(element) {
        if (element) {
            element.classList.add("hidden");
        }
    }


    function setText(id, value) {
        const element = $(id);

        if (element) {
            element.textContent =
                value ?? "";
        }
    }


    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function escapeAttr(value) {
        return escapeHTML(value);
    }


    /* ============================================================
       TOAST
       ============================================================ */

    let toastTimer = null;


    function notify(
        message,
        type = "info"
    ) {
        const toast =
            $("toast");

        if (!toast) {
            console.log(
                `[Community ${type}]`,
                message
            );

            return;
        }

        toast.textContent =
            message;

        toast.dataset.type =
            type;

        show(toast);

        clearTimeout(
            toastTimer
        );

        toastTimer =
            setTimeout(
                () => {
                    hide(toast);
                },
                3500
            );
    }


    /* ============================================================
       AVATAR SYSTEM
       ============================================================ */

    function validImage(url) {
        if (
            !url ||
            typeof url !== "string"
        ) {
            return false;
        }

        const value =
            url.trim();

        return (
            /^https?:\/\//i.test(value) ||
            /^data:image\//i.test(value) ||
            /^blob:/i.test(value)
        );
    }


    function initials(name) {
        const parts =
            String(
                name || "Student"
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!parts.length) {
            return "S";
        }

        if (parts.length === 1) {
            return parts[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function avatarMarkup(
        name,
        url,
        className = ""
    ) {
        const safeName =
            escapeAttr(
                name || "Student"
            );

        if (validImage(url)) {
            return `
                <img
                    class="${className} user-avatar-image"
                    src="${escapeAttr(url)}"
                    alt="${safeName}"
                    loading="lazy"
                    onerror="
                        this.style.display='none';
                        if(this.nextElementSibling){
                            this.nextElementSibling.style.display='flex';
                        }
                    "
                >

                <span
                    class="${className} avatar-fallback"
                    style="display:none"
                >
                    ${escapeHTML(
                        initials(name)
                    )}
                </span>
            `;
        }

        return `
            <span class="${className} avatar-fallback">
                ${escapeHTML(
                    initials(name)
                )}
            </span>
        `;
    }


    /* ============================================================
       SUPABASE
       ============================================================ */

    async function waitForSupabase() {
        for (
            let attempt = 0;
            attempt < 100;
            attempt++
        ) {
            const client =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb ||
                window.supabase;

            if (
                client &&
                client.auth &&
                typeof client.from ===
                    "function"
            ) {
                state.db =
                    client;

                console.log(
                    "✅ Community: Supabase client ready."
                );

                return client;
            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );
        }

        throw new Error(
            "Supabase client was not found."
        );
    }


    /* ============================================================
       AUTH
       ============================================================ */

    async function loadUser() {
        const result =
            await state.db.auth.getUser();

        if (result.error) {
            throw result.error;
        }

        if (!result.data?.user) {
            throw new Error(
                "You must be signed in."
            );
        }

        state.user =
            result.data.user;

        console.log(
            "✅ Authenticated:",
            state.user.id
        );
    }


    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadProfile() {
        let publicProfile =
            null;

        let student =
            null;

        try {
            const result =
                await state.db
                    .from(
                        "chat_public_profiles"
                    )
                    .select(
                        "id,full_name,photo_url,updated_at"
                    )
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();

            if (!result.error) {
                publicProfile =
                    result.data ||
                    null;
            }
        } catch (error) {
            console.warn(
                "Public profile lookup failed:",
                error
            );
        }

        try {
            const result =
                await state.db
                    .from("students")
                    .select(
                        "id,full_name,email,phone,course,level,photo_url"
                    )
                    .eq(
                        "id",
                        state.user.id
                    )
                    .maybeSingle();

            if (!result.error) {
                student =
                    result.data ||
                    null;
            }
        } catch (error) {
            console.warn(
                "Student profile lookup failed:",
                error
            );
        }

        const metadata =
            state.user.user_metadata ||
            {};

        const name =
            publicProfile?.full_name ||
            student?.full_name ||
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            metadata.username ||
            state.user.email?.split(
                "@"
            )[0] ||
            "Student";

        const photo =
            publicProfile?.photo_url ||
            student?.photo_url ||
            metadata.avatar_url ||
            metadata.picture ||
            null;

        state.profile = {
            id:
                state.user.id,

            name,

            photo,

            email:
                state.user.email ||
                "",

            publicProfile,

            student
        };

        updateHeaderProfile();
    }


    function updateHeaderProfile() {
        const image =
            $("headerProfileAvatar");

        const name =
            state.profile?.name ||
            "Student";

        setText(
            "headerProfileName",
            name
        );

        if (!image) {
            return;
        }

        if (
            validImage(
                state.profile?.photo
            )
        ) {
            image.src =
                state.profile.photo;

            image.alt =
                name;

            image.style.display =
                "block";
        } else {
            image.removeAttribute(
                "src"
            );

            image.alt =
                name;
        }

        /*
         * Keep header presence synchronized
         * with the current known status.
         */
        updateOwnPresenceUI(
            state.currentPresenceStatus
        );
    }


    /* ============================================================
       COMMUNITY ICON
       ============================================================ */

    function getCommunityIcon(
        community
    ) {
        const icon =
            community?.icon_url;

        if (validImage(icon)) {
            return `
                <img
                    src="${escapeAttr(icon)}"
                    class="community-icon-image"
                    alt=""
                >
            `;
        }

        const name =
            `${community?.name || ""} ${
                community?.slug || ""
            }`.toLowerCase();

        if (
            name.includes(
                "gaming"
            )
        ) {
            return "🎮";
        }

        if (
            name.includes(
                "meme"
            )
        ) {
            return "😂";
        }

        if (
            name.includes(
                "mwaniki"
            )
        ) {
            return "🎓";
        }

        return "💬";
    }


    /* ============================================================
       COMMUNITIES
       ============================================================ */

    async function loadCommunities() {
        const result =
            await state.db
                .from(
                    "chat_communities"
                )
                .select("*")
                .eq(
                    "is_active",
                    true
                )
                .order(
                    "name",
                    {
                        ascending:
                            true
                    }
                );

        if (result.error) {
            console.error(
                "Community loading failed:",
                result.error
            );

            throw result.error;
        }

        state.communities =
            result.data || [];

        state.communities.sort(
            (a, b) => {
                const aMain =
                    String(
                        a.name || ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki"
                        );

                const bMain =
                    String(
                        b.name || ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki"
                        );

                if (
                    aMain &&
                    !bMain
                ) {
                    return -1;
                }

                if (
                    !aMain &&
                    bMain
                ) {
                    return 1;
                }

                return String(
                    a.name || ""
                ).localeCompare(
                    String(
                        b.name || ""
                    )
                );
            }
        );

        renderCommunityRail();

        if (
            !state.communities.length
        ) {
            notify(
                "No active communities were found.",
                "warning"
            );

            return;
        }

        /*
         * Mwaniki Scholars is always the
         * preferred default community.
         */
        const main =
            state.communities.find(
                community =>
                    String(
                        community.name ||
                            ""
                    )
                        .toLowerCase()
                        .includes(
                            "mwaniki"
                        )
            ) ||
            state.communities[0];

        await selectCommunity(
            main.id
        );
    }


    function renderCommunityRail() {
        const rail =
            $("communityRailList");

        if (!rail) {
            return;
        }

        rail.innerHTML =
            "";

        state.communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "community-rail-item";

                if (
                    state.currentCommunity &&
                    String(
                        state.currentCommunity
                            .id
                    ) ===
                        String(
                            community.id
                        )
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.title =
                    community.name ||
                    "Community";

                button.innerHTML = `
                    <span class="community-rail-icon">
                        ${getCommunityIcon(
                            community
                        )}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () =>
                        selectCommunity(
                            community.id
                        )
                );

                rail.appendChild(
                    button
                );
            }
        );
    }


    function updateCommunityHeader() {
        const community =
            state.currentCommunity;

        if (!community) {
            return;
        }

        const icon =
            $("selectedCommunityIcon");

        if (icon) {
            icon.innerHTML =
                getCommunityIcon(
                    community
                );
        }

        setText(
            "selectedCommunityName",
            community.name ||
                "Community"
        );

        setText(
            "selectedCommunityDescription",
            community.description ||
                "Academic community"
        );

        renderCommunityRail();
    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels() {
        if (
            !state.currentCommunity
        ) {
            return;
        }

        const result =
            await state.db
                .from(
                    "chat_channels"
                )
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
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
                        ascending:
                            true
                    }
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            true
                    }
                );

        if (result.error) {
            console.error(
                "Channel loading failed:",
                result.error
            );

            state.channels =
                [];

            renderChannels();

            return;
        }

        state.channels =
            result.data || [];

        renderChannels();

        if (
            !state.channels.length
        ) {
            state.currentChannel =
                null;

            setText(
                "currentChannelName",
                "discussion"
            );

            setText(
                "currentChannelDescription",
                "No channels available"
            );

            return;
        }

        const preferred =
            state.channels.find(
                channel => {
                    const name =
                        `${
                            channel.name ||
                            ""
                        } ${
                            channel.slug ||
                            ""
                        }`.toLowerCase();

                    return (
                        name.includes(
                            "discussion"
                        ) ||
                        name.includes(
                            "general"
                        )
                    );
                }
            ) ||
            state.channels[0];

        await selectChannel(
            preferred.id
        );
    }


    function channelGroup(
        channel
    ) {
        if (
            channel.course_id ||
            channel.channel_type ===
                "course"
        ) {
            return "course";
        }

        if (
            channel.channel_type ===
                "announcement" ||
            String(
                channel.name || ""
            )
                .toLowerCase()
                .includes(
                    "announcement"
                ) ||
            String(
                channel.name || ""
            )
                .toLowerCase()
                .includes(
                    "rules"
                ) ||
            String(
                channel.name || ""
            )
                .toLowerCase()
                .includes(
                    "welcome"
                )
        ) {
            return "information";
        }

        return "discussion";
    }


    function channelIcon(
        channel
    ) {
        if (
            channel.icon &&
            !validImage(
                channel.icon
            )
        ) {
            return channel.icon;
        }

        switch (
            channel.channel_type
        ) {
            case "announcement":
                return "📢";

            case "study":
                return "📖";

            case "course":
                return "📚";

            case "voice":
                return "🔊";

            default:
                return "#";
        }
    }


    function renderChannels() {
        const info =
            $("informationChannels");

        const courses =
            $("courseChannels");

        const discussion =
            $("communityChannels");

        if (info) {
            info.innerHTML =
                "";
        }

        if (courses) {
            courses.innerHTML =
                "";
        }

        if (discussion) {
            discussion.innerHTML =
                "";
        }

        state.channels.forEach(
            channel => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type =
                    "button";

                button.className =
                    "channel-button";

                if (
                    state.currentChannel &&
                    String(
                        state.currentChannel
                            .id
                    ) ===
                        String(
                            channel.id
                        )
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.dataset.channelName =
                    channel.name ||
                    "";

                button.innerHTML = `
                    <span class="channel-icon">
                        ${escapeHTML(
                            channelIcon(
                                channel
                            )
                        )}
                    </span>

                    <span class="channel-name">
                        ${escapeHTML(
                            channel.name
                        )}
                    </span>
                `;

                button.addEventListener(
                    "click",
                    () =>
                        selectChannel(
                            channel.id
                        )
                );

                const group =
                    channelGroup(
                        channel
                    );

                if (
                    group ===
                    "information"
                ) {
                    info?.appendChild(
                        button
                    );
                } else if (
                    group ===
                    "course"
                ) {
                    courses?.appendChild(
                        button
                    );
                } else {
                    discussion?.appendChild(
                        button
                    );
                }
            }
        );
    }


    /* ============================================================
       COMMUNITY / CHANNEL SELECTION
       ============================================================ */

    async function selectCommunity(
        communityId
    ) {
        const community =
            state.communities.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        communityId
                    )
            );

        if (!community) {
            return;
        }

        state.currentCommunity =
            community;

        updateCommunityHeader();

        await loadChannels();

        await loadMembers();

        subscribePresence();
    }


    async function selectChannel(
        channelId
    ) {
        const channel =
            state.channels.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        channelId
                    )
            );

        if (!channel) {
            return;
        }

        state.currentChannel =
            channel;

        renderChannels();

        setText(
            "currentChannelName",
            channel.name
        );

        setText(
            "currentChannelDescription",
            channel.description ||
                "Community discussion"
        );

        const icon =
            $("currentChannelIcon");

        if (icon) {
            icon.textContent =
                channelIcon(
                    channel
                );
        }

        await loadMessages();

        subscribeMessages();
    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    /*
     * Return the status this browser should currently write.
     *
     * IMPORTANT:
     * We do NOT use window.blur().
     *
     * Losing focus can simply mean the user opened another
     * application or another browser window while remaining
     * active. Blur is therefore NOT evidence of Away status.
     */
    function getPresenceStatus() {
        if (
            state.currentPresenceStatus ===
            "dnd"
        ) {
            return "dnd";
        }

        /*
         * A hidden tab is Away.
         */
        if (
            document.hidden
        ) {
            return "away";
        }

        const inactiveFor =
            Date.now() -
            state.lastActivity;

        /*
         * Genuine inactivity.
         */
        if (
            inactiveFor >=
            IDLE_AFTER
        ) {
            return "away";
        }

        return "online";
    }


    /*
     * Write presence to both tables.
     *
     * chat_presence is the authoritative global presence row.
     *
     * chat_community_members is kept synchronized for the
     * currently logged-in member in every community.
     */
    async function writePresence(
        forcedStatus = null
    ) {
        if (
            !state.user ||
            !state.db
        ) {
            return;
        }

        /*
         * Prevent overlapping writes.
         *
         * We deliberately do not silently turn the next heartbeat
         * into a different state. The following heartbeat will
         * retry normally.
         */
        if (
            state.presenceWriteInProgress
        ) {
            return;
        }

        state.presenceWriteInProgress =
            true;

        try {
            let status =
                forcedStatus ||
                getPresenceStatus();

            /*
             * Never automatically create DND.
             *
             * DND must be explicitly requested by the user/system.
             */
            if (
                status !== "dnd" &&
                status !== "away" &&
                status !== "online"
            ) {
                status =
                    "online";
            }

            const now =
                new Date()
                    .toISOString();

            const payload = {
                user_id:
                    state.user.id,

                status,

                custom_status:
                    state.profile
                        ?.publicProfile
                        ?.custom_status ||
                    "",

                /*
                 * THIS is the heartbeat timestamp.
                 */
                last_seen_at:
                    now,

                updated_at:
                    now
            };

            const result =
                await state.db
                    .from(
                        "chat_presence"
                    )
                    .upsert(
                        payload,
                        {
                            onConflict:
                                "user_id"
                        }
                    );

            if (result.error) {
                console.error(
                    "❌ Presence write failed:",
                    result.error
                );

                return;
            }

            /*
             * Store the successful status locally.
             */
            state.currentPresenceStatus =
                status;

            /*
             * Update our local cache immediately.
             * This means the current browser does not have to
             * wait for Supabase Realtime before updating its UI.
             */
            state.presenceRows.set(
                String(
                    state.user.id
                ),
                {
                    user_id:
                        state.user.id,

                    status,

                    custom_status:
                        payload.custom_status,

                    last_seen_at:
                        now,

                    updated_at:
                        now
                }
            );

            /*
             * Keep community membership rows synchronized.
             *
             * Do NOT convert Away to Offline.
             *
             * The previous implementation did that and caused
             * the two tables to disagree.
             */
            const memberUpdate =
                await state.db
                    .from(
                        "chat_community_members"
                    )
                    .update({
                        status,

                        last_seen_at:
                            now,

                        last_active_at:
                            now
                    })
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (
                memberUpdate.error
            ) {
                console.warn(
                    "Community member presence update failed:",
                    memberUpdate.error
                );
            }

            updateOwnPresenceUI(
                status
            );

            /*
             * Update our member row immediately.
             */
            state.members.forEach(
                member => {
                    if (
                        String(
                            member.userId
                        ) ===
                        String(
                            state.user.id
                        )
                    ) {
                        member.status =
                            status;

                        member.lastSeen =
                            now;
                    }
                }
            );

            /*
             * Only rerender when the member list already exists.
             */
            if (
                state.members.length
            ) {
                renderMembers(
                    $("memberSearchInput")
                        ?.value || ""
                );
            }

        } catch (error) {
            console.error(
                "Presence error:",
                error
            );
        } finally {
            state.presenceWriteInProgress =
                false;
        }
    }


    /*
     * Header presence indicator.
     */
    function updateOwnPresenceUI(
        status
    ) {
        const dot =
            $("headerPresenceDot");

        if (!dot) {
            return;
        }

        dot.classList.remove(
            "online",
            "away",
            "dnd",
            "offline"
        );

        dot.classList.add(
            status ||
                "offline"
        );

        dot.title =
            presenceLabel(
                status
            );

        dot.setAttribute(
            "aria-label",
            presenceLabel(
                status
            )
        );
    }


    /*
     * Activity event.
     *
     * This does NOT write to Supabase on every mouse movement.
     *
     * It only updates lastActivity locally.
     *
     * The heartbeat writes the actual state every 15 seconds.
     */
    function markActivity() {
        const wasAway =
            state.currentPresenceStatus ===
            "away";

        state.lastActivity =
            Date.now();

        /*
         * If the user interacts after becoming Away,
         * immediately restore Online.
         *
         * The visibility check prevents a hidden tab from
         * becoming Online merely because of an unusual event.
         */
        if (
            !document.hidden &&
            wasAway
        ) {
            writePresence(
                "online"
            );
        }
    }


    /*
     * Start the complete presence engine.
     */
    function startPresence() {
        stopPresence();

        state.lastActivity =
            Date.now();

        state.currentPresenceStatus =
            "online";

        /*
         * Immediately establish Online status.
         */
        writePresence(
            "online"
        );

        /*
         * Heartbeat.
         *
         * Every 15 seconds:
         * - calculate Online/Away
         * - write current user's status
         * - refresh other members
         */
        state.presenceTimer =
            setInterval(
                () => {
                    const desired =
                        getPresenceStatus();

                    writePresence(
                        desired
                    );
                },
                PRESENCE_HEARTBEAT
            );

        /*
         * Refresh other members every 15 seconds.
         */
        state.presenceRefreshTimer =
            setInterval(
                () => {
                    refreshMemberPresence();
                },
                PRESENCE_HEARTBEAT
            );

        /*
         * Visibility.
         *
         * Hidden tab = Away.
         *
         * Returning to the tab = Online immediately.
         */
        state.presenceVisibilityHandler =
            () => {
                if (
                    document.hidden
                ) {
                    writePresence(
                        "away"
                    );
                } else {
                    state.lastActivity =
                        Date.now();

                    writePresence(
                        "online"
                    );

                    refreshMemberPresence();
                }
            };

        document.addEventListener(
            "visibilitychange",
            state.presenceVisibilityHandler
        );

        /*
         * IMPORTANT:
         *
         * There is intentionally NO:
         *
         * window.addEventListener("blur", ...)
         *
         * because browser blur is not a reliable presence
         * signal.
         */

        /*
         * Real user activity.
         */
        const activityEvents = [
            "mousemove",
            "mousedown",
            "keydown",
            "scroll",
            "touchstart",
            "click",
            "pointerdown"
        ];

        state.presenceActivityHandlers =
            activityEvents.map(
                eventName => {
                    const handler =
                        markActivity;

                    document.addEventListener(
                        eventName,
                        handler,
                        {
                            passive:
                                true
                        }
                    );

                    return {
                        eventName,
                        handler
                    };
                }
            );

        /*
         * Focus can restore Online, but focus alone is NOT
         * used to mark Away.
         */
        const focusHandler =
            () => {
                state.lastActivity =
                    Date.now();

                if (
                    !document.hidden
                ) {
                    writePresence(
                        "online"
                    );
                }
            };

        window.addEventListener(
            "focus",
            focusHandler
        );

        state.presenceActivityHandlers.push(
            {
                eventName:
                    "__window_focus__",

                handler:
                    focusHandler
            }
        );
    }


    /*
     * Stop presence cleanly.
     *
     * This is important because your previous implementation
     * added anonymous event listeners and never removed them.
     */
    function stopPresence() {
        if (
            state.presenceTimer
        ) {
            clearInterval(
                state.presenceTimer
            );

            state.presenceTimer =
                null;
        }

        if (
            state.presenceRefreshTimer
        ) {
            clearInterval(
                state.presenceRefreshTimer
            );

            state.presenceRefreshTimer =
                null;
        }

        if (
            state.presenceVisibilityHandler
        ) {
            document.removeEventListener(
                "visibilitychange",
                state.presenceVisibilityHandler
            );

            state.presenceVisibilityHandler =
                null;
        }

        /*
         * Remove all activity listeners.
         */
        state.presenceActivityHandlers
            .forEach(
                item => {
                    if (
                        item.eventName ===
                        "__window_focus__"
                    ) {
                        window.removeEventListener(
                            "focus",
                            item.handler
                        );
                    } else {
                        document.removeEventListener(
                            item.eventName,
                            item.handler
                        );
                    }
                }
            );

        state.presenceActivityHandlers =
            [];
    }


    /*
     * Calculate another user's visible status from the
     * database row.
     *
     * last_seen_at is authoritative for freshness.
     */
    function calculatePresence(
        row
    ) {
        if (!row) {
            return "offline";
        }

        const rawTimestamp =
            row.last_seen_at ||
            row.updated_at ||
            null;

        if (!rawTimestamp) {
            return "offline";
        }

        const timestamp =
            Date.parse(
                rawTimestamp
            );

        if (
            !Number.isFinite(
                timestamp
            )
        ) {
            return "offline";
        }

        /*
         * Protect against tiny client/server clock differences.
         */
        const age =
            Math.max(
                0,
                Date.now() -
                    timestamp
            );

        /*
         * Older than one minute = offline.
         */
        if (
            age >
            PRESENCE_STALE_AFTER
        ) {
            return "offline";
        }

        /*
         * DND is explicit.
         */
        if (
            row.status === "dnd"
        ) {
            return "dnd";
        }

        /*
         * Fresh Online heartbeat = Online.
         */
        if (
            row.status === "online"
        ) {
            return "online";
        }

        /*
         * Fresh Away heartbeat = Away.
         */
        if (
            row.status === "away"
        ) {
            return "away";
        }

        return "offline";
    }


    function presenceLabel(
        status
    ) {
        switch (status) {
            case "online":
                return "Online";

            case "away":
                return "Away / Idle";

            case "dnd":
                return "Do Not Disturb";

            default:
                return "Offline";
        }
    }


    /*
     * Presence realtime.
     */
    function subscribePresence() {
        if (
            state.presenceChannel
        ) {
            state.db.removeChannel(
                state.presenceChannel
            );

            state.presenceChannel =
                null;
        }

        state.presenceChannel =
            state.db
                .channel(
                    "mwaniki-global-presence"
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "*",

                        schema:
                            "public",

                        table:
                            "chat_presence"
                    },
                    payload => {
                        if (
                            payload.new
                                ?.user_id
                        ) {
                            state.presenceRows.set(
                                String(
                                    payload
                                        .new
                                        .user_id
                                ),
                                payload.new
                            );
                        }

                        /*
                         * Realtime immediately updates the member
                         * sidebar without waiting for the next
                         * heartbeat.
                         */
                        refreshMemberPresence();
                    }
                )
                .subscribe(
                    status => {
                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {
                            console.log(
                                "🟢 Presence realtime: SUBSCRIBED"
                            );
                        }
                    }
                );
    }


    /* ============================================================
       MEMBERS
       ============================================================ */

    async function loadMembers() {
        if (
            !state.currentCommunity
        ) {
            return;
        }

        const result =
            await state.db
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
                );

        if (result.error) {
            console.error(
                "Member query failed:",
                result.error
            );

            state.members =
                [];

            renderMembers();

            return;
        }

        const rows =
            result.data || [];

        if (!rows.length) {
            state.members = [
                {
                    userId:
                        state.user.id,

                    name:
                        state.profile
                            ?.name ||
                        "You",

                    photo:
                        state.profile
                            ?.photo ||
                        null,

                    status:
                        state.currentPresenceStatus ||
                        "online",

                    customStatus:
                        "",

                    role:
                        "student"
                }
            ];

            renderMembers();

            updateOwnPresenceUI(
                state.members[0]
                    .status
            );

            return;
        }

        const userIds = [
            ...new Set(
                rows
                    .map(
                        row =>
                            row.user_id
                    )
                    .filter(Boolean)
            )
        ];

        let profiles = [];
        let students = [];
        let presence = [];

        if (
            userIds.length
        ) {
            const result =
                await state.db
                    .from(
                        "chat_public_profiles"
                    )
                    .select(
                        "id,full_name,photo_url,updated_at"
                    )
                    .in(
                        "id",
                        userIds
                    );

            if (!result.error) {
                profiles =
                    result.data ||
                    [];
            }
        }

        if (
            userIds.length
        ) {
            const result =
                await state.db
                    .from("students")
                    .select(
                        "id,full_name,email,course,level,photo_url"
                    )
                    .in(
                        "id",
                        userIds
                    );

            if (!result.error) {
                students =
                    result.data ||
                    [];
            }
        }

        if (
            userIds.length
        ) {
            const result =
                await state.db
                    .from(
                        "chat_presence"
                    )
                    .select(
                        "user_id,status,custom_status,last_seen_at,updated_at"
                    )
                    .in(
                        "user_id",
                        userIds
                    );

            if (!result.error) {
                presence =
                    result.data ||
                    [];
            }
        }

        presence.forEach(
            row => {
                state.presenceRows.set(
                    String(
                        row.user_id
                    ),
                    row
                );
            }
        );

        state.members =
            rows.map(
                member => {
                    const userId =
                        member.user_id;

                    const profile =
                        profiles.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    userId
                                )
                        );

                    const student =
                        students.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    userId
                                )
                        );

                    const live =
                        presence.find(
                            item =>
                                String(
                                    item.user_id
                                ) ===
                                String(
                                    userId
                                )
                        );

                    /*
                     * If this is the current user and the local
                     * heartbeat has already succeeded, prefer that
                     * known status.
                     */
                    let status =
                        calculatePresence(
                            live
                        );

                    if (
                        String(
                            userId
                        ) ===
                        String(
                            state.user?.id
                        ) &&
                        state.currentPresenceStatus
                    ) {
                        status =
                            state.currentPresenceStatus;
                    }

                    if (
                        String(
                            userId
                        ) ===
                        String(
                            state.user?.id
                        )
                    ) {
                        updateOwnPresenceUI(
                            status
                        );
                    }

                    return {
                        membership:
                            member,

                        userId,

                        name:
                            member.display_name ||
                            member.nickname ||
                            profile?.full_name ||
                            student?.full_name ||
                            "Student",

                        photo:
                            member.avatar_url ||
                            profile?.photo_url ||
                            student?.photo_url ||
                            null,

                        status,

                        customStatus:
                            live?.custom_status ||
                            "",

                        role:
                            member.role ||
                            "student",

                        course:
                            student?.course ||
                            "",

                        level:
                            student?.level ||
                            "",

                        lastSeen:
                            live?.last_seen_at ||
                            member.last_seen_at ||
                            null
                    };
                }
            );

        renderMembers(
            $("memberSearchInput")
                ?.value || ""
        );
    }


    async function refreshMemberPresence() {
        if (
            !state.members.length
        ) {
            return;
        }

        const ids = [
            ...new Set(
                state.members
                    .map(
                        member =>
                            member.userId
                    )
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return;
        }

        const result =
            await state.db
                .from(
                    "chat_presence"
                )
                .select(
                    "user_id,status,custom_status,last_seen_at,updated_at"
                )
                .in(
                    "user_id",
                    ids
                );

        if (result.error) {
            console.warn(
                "Presence refresh failed:",
                result.error
            );

            return;
        }

        /*
         * Replace cache entries with the latest database state.
         */
        (result.data || []).forEach(
            row => {
                state.presenceRows.set(
                    String(
                        row.user_id
                    ),
                    row
                );
            }
        );

        state.members.forEach(
            member => {
                const row =
                    state.presenceRows.get(
                        String(
                            member.userId
                        )
                    );

                let status =
                    calculatePresence(
                        row
                    );

                /*
                 * Current user's status has just been written by
                 * this browser. Keep its locally confirmed state.
                 */
                if (
                    String(
                        member.userId
                    ) ===
                    String(
                        state.user?.id
                    )
                ) {
                    status =
                        state.currentPresenceStatus ||
                        status;

                    updateOwnPresenceUI(
                        status
                    );
                }

                member.status =
                    status;

                member.customStatus =
                    row?.custom_status ||
                    "";

                member.lastSeen =
                    row?.last_seen_at ||
                    member.lastSeen ||
                    null;
            }
        );

        renderMembers(
            $("memberSearchInput")
                ?.value || ""
        );
    }


    function renderMembers(
        searchValue = ""
    ) {
        const container =
            $("memberList");

        if (!container) {
            return;
        }

        const query =
            String(
                searchValue || ""
            )
                .trim()
                .toLowerCase();

        const visible =
            state.members.filter(
                member => {
                    const name =
                        String(
                            member.name ||
                                ""
                        )
                            .toLowerCase();

                    const status =
                        String(
                            member.status ||
                                ""
                        )
                            .toLowerCase();

                    const custom =
                        String(
                            member.customStatus ||
                                ""
                        )
                            .toLowerCase();

                    return (
                        !query ||
                        name.includes(
                            query
                        ) ||
                        status.includes(
                            query
                        ) ||
                        custom.includes(
                            query
                        )
                    );
                }
            );

        setText(
            "memberCount",
            state.members.length
        );

        container.innerHTML =
            "";

        if (
            !visible.length
        ) {
            container.innerHTML = `
                <div class="member-empty">
                    <strong>No members found</strong>
                    <span>Try another name.</span>
                </div>
            `;

            return;
        }

        visible.forEach(
            member => {
                const row =
                    document.createElement(
                        "div"
                    );

                const status =
                    member.status ||
                    "offline";

                row.className =
                    `member-row status-${status}`;

                const self =
                    String(
                        member.userId
                    ) ===
                    String(
                        state.user?.id
                    );

                const customStatus =
                    String(
                        member.customStatus ||
                            ""
                    ).trim();

                row.innerHTML = `
                    <div class="member-avatar-wrap">

                        ${avatarMarkup(
                            member.name,
                            member.photo,
                            "member-avatar"
                        )}

                        <span
                            class="presence-dot ${escapeAttr(
                                status
                            )}"
                            title="${escapeAttr(
                                presenceLabel(
                                    status
                                )
                            )}"
                            aria-label="${escapeAttr(
                                presenceLabel(
                                    status
                                )
                            )}"
                        ></span>

                    </div>

                    <div class="member-info">

                        <strong class="member-name">
                            ${escapeHTML(
                                member.name
                            )}
                        </strong>

                        <span
                            class="member-status-text ${escapeAttr(
                                status
                            )}"
                        >
                            <i></i>
                            ${escapeHTML(
                                presenceLabel(
                                    status
                                )
                            )}
                        </span>

                        ${
                            customStatus
                                ? `
                                    <span class="member-custom-status">
                                        ${escapeHTML(
                                            customStatus
                                        )}
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    <div class="member-actions">

                        ${
                            self
                                ? `
                                    <span class="member-you">
                                        YOU
                                    </span>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="member-action-button dm-member-button"
                                        title="Message ${escapeAttr(
                                            member.name
                                        )}"
                                        aria-label="Message ${escapeAttr(
                                            member.name
                                        )}"
                                    >
                                        💬
                                    </button>

                                    <button
                                        type="button"
                                        class="member-action-button call-member-button"
                                        title="Call ${escapeAttr(
                                            member.name
                                        )}"
                                        aria-label="Call ${escapeAttr(
                                            member.name
                                        )}"
                                    >
                                        📞
                                    </button>
                                `
                        }

                    </div>
                `;

                row.querySelector(
                    ".dm-member-button"
                )?.addEventListener(
                    "click",
                    event => {
                        event.stopPropagation();

                        openDirectMessage(
                            member
                        );
                    }
                );

                row.querySelector(
                    ".call-member-button"
                )?.addEventListener(
                    "click",
                    event => {
                        event.stopPropagation();

                        callMember(
                            member
                        );
                    }
                );

                container.appendChild(
                    row
                );
            }
        );
    }


    /* ============================================================
       MESSAGES
       ============================================================ */

    function senderId(
        message
    ) {
        return (
            message.user_id ||
            null
        );
    }


    function messageContent(
        message
    ) {
        return (
            message.content ||
            ""
        );
    }


    async function loadMessages() {
        if (
            !state.currentChannel
        ) {
            return;
        }

        const list =
            $("messageList");

        if (list) {
            list.innerHTML =
                "";
        }

        show(
            $("messageLoading")
        );

        try {
            const result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .select("*")
                    .eq(
                        "channel_id",
                        state.currentChannel.id
                    )
                    .eq(
                        "is_deleted",
                        false
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                true
                        }
                    )
                    .limit(150);

            if (result.error) {
                console.error(
                    "Message loading failed:",
                    result.error
                );

                state.messages =
                    [];

                renderMessages();

                return;
            }

            state.messages =
                result.data || [];

            await enrichMessages();

            renderMessages();

        } finally {
            hide(
                $("messageLoading")
            );
        }
    }


    async function enrichMessages() {
        if (
            !state.messages.length
        ) {
            return;
        }

        const ids = [
            ...new Set(
                state.messages
                    .map(
                        message =>
                            senderId(
                                message
                            )
                    )
                    .filter(Boolean)
            )
        ];

        if (!ids.length) {
            return;
        }

        let profiles = [];
        let students = [];

        const profileResult =
            await state.db
                .from(
                    "chat_public_profiles"
                )
                .select(
                    "id,full_name,photo_url"
                )
                .in(
                    "id",
                    ids
                );

        if (
            !profileResult.error
        ) {
            profiles =
                profileResult.data ||
                [];
        }

        const studentResult =
            await state.db
                .from("students")
                .select(
                    "id,full_name,photo_url"
                )
                .in(
                    "id",
                    ids
                );

        if (
            !studentResult.error
        ) {
            students =
                studentResult.data ||
                [];
        }

        state.messages.forEach(
            message => {
                const id =
                    senderId(
                        message
                    );

                const profile =
                    profiles.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(id)
                    );

                const student =
                    students.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(id)
                    );

                const member =
                    state.members.find(
                        item =>
                            String(
                                item.userId
                            ) ===
                            String(id)
                    );

                message._name =
                    profile?.full_name ||
                    student?.full_name ||
                    member?.name ||
                    (
                        String(id) ===
                        String(
                            state.user?.id
                        )
                            ? state.profile
                                ?.name
                            : "Student"
                    );

                message._photo =
                    profile?.photo_url ||
                    student?.photo_url ||
                    member?.photo ||
                    null;
            }
        );
    }


    function formatTime(
        value
    ) {
        if (!value) {
            return "";
        }

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
                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );
    }


    function renderMessages() {
        const list =
            $("messageList");

        if (!list) {
            return;
        }

        list.innerHTML =
            "";

        if (
            !state.messages.length
        ) {
            list.innerHTML = `
                <div class="messages-empty">

                    <div class="messages-empty-icon">
                        💬
                    </div>

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

        state.messages.forEach(
            message => {
                list.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );

        requestAnimationFrame(
            () => {
                list.scrollTop =
                    list.scrollHeight;
            }
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
            "message-item";

        article.dataset.messageId =
            message.id;

        const id =
            senderId(
                message
            );

        const own =
            String(id) ===
            String(
                state.user?.id
            );

        const name =
            message._name ||
            "Student";

        const photo =
            message._photo ||
            null;

        const content =
            messageContent(
                message
            );

        article.innerHTML = `
            <div class="message-avatar">
                ${avatarMarkup(
                    name,
                    photo,
                    "chat-avatar"
                )}
            </div>

            <div class="message-content">

                <div class="message-meta">

                    <strong>
                        ${escapeHTML(
                            name
                        )}
                    </strong>

                    <time>
                        ${formatTime(
                            message.created_at
                        )}
                    </time>

                </div>

                ${
                    content
                        ? `
                            <div class="message-text">
                                ${escapeHTML(
                                    content
                                ).replace(
                                    /\n/g,
                                    "<br>"
                                )}
                            </div>
                        `
                        : ""
                }

                <div class="message-actions">

                    ${
                        own
                            ? `
                                <button
                                    type="button"
                                    class="message-delete-button"
                                    title="Delete message"
                                >
                                    🗑️
                                </button>
                            `
                            : ""
                    }

                </div>

            </div>
        `;

        article
            .querySelector(
                ".message-delete-button"
            )
            ?.addEventListener(
                "click",
                () =>
                    deleteMessage(
                        message
                    )
            );

        return article;
    }


    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    async function sendMessage() {
        if (
            state.sendingMessage
        ) {
            return;
        }

        if (
            !state.currentChannel
        ) {
            notify(
                "Select a channel first.",
                "warning"
            );

            return;
        }

        const input =
            $("messageInput");

        if (!input) {
            return;
        }

        const content =
            input.value.trim();

        if (!content) {
            return;
        }

        state.sendingMessage =
            true;

        try {
            const result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert({
                        channel_id:
                            state.currentChannel
                                .id,

                        user_id:
                            state.user.id,

                        content,

                        message_type:
                            "text"
                    })
                    .select()
                    .single();

            if (result.error) {
                console.error(
                    "Send message failed:",
                    result.error
                );

                notify(
                    "Unable to send message.",
                    "error"
                );

                return;
            }

            input.value =
                "";

            input.style.height =
                "auto";

        } finally {
            state.sendingMessage =
                false;
        }
    }


    /* ============================================================
       DELETE MESSAGE
       ============================================================ */

    async function deleteMessage(
        message
    ) {
        if (
            String(
                senderId(message)
            ) !==
            String(
                state.user?.id
            )
        ) {
            return;
        }

        if (
            !window.confirm(
                "Delete this message?"
            )
        ) {
            return;
        }

        const result =
            await state.db
                .from(
                    "chat_messages"
                )
                .update({
                    is_deleted:
                        true,

                    deleted_at:
                        new Date()
                            .toISOString(),

                    deleted_by:
                        state.user.id
                })
                .eq(
                    "id",
                    message.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        if (result.error) {
            console.error(
                "Delete message failed:",
                result.error
            );

            notify(
                "Unable to delete message.",
                "error"
            );

            return;
        }

        state.messages =
            state.messages.filter(
                item =>
                    String(
                        item.id
                    ) !==
                    String(
                        message.id
                    )
            );

        renderMessages();
    }


    /* ============================================================
       MESSAGE REALTIME
       ============================================================ */

    function subscribeMessages() {
        if (
            !state.currentChannel
        ) {
            return;
        }

        if (
            state.messageChannel
        ) {
            state.db.removeChannel(
                state.messageChannel
            );

            state.messageChannel =
                null;
        }

        state.messageChannel =
            state.db
                .channel(
                    `mwaniki-channel-${state.currentChannel.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    async payload => {
                        if (
                            state.messages.some(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload
                                            .new
                                            .id
                                    )
                            )
                        ) {
                            return;
                        }

                        if (
                            payload.new
                                .is_deleted
                        ) {
                            return;
                        }

                        state.messages.push(
                            payload.new
                        );

                        await enrichMessages();

                        renderMessages();
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "UPDATE",

                        schema:
                            "public",

                        table:
                            "chat_messages",

                        filter:
                            `channel_id=eq.${state.currentChannel.id}`
                    },
                    async payload => {
                        const index =
                            state.messages.findIndex(
                                message =>
                                    String(
                                        message.id
                                    ) ===
                                    String(
                                        payload
                                            .new
                                            .id
                                    )
                            );

                        if (
                            payload.new
                                .is_deleted
                        ) {
                            if (
                                index >=
                                0
                            ) {
                                state.messages.splice(
                                    index,
                                    1
                                );
                            }
                        } else if (
                            index >=
                            0
                        ) {
                            state.messages[
                                index
                            ] =
                                payload.new;
                        }

                        await enrichMessages();

                        renderMessages();
                    }
                )
                .subscribe(
                    status => {
                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {
                            console.log(
                                "💬 Message realtime: SUBSCRIBED"
                            );
                        }
                    }
                );
    }


    /* ============================================================
       DIRECT MESSAGE
       ============================================================ */

    async function openDirectMessage(
        member
    ) {
        if (
            typeof window.openDirectMessage ===
                "function" &&
            window.openDirectMessage !==
                openDirectMessage
        ) {
            try {
                await window.openDirectMessage(
                    member.userId
                );

                return;
            } catch (error) {
                console.warn(
                    "Existing DM handler failed:",
                    error
                );
            }
        }

        notify(
            `Direct messaging with ${member.name} is separate from calling.`,
            "info"
        );
    }


    /* ============================================================
       CALL ENGINE
       ============================================================ */

    /*
     * IMPORTANT:
     *
     * This file does NOT create a second call engine.
     *
     * community-calls.js remains the real call engine.
     */
    function getCallEngine() {
        return (
            window.MwanikiCalls ||
            window.mwanikiCalls ||
            window.MwanikiCallEngine ||
            null
        );
    }


    async function callMember(
        member
    ) {
        if (
            !member?.userId
        ) {
            notify(
                "This member cannot be called.",
                "warning"
            );

            return;
        }

        if (
            String(
                member.userId
            ) ===
            String(
                state.user?.id
            )
        ) {
            notify(
                "You cannot call yourself.",
                "warning"
            );

            return;
        }

        const calls =
            getCallEngine();

        if (
            calls &&
            typeof calls.callUser ===
                "function"
        ) {
            try {
                await calls.callUser(
                    member.userId,
                    state.currentCommunity
                        ?.id ||
                        null
                );

                return;
            } catch (error) {
                console.error(
                    "Call engine error:",
                    error
                );
            }
        }

        /*
         * Database fallback retained from your existing engine.
         */
        try {
            const roomCode =
                `direct-${crypto.randomUUID()}`;

            const room =
                await state.db
                    .from(
                        "chat_call_rooms"
                    )
                    .insert({
                        community_id:
                            state.currentCommunity
                                ?.id ||
                            null,

                        room_code:
                            roomCode,

                        call_scope:
                            "direct",

                        call_type:
                            "video",

                        status:
                            "waiting",

                        created_by:
                            state.user.id,

                        target_user_id:
                            member.userId,

                        room_status:
                            "ringing",

                        max_participants:
                            2
                    })
                    .select()
                    .single();

            if (room.error) {
                throw room.error;
            }

            const roomId =
                room.data.id;

            await state.db
                .from(
                    "chat_call_participants"
                )
                .insert([
                    {
                        room_id:
                            roomId,

                        user_id:
                            state.user.id,

                        status:
                            "joined",

                        joined_at:
                            new Date()
                                .toISOString()
                    },
                    {
                        room_id:
                            roomId,

                        user_id:
                            member.userId,

                        status:
                            "invited"
                    }
                ]);

            notify(
                `Calling ${member.name}...`,
                "success"
            );

        } catch (error) {
            console.error(
                "Personal call failed:",
                error
            );

            notify(
                "Unable to start the call.",
                "error"
            );
        }
    }


    async function generalCall() {
        const calls =
            getCallEngine();

        if (
            calls &&
            typeof calls.openPicker ===
                "function"
        ) {
            try {
                await calls.openPicker(
                    null
                );

                return;
            } catch (error) {
                console.error(
                    "General call error:",
                    error
                );
            }
        }

        notify(
            "The call engine is still loading.",
            "warning"
        );
    }


    async function communityCall() {
        const communityId =
            state.currentCommunity?.id;

        if (!communityId) {
            return;
        }

        const calls =
            getCallEngine();

        if (
            calls &&
            typeof calls.callCommunity ===
                "function"
        ) {
            try {
                await calls.callCommunity(
                    communityId
                );

                return;
            } catch (error) {
                console.error(
                    "Community call error:",
                    error
                );
            }
        }

        if (
            calls &&
            typeof calls.openPicker ===
                "function"
        ) {
            try {
                await calls.openPicker(
                    communityId
                );

                return;
            } catch (error) {
                console.error(
                    "Community picker error:",
                    error
                );
            }
        }

        notify(
            "The call engine is still loading.",
            "warning"
        );
    }


    /* ============================================================
       ADD CHANNEL
       ============================================================ */

    function slugify(
        value
    ) {
        return String(
            value || ""
        )
            .toLowerCase()
            .trim()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .substring(
                0,
                70
            );
    }


    let dynamicDialog =
        null;


    function createDialog(
        title
    ) {
        closeDynamicDialog();

        const overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "modal-overlay dynamic-community-dialog";

        overlay.innerHTML = `
            <div
                class="dynamic-dialog"
                role="dialog"
                aria-modal="true"
            >

                <div class="dynamic-dialog-header">

                    <strong>
                        ${escapeHTML(
                            title
                        )}
                    </strong>

                    <button
                        type="button"
                        class="dynamic-dialog-close"
                    >
                        ✕
                    </button>

                </div>

            </div>
        `;

        overlay
            .querySelector(
                ".dynamic-dialog-close"
            )
            ?.addEventListener(
                "click",
                closeDynamicDialog
            );

        document.body.appendChild(
            overlay
        );

        dynamicDialog =
            overlay;

        return overlay.querySelector(
            ".dynamic-dialog"
        );
    }


    function closeDynamicDialog() {
        if (
            dynamicDialog
        ) {
            dynamicDialog.remove();

            dynamicDialog =
                null;
        }
    }


    async function openAddChannelDialog() {
        const dialog =
            createDialog(
                "Create a New Channel"
            );

        dialog.innerHTML += `
            <div class="dynamic-form">

                <label>
                    Channel name

                    <input
                        id="newChannelName"
                        type="text"
                        maxlength="80"
                        placeholder="e.g. Pharmacology"
                    >
                </label>

                <label>
                    Description

                    <textarea
                        id="newChannelDescription"
                        rows="3"
                        placeholder="What is this channel for?"
                    ></textarea>
                </label>

                <label>
                    Channel type

                    <select id="newChannelType">

                        <option value="text">
                            Text
                        </option>

                        <option value="announcement">
                            Announcement
                        </option>

                        <option value="study">
                            Study
                        </option>

                        <option value="course">
                            Course
                        </option>

                        <option value="voice">
                            Voice
                        </option>

                    </select>
                </label>

                <label>
                    Icon

                    <input
                        id="newChannelIcon"
                        type="text"
                        maxlength="4"
                        placeholder="#"
                        value="#"
                    >
                </label>

                <label class="dynamic-checkbox">

                    <input
                        id="newChannelPrivate"
                        type="checkbox"
                    >

                    Private channel

                </label>

                <div class="dynamic-dialog-actions">

                    <button
                        type="button"
                        class="secondary-dialog-button"
                        id="cancelNewChannel"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        class="primary-dialog-button"
                        id="createNewChannel"
                    >
                        Create Channel
                    </button>

                </div>

            </div>
        `;

        showDynamicDialog();

        $("cancelNewChannel")
            ?.addEventListener(
                "click",
                closeDynamicDialog
            );

        $("createNewChannel")
            ?.addEventListener(
                "click",
                createChannel
            );

        setTimeout(
            () => {
                $("newChannelName")
                    ?.focus();
            },
            100
        );
    }


    function showDynamicDialog() {
        if (
            !dynamicDialog
        ) {
            return;
        }

        requestAnimationFrame(
            () => {
                dynamicDialog.classList.add(
                    "open"
                );
            }
        );
    }


    async function createChannel() {
        if (
            !state.currentCommunity
        ) {
            notify(
                "Select a community first.",
                "warning"
            );

            return;
        }

        const name =
            $("newChannelName")
                ?.value
                .trim();

        const description =
            $("newChannelDescription")
                ?.value
                .trim() ||
            null;

        const type =
            $("newChannelType")
                ?.value ||
            "text";

        const icon =
            $("newChannelIcon")
                ?.value
                .trim() ||
            "#";

        const privateChannel =
            Boolean(
                $("newChannelPrivate")
                    ?.checked
            );

        if (!name) {
            notify(
                "Enter a channel name.",
                "warning"
            );

            return;
        }

        let position =
            0;

        try {
            const positionResult =
                await state.db
                    .from(
                        "chat_channels"
                    )
                    .select(
                        "position"
                    )
                    .eq(
                        "community_id",
                        state.currentCommunity
                            .id
                    )
                    .order(
                        "position",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(1)
                    .maybeSingle();

            if (
                !positionResult.error &&
                positionResult.data
            ) {
                position =
                    Number(
                        positionResult
                            .data
                            .position
                    ) + 1;
            }
        } catch {
            position =
                state.channels.length;
        }

        const result =
            await state.db
                .from(
                    "chat_channels"
                )
                .insert({
                    community_id:
                        state.currentCommunity
                            .id,

                    name,

                    slug:
                        `${slugify(
                            name
                        )}-${Date.now()
                            .toString(
                                36
                            )}`,

                    description,

                    channel_type:
                        type,

                    icon,

                    position,

                    is_private:
                        privateChannel,

                    is_archived:
                        false,

                    is_active:
                        true,

                    created_by:
                        state.user.id
                })
                .select()
                .single();

        if (result.error) {
            console.error(
                "Create channel failed:",
                result.error
            );

            notify(
                result.error.message ||
                    "Unable to create channel.",
                "error"
            );

            return;
        }

        closeDynamicDialog();

        notify(
            `#${name} created successfully.`,
            "success"
        );

        await loadChannels();

        if (result.data) {
            await selectChannel(
                result.data.id
            );
        }
    }


    /* ============================================================
       PROFILE
       ============================================================ */

    function openProfile() {
        const profile =
            state.profile;

        const dialog =
            createDialog(
                "My Profile"
            );

        dialog.innerHTML += `
            <div class="profile-dialog">

                <div class="profile-dialog-avatar">

                    ${avatarMarkup(
                        profile?.name ||
                            "Student",
                        profile?.photo ||
                            null,
                        "profile-avatar-large"
                    )}

                </div>

                <h2>
                    ${escapeHTML(
                        profile?.name ||
                            "Student"
                    )}
                </h2>

                <p class="profile-email">
                    ${escapeHTML(
                        profile?.email ||
                            ""
                    )}
                </p>

                <div class="profile-details">

                    <div>
                        <span>Course</span>
                        <strong>
                            ${escapeHTML(
                                profile
                                    ?.student
                                    ?.course ||
                                    "Not specified"
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Level</span>
                        <strong>
                            ${escapeHTML(
                                profile
                                    ?.student
                                    ?.level ||
                                    "Not specified"
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Status</span>
                        <strong
                            class="profile-online-status"
                        >
                            ● ${escapeHTML(
                                presenceLabel(
                                    state.currentPresenceStatus
                                )
                            )}
                        </strong>
                    </div>

                </div>

                <div class="dynamic-dialog-actions">

                    <button
                        type="button"
                        class="secondary-dialog-button"
                        id="closeProfileDialog"
                    >
                        Close
                    </button>

                    <button
                        type="button"
                        class="primary-dialog-button"
                        id="openFullProfile"
                    >
                        Open Full Profile
                    </button>

                </div>

            </div>
        `;

        showDynamicDialog();

        $("closeProfileDialog")
            ?.addEventListener(
                "click",
                closeDynamicDialog
            );

        $("openFullProfile")
            ?.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./profile.html";
                }
            );
    }


    /* ============================================================
       CONTEST / COURSE SELECTOR
       ============================================================ */

    async function loadCourses() {
        const result =
            await state.db
                .from("courses")
                .select(
                    "id,title,description,image"
                )
                .order(
                    "title",
                    {
                        ascending:
                            true
                    }
                );

        if (result.error) {
            console.error(
                "Courses failed:",
                result.error
            );

            state.courses =
                [];

            return;
        }

        state.courses =
            result.data || [];
    }


    async function openContestChooser() {
        await loadCourses();

        const dialog =
            createDialog(
                "Course Contests"
            );

        dialog.innerHTML += `
            <div class="dynamic-form">

                <div class="contest-heading">

                    <span class="contest-heading-icon">
                        🏆
                    </span>

                    <div>
                        <strong>
                            Choose Your Course
                        </strong>

                        <p>
                            Select a medical course
                            to open its quiz material.
                        </p>
                    </div>

                </div>

                <label>
                    Course

                    <select
                        id="contestCourseSelect"
                    >

                        <option value="">
                            Select a course
                        </option>

                        ${state.courses
                            .map(
                                course => `
                                    <option
                                        value="${escapeAttr(
                                            course.id
                                        )}"
                                    >
                                        ${escapeHTML(
                                            course.title
                                        )}
                                    </option>
                                `
                            )
                            .join("")}

                    </select>

                </label>

                <div
                    id="contestCourseContent"
                    class="contest-course-content"
                >
                    <div class="picker-empty">
                        Select a course above.
                    </div>
                </div>

                <div class="dynamic-dialog-actions">

                    <button
                        type="button"
                        class="secondary-dialog-button"
                        id="closeContestChooser"
                    >
                        Close
                    </button>

                </div>

            </div>
        `;

        showDynamicDialog();

        $("closeContestChooser")
            ?.addEventListener(
                "click",
                closeDynamicDialog
            );

        $("contestCourseSelect")
            ?.addEventListener(
                "change",
                event =>
                    loadCourseContestMaterial(
                        event.target.value
                    )
            );
    }


    async function loadCourseContestMaterial(
        courseId
    ) {
        const container =
            $("contestCourseContent");

        if (!container) {
            return;
        }

        if (!courseId) {
            container.innerHTML = `
                <div class="picker-empty">
                    Select a course above.
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="picker-empty">
                Loading course questions...
            </div>
        `;

        let questions =
            [];

        const questionResult =
            await state.db
                .from(
                    "quiz_questions"
                )
                .select(
                    "id,course_id,unit_id,question,option_a,option_b,option_c,option_d,correct_answer"
                )
                .eq(
                    "course_id",
                    courseId
                )
                .limit(100);

        if (
            !questionResult.error &&
            questionResult.data?.length
        ) {
            questions =
                questionResult.data;
        } else {
            const fallback =
                await state.db
                    .from("quizzes")
                    .select(
                        "id,course_id,question,option_a,option_b,option_c,option_d,correct_answer"
                    )
                    .eq(
                        "course_id",
                        courseId
                    )
                    .limit(100);

            if (
                !fallback.error
            ) {
                questions =
                    fallback.data ||
                    [];
            }
        }

        const course =
            state.courses.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        courseId
                    )
            );

        if (
            !questions.length
        ) {
            container.innerHTML = `
                <div class="picker-empty">

                    <strong>
                        No questions found.
                    </strong>

                    <span>
                        This course currently
                        has no quiz questions.
                    </span>

                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="contest-preview">

                <div class="contest-course-title">
                    ${escapeHTML(
                        course?.title ||
                            "Selected Course"
                    )}
                </div>

                <div class="contest-stat">

                    <span>
                        Questions
                    </span>

                    <strong>
                        ${questions.length}
                    </strong>

                </div>

                <div class="contest-question-preview">

                    ${questions
                        .slice(0, 5)
                        .map(
                            (
                                question,
                                index
                            ) => `
                                <div>

                                    <b>
                                        ${index +
                                        1}.
                                    </b>

                                    <span>
                                        ${escapeHTML(
                                            question.question
                                        )}
                                    </span>

                                </div>
                            `
                        )
                        .join("")}

                </div>

                <button
                    type="button"
                    class="contest-start-button"
                    id="startCourseQuiz"
                >
                    Start ${escapeHTML(
                        course?.title ||
                            "Course"
                    )} Quiz
                </button>

            </div>
        `;

        $("startCourseQuiz")
            ?.addEventListener(
                "click",
                () => {
                    window.location.href =
                        `./quiz.html?course=${encodeURIComponent(
                            courseId
                        )}`;
                }
            );
    }


    /* ============================================================
       CHANNEL SEARCH
       ============================================================ */

    function searchChannels(
        value
    ) {
        const query =
            String(
                value || ""
            )
                .trim()
                .toLowerCase();

        document
            .querySelectorAll(
                "#informationChannels .channel-button, " +
                "#courseChannels .channel-button, " +
                "#communityChannels .channel-button"
            )
            .forEach(
                button => {
                    const name =
                        button.textContent
                            .toLowerCase();

                    button.style.display =
                        !query ||
                        name.includes(
                            query
                        )
                            ? ""
                            : "none";
                }
            );
    }


    function searchMembers(
        value
    ) {
        renderMembers(
            value
        );
    }


    function searchMessages(
        value
    ) {
        const query =
            String(
                value || ""
            )
                .trim()
                .toLowerCase();

        document
            .querySelectorAll(
                "#messageList .message-item"
            )
            .forEach(
                message => {
                    const matches =
                        message.textContent
                            .toLowerCase()
                            .includes(
                                query
                            );

                    message.style.display =
                        !query ||
                        matches
                            ? ""
                            : "none";
                }
            );
    }


    /* ============================================================
       HOME BUTTON
       ============================================================ */

    function setupHomeButton() {
        const button =
            $("communityHomeButton");

        if (button) {
            button.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./dashboard.html";
                }
            );
        }

        const actions =
            document.querySelector(
                ".community-header-actions"
            );

        if (
            actions &&
            !document.getElementById(
                "communityHomeNavButton"
            )
        ) {
            const home =
                document.createElement(
                    "button"
                );

            home.type =
                "button";

            home.id =
                "communityHomeNavButton";

            home.className =
                "header-home-button";

            home.innerHTML = `
                <span>⌂</span>
                <span>Home</span>
            `;

            home.title =
                "Back to dashboard";

            home.addEventListener(
                "click",
                () => {
                    window.location.href =
                        "./dashboard.html";
                }
            );

            actions.insertBefore(
                home,
                actions.firstChild
            );
        }
    }


    /* ============================================================
       EVENT BINDINGS
       ============================================================ */

    function bindEvents() {
        setupHomeButton();

        $("generalCallButton")
            ?.addEventListener(
                "click",
                generalCall
            );

        $("communityCallButton")
            ?.addEventListener(
                "click",
                communityCall
            );

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
                event => {
                    event.target.style.height =
                        "auto";

                    event.target.style.height =
                        Math.min(
                            event.target
                                .scrollHeight,
                            180
                        ) +
                        "px";
                }
            );

        $("memberSearchInput")
            ?.addEventListener(
                "input",
                event =>
                    searchMembers(
                        event.target.value
                    )
            );

        $("channelSearchInput")
            ?.addEventListener(
                "input",
                event =>
                    searchChannels(
                        event.target.value
                    )
            );

        $("channelMembersButton")
            ?.addEventListener(
                "click",
                () =>
                    $("memberSidebar")
                        ?.classList.toggle(
                            "open"
                        )
            );

        $("closeMemberSidebarButton")
            ?.addEventListener(
                "click",
                () =>
                    $("memberSidebar")
                        ?.classList.remove(
                            "open"
                        )
            );

        $("communityMenuButton")
            ?.addEventListener(
                "click",
                openAddChannelDialog
            );

        $("addCommunityButton")
            ?.addEventListener(
                "click",
                openAddChannelDialog
            );

        $("profileButton")
            ?.addEventListener(
                "click",
                openProfile
            );

        $("contestChannelButton")
            ?.addEventListener(
                "click",
                openContestChooser
            );

        $("mobileSidebarButton")
            ?.addEventListener(
                "click",
                () =>
                    $("channelSidebar")
                        ?.classList.toggle(
                            "open"
                        )
            );

        $("channelSearchButton")
            ?.addEventListener(
                "click",
                () => {
                    show(
                        $("messageSearchBar")
                    );

                    $("messageSearchInput")
                        ?.focus();
                }
            );

        $("closeMessageSearchButton")
            ?.addEventListener(
                "click",
                () => {
                    hide(
                        $("messageSearchBar")
                    );

                    const input =
                        $("messageSearchInput");

                    if (input) {
                        input.value =
                            "";
                    }

                    searchMessages(
                        ""
                    );
                }
            );

        $("messageSearchInput")
            ?.addEventListener(
                "input",
                event =>
                    searchMessages(
                        event.target.value
                    )
            );

        /*
         * Attachments.
         *
         * We retain your existing safe behavior instead of
         * inventing database columns that are not in the schema.
         */
        $("attachButton")
            ?.addEventListener(
                "click",
                () =>
                    notify(
                        "Attachment upload requires the configured chat storage bucket.",
                        "info"
                    )
            );

        /*
         * Emoji.
         */
        $("emojiButton")
            ?.addEventListener(
                "click",
                () =>
                    openEmojiPanel()
            );

        $("closeEmojiButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("emojiPanel")
                    )
            );

        /*
         * Stickers.
         */
        $("stickerButton")
            ?.addEventListener(
                "click",
                () => {
                    hide(
                        $("emojiPanel")
                    );

                    hide(
                        $("gifPanel")
                    );

                    show(
                        $("stickerPanel")
                    );
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

        /*
         * GIF.
         */
        $("gifButton")
            ?.addEventListener(
                "click",
                () => {
                    hide(
                        $("emojiPanel")
                    );

                    hide(
                        $("stickerPanel")
                    );

                    show(
                        $("gifPanel")
                    );
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

        /*
         * Voice.
         */
        $("voiceNoteButton")
            ?.addEventListener(
                "click",
                toggleVoiceNote
            );

        /*
         * Close pickers when clicking outside.
         */
        document.addEventListener(
            "click",
            event => {
                const picker =
                    event.target.closest(
                        ".picker-panel"
                    );

                const button =
                    event.target.closest(
                        "#emojiButton,#stickerButton,#gifButton"
                    );

                if (
                    !picker &&
                    !button
                ) {
                    hide(
                        $("emojiPanel")
                    );

                    hide(
                        $("stickerPanel")
                    );

                    hide(
                        $("gifPanel")
                    );
                }
            }
        );
    }


    /* ============================================================
       EMOJI
       ============================================================ */

    const EMOJIS = [
        "😀","😃","😄","😁","😆","😅",
        "😂","🤣","😊","🙂","😉","😍",
        "🥰","😘","😎","🤓","🤔","😐",
        "🙄","😮","😴","🤗","🤩","🥳",
        "😭","😢","😡","🤬","👍","👎",
        "👏","🙌","🙏","❤️","🔥","🎉",
        "✨","⭐","💯","🎓","📚","🧪",
        "🔬","🧬","🩺","💉","💊","🩸",
        "🧠","🫀","🫁","🦠","🧫","📖",
        "✏️","💡","✅"
    ];


    function openEmojiPanel() {
        hide(
            $("stickerPanel")
        );

        hide(
            $("gifPanel")
        );

        const grid =
            $("emojiGrid");

        if (grid) {
            grid.innerHTML =
                EMOJIS.map(
                    emoji => `
                        <button
                            type="button"
                            class="emoji-item"
                        >
                            ${emoji}
                        </button>
                    `
                ).join("");

            grid
                .querySelectorAll(
                    ".emoji-item"
                )
                .forEach(
                    button =>
                        button.addEventListener(
                            "click",
                            () =>
                                insertEmoji(
                                    button.textContent
                                        .trim()
                                )
                        )
                );
        }

        show(
            $("emojiPanel")
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

        input.focus();

        input.selectionStart =
            input.selectionEnd =
                start +
                emoji.length;
    }


    /* ============================================================
       VOICE NOTE
       ============================================================ */

    async function toggleVoiceNote() {
        if (
            state.recording
        ) {
            stopRecording();
        } else {
            await startRecording();
        }
    }


    async function startRecording() {
        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices
                .getUserMedia
        ) {
            notify(
                "Voice recording is not supported.",
                "error"
            );

            return;
        }

        if (
            !state.currentChannel
        ) {
            notify(
                "Select a channel first.",
                "warning"
            );

            return;
        }

        try {
            state.recordingStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio:
                            true
                    });

            state.recordingChunks =
                [];

            state.mediaRecorder =
                new MediaRecorder(
                    state.recordingStream
                );

            state.mediaRecorder
                .ondataavailable =
                event => {
                    if (
                        event.data?.size
                    ) {
                        state.recordingChunks.push(
                            event.data
                        );
                    }
                };

            state.mediaRecorder
                .onstop =
                async () => {
                    const blob =
                        new Blob(
                            state.recordingChunks,
                            {
                                type:
                                    state
                                        .mediaRecorder
                                        ?.mimeType ||
                                    "audio/webm"
                            }
                        );

                    state.recordingStream
                        ?.getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    state.recordingStream =
                        null;

                    if (
                        blob.size
                    ) {
                        notify(
                            "Voice recording complete. Configure the chat storage bucket to send it.",
                            "info"
                        );
                    }
                };

            state.mediaRecorder.start();

            state.recording =
                true;

            const button =
                $("voiceNoteButton");

            if (button) {
                button.textContent =
                    "⏹";

                button.classList.add(
                    "recording"
                );
            }

            notify(
                "Recording...",
                "info"
            );

        } catch (error) {
            console.error(
                "Microphone error:",
                error
            );

            notify(
                "Microphone access was denied.",
                "error"
            );
        }
    }


    function stopRecording() {
        if (
            state.mediaRecorder &&
            state.recording
        ) {
            state.recording =
                false;

            state.mediaRecorder.stop();
        }

        const button =
            $("voiceNoteButton");

        if (button) {
            button.textContent =
                "🎙️";

            button.classList.remove(
                "recording"
            );
        }
    }


    /* ============================================================
       AUTH LISTENER
       ============================================================ */

    function listenForAuth() {
        state.db.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {
                if (
                    event ===
                    "SIGNED_OUT"
                ) {
                    stopPresence();

                    window.location.href =
                        "./index.html";

                    return;
                }

                if (
                    session?.user
                ) {
                    state.user =
                        session.user;

                    await loadProfile();

                    /*
                     * If the auth session changes to another
                     * authenticated user, restart presence for
                     * the new account.
                     */
                    state.lastActivity =
                        Date.now();

                    state.currentPresenceStatus =
                        "online";

                    startPresence();

                    await loadMembers();
                }
            }
        );
    }


    /* ============================================================
       START
       ============================================================ */

    async function start() {
        if (
            state.initialized
        ) {
            return;
        }

        state.initialized =
            true;

        try {
            console.log(
                "🚀 Mwaniki Scholars Community starting..."
            );

            await waitForSupabase();

            await loadUser();

            await loadProfile();

            bindEvents();

            listenForAuth();

            /*
             * Start presence BEFORE loading the communities.
             *
             * This allows the current user to establish their
             * Online heartbeat immediately.
             */
            startPresence();

            await loadCommunities();

            /*
             * One final refresh after the community/member list
             * has been populated.
             */
            await refreshMemberPresence();

            console.log(
                "✅ Mwaniki Scholars Community loaded."
            );

        } catch (error) {
            console.error(
                "❌ Community startup failed:",
                error
            );

            notify(
                error?.message ||
                    "Unable to load community.",
                "error"
            );
        }
    }


    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.MwanikiCommunity = {
        state,

        selectCommunity,
        selectChannel,

        loadMembers,
        loadMessages,
        refreshMemberPresence,

        sendMessage,
        deleteMessage,

        callMember,
        generalCall,
        communityCall,

        openDirectMessage,
        openAddChannelDialog,
        openContestChooser,

        writePresence,

        /*
         * Expose these for controlled debugging/testing.
         */
        startPresence,
        stopPresence,
        calculatePresence,
        getPresenceStatus
    };


    /* ============================================================
       DOM READY
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once:
                    true
            }
        );
    } else {
        start();
    }

})();
