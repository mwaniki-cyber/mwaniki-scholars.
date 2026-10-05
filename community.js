/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   CLEAN COMMUNITY ENGINE
   ============================================================ */

(() => {
    "use strict";

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

        messageChannel: null,
        presenceChannel: null,

        presenceTimer: null,
        presenceVisibilityHandler: null,

        initialized: false,
        loadingMessages: false,
        sendingMessage: false,

        recording: false,
        mediaRecorder: null,
        recordingStream: null,
        recordingChunks: [],

        contests: [],
        courses: []
    };


    /* ============================================================
       DOM
       ============================================================ */

    const $ = id => document.getElementById(id);

    function show(el) {
        if (el) el.classList.remove("hidden");
    }

    function hide(el) {
        if (el) el.classList.add("hidden");
    }

    function text(id, value) {
        const el = $(id);
        if (el) el.textContent = value ?? "";
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

    function notify(message, type = "info") {
        const el = $("toast");

        if (!el) {
            console.log(`[Community ${type}] ${message}`);
            return;
        }

        el.textContent = message;
        el.dataset.type = type;

        show(el);

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            hide(el);
        }, 3500);
    }


    /* ============================================================
       AVATARS
       ============================================================ */

    function validImage(url) {
        if (!url || typeof url !== "string") {
            return false;
        }

        const value = url.trim();

        return (
            /^https?:\/\//i.test(value) ||
            /^data:image\//i.test(value) ||
            /^blob:/i.test(value)
        );
    }

    function initials(name) {
        const parts = String(name || "Student")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) return "S";

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

    function avatarMarkup(name, url, className = "") {
        const safeName = escapeAttr(name || "Student");

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
                    ${escapeHTML(initials(name))}
                </span>
            `;
        }

        return `
            <span class="${className} avatar-fallback">
                ${escapeHTML(initials(name))}
            </span>
        `;
    }


    /* ============================================================
       SUPABASE
       ============================================================ */

    async function waitForSupabase() {
        for (let i = 0; i < 100; i++) {
            const client =
                window.supabaseClient ||
                window.mwanikiSupabase ||
                window.sb ||
                window.supabase;

            if (
                client &&
                client.auth &&
                typeof client.from === "function"
            ) {
                state.db = client;

                console.log(
                    "✅ Community: Supabase client ready."
                );

                return client;
            }

            await new Promise(resolve =>
                setTimeout(resolve, 100)
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

        state.user = result.data.user;

        console.log(
            "✅ Community authenticated user:",
            state.user.id
        );
    }


    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadProfile() {
        let profile = null;

        /*
         * chat_public_profiles.id is the profile UUID.
         * In this schema we do NOT query user_id because
         * that column does not exist.
         */

        try {
            const result =
                await state.db
                    .from("chat_public_profiles")
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

            if (!result.error && result.data) {
                profile = result.data;
            }
        } catch (error) {
            console.warn(
                "Public profile lookup failed:",
                error
            );
        }

        /*
         * Students also use id as the UUID.
         */

        let student = null;

        try {
            const result =
                await state.db
                    .from("students")
                    .select("*")
                    .eq("id", state.user.id)
                    .maybeSingle();

            if (!result.error && result.data) {
                student = result.data;
            }
        } catch (error) {
            console.warn(
                "Student profile lookup failed:",
                error
            );
        }

        const metadata =
            state.user.user_metadata || {};

        const name =
            profile?.full_name ||
            student?.full_name ||
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            metadata.username ||
            state.user.email?.split("@")[0] ||
            "Student";

        const photo =
            profile?.photo_url ||
            student?.photo_url ||
            metadata.avatar_url ||
            metadata.picture ||
            null;

        state.profile = {
            id: state.user.id,
            name,
            photo,
            publicProfile: profile,
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

        text(
            "headerProfileName",
            name
        );

        if (!image) return;

        if (validImage(state.profile?.photo)) {
            image.src =
                state.profile.photo;

            image.alt = name;
            image.style.display =
                "block";
        } else {
            image.removeAttribute("src");
            image.alt = name;
        }
    }


    /* ============================================================
       COMMUNITY ICONS
       ============================================================ */

    function getCommunityIcon(community) {
        const value =
            community?.icon_url;

        /*
         * Only real URLs become images.
         */

        if (validImage(value)) {
            return `
                <img
                    src="${escapeAttr(value)}"
                    class="community-icon-image"
                    alt=""
                >
            `;
        }

        const name =
            `${community?.name || ""} ${community?.slug || ""}`
                .toLowerCase();

        if (name.includes("gaming")) {
            return "🎮";
        }

        if (
            name.includes("meme") ||
            name.includes("memes")
        ) {
            return "😂";
        }

        if (name.includes("mwaniki")) {
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
                .from("chat_communities")
                .select("*")
                .eq("is_active", true)
                .order("name", {
                    ascending: true
                });

        if (result.error) {
            console.error(
                "Community query failed:",
                result.error
            );

            throw result.error;
        }

        state.communities =
            result.data || [];

        state.communities.sort(
            (a, b) => {
                const aMain =
                    String(a.name || "")
                        .toLowerCase()
                        .includes("mwaniki");

                const bMain =
                    String(b.name || "")
                        .toLowerCase()
                        .includes("mwaniki");

                if (aMain && !bMain) return -1;
                if (!aMain && bMain) return 1;

                return String(
                    a.name || ""
                ).localeCompare(
                    String(b.name || "")
                );
            }
        );

        renderCommunityRail();

        if (!state.communities.length) {
            notify(
                "No active communities were found.",
                "warning"
            );
            return;
        }

        const main =
            state.communities.find(
                community =>
                    String(
                        community.name || ""
                    )
                        .toLowerCase()
                        .includes("mwaniki")
            ) ||
            state.communities[0];

        await selectCommunity(
            main.id
        );
    }

    function renderCommunityRail() {
        const rail =
            $("communityRailList");

        if (!rail) return;

        rail.innerHTML = "";

        state.communities.forEach(
            community => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";
                button.className =
                    "community-rail-item";

                if (
                    state.currentCommunity &&
                    String(
                        state.currentCommunity.id
                    ) ===
                        String(community.id)
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

        if (!community) return;

        const icon =
            $("selectedCommunityIcon");

        if (icon) {
            icon.innerHTML =
                getCommunityIcon(
                    community
                );
        }

        text(
            "selectedCommunityName",
            community.name ||
                "Community"
        );

        text(
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
        if (!state.currentCommunity) {
            return;
        }

        const result =
            await state.db
                .from("chat_channels")
                .select("*")
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .eq("is_active", true)
                .eq("is_archived", false)
                .order("position", {
                    ascending: true
                })
                .order("created_at", {
                    ascending: true
                });

        if (result.error) {
            console.error(
                "Channel loading failed:",
                result.error
            );

            state.channels = [];

            renderChannels();

            return;
        }

        state.channels =
            result.data || [];

        renderChannels();

        if (!state.channels.length) {
            state.currentChannel = null;

            text(
                "currentChannelName",
                "discussion"
            );

            text(
                "currentChannelDescription",
                "No channels available"
            );

            return;
        }

        const preferred =
            state.channels.find(
                channel => {
                    const value =
                        `${channel.name || ""} ${channel.slug || ""}`
                            .toLowerCase();

                    return (
                        value.includes(
                            "discussion"
                        ) ||
                        value.includes(
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

    function channelGroup(channel) {
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
            channel.name
                ?.toLowerCase()
                .includes("announcement") ||
            channel.name
                ?.toLowerCase()
                .includes("rules") ||
            channel.name
                ?.toLowerCase()
                .includes("welcome")
        ) {
            return "information";
        }

        return "discussion";
    }

    function channelIcon(channel) {
        if (
            channel.icon &&
            !validImage(channel.icon)
        ) {
            return channel.icon;
        }

        if (
            channel.channel_type ===
            "announcement"
        ) {
            return "📢";
        }

        if (
            channel.channel_type ===
            "study"
        ) {
            return "📖";
        }

        if (
            channel.channel_type ===
            "course"
        ) {
            return "📚";
        }

        if (
            channel.channel_type ===
            "voice"
        ) {
            return "🔊";
        }

        return "#";
    }

    function renderChannels() {
        const info =
            $("informationChannels");

        const courses =
            $("courseChannels");

        const discussion =
            $("communityChannels");

        if (info) info.innerHTML = "";
        if (courses) courses.innerHTML = "";
        if (discussion) discussion.innerHTML = "";

        state.channels.forEach(
            channel => {
                const button =
                    document.createElement(
                        "button"
                    );

                button.type = "button";
                button.className =
                    "channel-button";

                if (
                    state.currentChannel &&
                    String(
                        state.currentChannel.id
                    ) ===
                        String(channel.id)
                ) {
                    button.classList.add(
                        "active"
                    );
                }

                button.dataset.channelName =
                    channel.name || "";

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
       CHANNEL SELECTION
       ============================================================ */

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
                    String(item.id) ===
                    String(channelId)
            );

        if (!channel) return;

        state.currentChannel =
            channel;

        renderChannels();

        text(
            "currentChannelName",
            channel.name
        );

        text(
            "currentChannelDescription",
            channel.description ||
                "Community discussion"
        );

        const icon =
            $("currentChannelIcon");

        if (icon) {
            icon.textContent =
                channelIcon(channel);
        }

        await loadMessages();

        subscribeMessages();
    }


    /* ============================================================
       MEMBERS
       ============================================================ */

    async function loadMembers() {
        if (!state.currentCommunity) {
            return;
        }

        const membership =
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

        if (membership.error) {
            console.error(
                "Member query failed:",
                membership.error
            );

            state.members = [];

            renderMembers();

            return;
        }

        const rows =
            membership.data || [];

        if (!rows.length) {
            state.members = [];

            /*
             * Still show current user if
             * membership is not populated.
             */

            state.members.push({
                userId: state.user.id,
                name:
                    state.profile?.name ||
                    "You",
                photo:
                    state.profile?.photo ||
                    null,
                status: "online",
                customStatus: "",
                role: "student"
            });

            renderMembers();

            return;
        }

        const userIds =
            rows
                .map(row => row.user_id)
                .filter(Boolean);

        /*
         * Public profiles use id.
         */

        let profiles = [];

        if (userIds.length) {
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
                    result.data || [];
            }
        }

        /*
         * Students use id.
         */

        let students = [];

        if (userIds.length) {
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
                    result.data || [];
            }
        }

        /*
         * Presence.
         */

        let presence = [];

        if (userIds.length) {
            const result =
                await state.db
                    .from("chat_presence")
                    .select(
                        "user_id,status,custom_status,last_seen_at,updated_at"
                    )
                    .in(
                        "user_id",
                        userIds
                    );

            if (!result.error) {
                presence =
                    result.data || [];
            }
        }

        state.members =
            rows.map(member => {
                const userId =
                    member.user_id;

                const profile =
                    profiles.find(
                        item =>
                            String(item.id) ===
                            String(userId)
                    );

                const student =
                    students.find(
                        item =>
                            String(item.id) ===
                            String(userId)
                    );

                const live =
                    presence.find(
                        item =>
                            String(
                                item.user_id
                            ) ===
                            String(userId)
                    );

                const lastSeen =
                    live?.last_seen_at ||
                    member.last_seen_at ||
                    null;

                return {
                    membership: member,

                    userId,

                    name:
                        profile?.full_name ||
                        student?.full_name ||
                        member.display_name ||
                        member.nickname ||
                        "Student",

                    photo:
                        profile?.photo_url ||
                        student?.photo_url ||
                        member.avatar_url ||
                        null,

                    status:
                        calculatePresence(
                            live,
                            lastSeen
                        ),

                    customStatus:
                        live?.custom_status ||
                        "",

                    role:
                        member.role ||
                        "student",

                    lastSeen
                };
            });

        renderMembers();
    }

    function calculatePresence(
        presence,
        lastSeen
    ) {
        if (!presence && !lastSeen) {
            return "offline";
        }

        const status =
            presence?.status;

        if (status === "dnd") {
            return "dnd";
        }

        if (
            status === "away"
        ) {
            return "away";
        }

        if (!lastSeen) {
            return "offline";
        }

        const timestamp =
            new Date(lastSeen)
                .getTime();

        if (!Number.isFinite(timestamp)) {
            return "offline";
        }

        const age =
            Date.now() -
            timestamp;

        /*
         * 45 seconds is the liveness
         * threshold.
         */

        if (age <= 45000) {
            return "online";
        }

        if (age <= 180000) {
            return "away";
        }

        return "offline";
    }

    function statusLabel(status) {
        switch (status) {
            case "online":
                return "Online";

            case "away":
                return "Away";

            case "dnd":
                return "Do Not Disturb";

            default:
                return "Offline";
        }
    }

    function renderMembers(
        searchValue = ""
    ) {
        const container =
            $("memberList");

        if (!container) return;

        const query =
            String(searchValue || "")
                .trim()
                .toLowerCase();

        const visible =
            state.members.filter(
                member =>
                    !query ||
                    String(
                        member.name || ""
                    )
                        .toLowerCase()
                        .includes(query)
            );

        text(
            "memberCount",
            state.members.length
        );

        container.innerHTML = "";

        if (!visible.length) {
            container.innerHTML = `
                <div class="member-empty">
                    No members found.
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

                row.className =
                    "member-row";

                const self =
                    String(
                        member.userId
                    ) ===
                    String(
                        state.user?.id
                    );

                const status =
                    member.status ||
                    "offline";

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
                                statusLabel(
                                    status
                                )
                            )}"
                        ></span>
                    </div>

                    <div class="member-info">
                        <strong>
                            ${escapeHTML(
                                member.name
                            )}
                        </strong>

                        <span class="member-status-text">
                            ${
                                member.customStatus
                                    ? escapeHTML(
                                          member.customStatus
                                      )
                                    : escapeHTML(
                                          statusLabel(
                                              status
                                          )
                                      )
                            }
                        </span>
                    </div>

                    <div class="member-actions">
                        ${
                            self
                                ? `
                                    <span class="member-you">
                                        You
                                    </span>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="member-action-button dm-member-button"
                                        title="Message ${escapeAttr(
                                            member.name
                                        )}"
                                    >💬</button>

                                    <button
                                        type="button"
                                        class="member-action-button call-member-button"
                                        title="Call ${escapeAttr(
                                            member.name
                                        )}"
                                    >📞</button>
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
       REAL PRESENCE
       ============================================================ */

    async function writePresence(
        status
    ) {
        if (!state.user) return;

        /*
         * Actual schema:
         *
         * user_id
         * status
         * custom_status
         * last_seen_at
         * updated_at
         */

        const now =
            new Date().toISOString();

        const payload = {
            user_id:
                state.user.id,

            status,

            last_seen_at:
                now,

            updated_at:
                now
        };

        const result =
            await state.db
                .from("chat_presence")
                .upsert(
                    payload,
                    {
                        onConflict:
                            "user_id"
                    }
                );

        if (result.error) {
            console.error(
                "Presence write failed:",
                result.error
            );

            return;
        }

        /*
         * Keep the community membership
         * status synchronized too.
         */

        if (
            state.currentCommunity
        ) {
            await state.db
                .from(
                    "chat_community_members"
                )
                .update({
                    status:
                        status === "online"
                            ? "online"
                            : "offline",

                    last_seen_at:
                        now,

                    last_active_at:
                        now
                })
                .eq(
                    "community_id",
                    state.currentCommunity.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );
        }
    }

    function startPresence() {
        stopPresence();

        writePresence("online");

        state.presenceTimer =
            setInterval(
                () => {
                    if (
                        document.hidden
                    ) {
                        writePresence(
                            "away"
                        );
                    } else {
                        writePresence(
                            "online"
                        );
                    }
                },
                15000
            );

        state.presenceVisibilityHandler =
            () => {
                writePresence(
                    document.hidden
                        ? "away"
                        : "online"
                );
            };

        document.addEventListener(
            "visibilitychange",
            state.presenceVisibilityHandler
        );

        window.addEventListener(
            "focus",
            () =>
                writePresence(
                    "online"
                )
        );

        window.addEventListener(
            "blur",
            () =>
                writePresence(
                    "away"
                )
        );

        window.addEventListener(
            "beforeunload",
            () => {
                /*
                 * sendBeacon is unreliable with
                 * Supabase REST here, so do not
                 * block page unloading.
                 */
            }
        );
    }

    function stopPresence() {
        if (state.presenceTimer) {
            clearInterval(
                state.presenceTimer
            );

            state.presenceTimer =
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
    }

    function subscribePresence() {
        if (state.presenceChannel) {
            state.db.removeChannel(
                state.presenceChannel
            );
        }

        state.presenceChannel =
            state.db
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
                    async payload => {
                        updateLocalPresence(
                            payload
                        );

                        await refreshMemberPresence();
                    }
                )
                .subscribe(
                    status => {
                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {
                            console.log(
                                "Community presence realtime: SUBSCRIBED"
                            );
                        }
                    }
                );
    }

    function updateLocalPresence(
        payload
    ) {
        const row =
            payload.new;

        if (!row?.user_id) return;

        const member =
            state.members.find(
                item =>
                    String(
                        item.userId
                    ) ===
                    String(
                        row.user_id
                    )
            );

        if (!member) return;

        member.status =
            calculatePresence(
                row,
                row.last_seen_at
            );

        member.customStatus =
            row.custom_status ||
            "";
    }

    async function refreshMemberPresence() {
        if (!state.members.length) {
            return;
        }

        const ids =
            state.members
                .map(
                    member =>
                        member.userId
                )
                .filter(Boolean);

        if (!ids.length) return;

        const result =
            await state.db
                .from("chat_presence")
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

        const now =
            Date.now();

        state.members.forEach(
            member => {
                const row =
                    (result.data || [])
                        .find(
                            item =>
                                String(
                                    item.user_id
                                ) ===
                                String(
                                    member.userId
                                )
                        );

                if (!row) {
                    member.status =
                        "offline";

                    return;
                }

                member.status =
                    calculatePresence(
                        row,
                        row.last_seen_at
                    );

                member.customStatus =
                    row.custom_status ||
                    "";
            }
        );

        renderMembers(
            $("memberSearchInput")
                ?.value || ""
        );
    }


    /* ============================================================
       MESSAGES
       ============================================================ */

    function senderId(message) {
        return (
            message.user_id ||
            message.sender_id ||
            null
        );
    }

    function messageContent(message) {
        return (
            message.content ||
            ""
        );
    }

    async function loadMessages() {
        if (!state.currentChannel) {
            return;
        }

        const list =
            $("messageList");

        if (list) {
            list.innerHTML = "";
        }

        show(
            $("messageLoading")
        );

        state.loadingMessages =
            true;

        try {
            const result =
                await state.db
                    .from("chat_messages")
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
                            ascending: true
                        }
                    )
                    .limit(150);

            if (result.error) {
                console.error(
                    "Message loading failed:",
                    result.error
                );

                state.messages = [];

                renderMessages();

                return;
            }

            state.messages =
                result.data || [];

            await enrichMessages();

            renderMessages();
        } finally {
            state.loadingMessages =
                false;

            hide(
                $("messageLoading")
            );
        }
    }

    async function enrichMessages() {
        if (!state.messages.length) {
            return;
        }

        const ids =
            [
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

        if (!ids.length) return;

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

        const profiles =
            profileResult.error
                ? []
                : profileResult.data ||
                  [];

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

        const students =
            studentResult.error
                ? []
                : studentResult.data ||
                  [];

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
                            ? state.profile?.name
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

    function formatTime(value) {
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

    function renderMessages() {
        const list =
            $("messageList");

        if (!list) return;

        list.innerHTML = "";

        if (!state.messages.length) {
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
            senderId(message);

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
            messageContent(message);

        const attachment =
            message.attachment_url ||
            message.file_url ||
            message.media_url ||
            null;

        const attachmentName =
            message.attachment_name ||
            message.file_name ||
            "Attachment";

        const messageType =
            message.message_type ||
            "text";

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
                        ${escapeHTML(name)}
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

                ${
                    messageType ===
                        "voice" &&
                    attachment
                        ? `
                            <audio
                                class="voice-message-player"
                                controls
                                src="${escapeAttr(
                                    attachment
                                )}"
                            ></audio>
                        `
                        : ""
                }

                ${
                    attachment &&
                    messageType !==
                        "voice"
                        ? `
                            <a
                                class="message-attachment"
                                href="${escapeAttr(
                                    attachment
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                📎
                                ${escapeHTML(
                                    attachmentName
                                )}
                            </a>
                        `
                        : ""
                }

                <div class="message-actions">

                    <button
                        type="button"
                        class="message-reaction-button"
                        title="React"
                    >
                        😊
                    </button>

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
        if (state.sendingMessage) {
            return;
        }

        if (!state.currentChannel) {
            notify(
                "Select a channel first.",
                "warning"
            );

            return;
        }

        const input =
            $("messageInput");

        if (!input) return;

        const content =
            input.value.trim();

        if (!content) return;

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

            input.value = "";
            input.style.height =
                "auto";

        } finally {
            state.sendingMessage =
                false;
        }
    }


    /* ============================================================
       DELETE
       ============================================================ */

    async function deleteMessage(
        message
    ) {
        const id =
            senderId(message);

        if (
            String(id) !==
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

        /*
         * Use soft deletion because
         * chat_messages already has
         * is_deleted/deleted_at.
         */

        const result =
            await state.db
                .from(
                    "chat_messages"
                )
                .update({
                    is_deleted: true,
                    deleted_at:
                        new Date().toISOString(),
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
                    String(item.id) !==
                    String(message.id)
            );

        renderMessages();
    }


    /* ============================================================
       MESSAGE REALTIME
       ============================================================ */

    function subscribeMessages() {
        if (!state.currentChannel) {
            return;
        }

        if (state.messageChannel) {
            state.db.removeChannel(
                state.messageChannel
            );
        }

        state.messageChannel =
            state.db
                .channel(
                    `mwaniki-channel-${state.currentChannel.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "INSERT",
                        schema: "public",
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
                                        payload.new
                                            .id
                                    )
                            )
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
                        event: "UPDATE",
                        schema: "public",
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
                                        payload.new
                                            .id
                                    )
                            );

                        if (index >= 0) {
                            if (
                                payload.new
                                    .is_deleted
                            ) {
                                state.messages.splice(
                                    index,
                                    1
                                );
                            } else {
                                state.messages[
                                    index
                                ] =
                                    payload.new;
                            }
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
                                "Community message realtime: SUBSCRIBED"
                            );
                        }
                    }
                );
    }


    /* ============================================================
       ATTACHMENTS
       ============================================================ */

    async function uploadFile(
        file
    ) {
        const buckets = [
            "chat-attachments",
            "attachments"
        ];

        const extension =
            file.name.includes(".")
                ? "." +
                  file.name
                      .split(".")
                      .pop()
                      .toLowerCase()
                : "";

        const path =
            `${state.user.id}/${Date.now()}-${crypto.randomUUID()}${extension}`;

        for (
            const bucket of buckets
        ) {
            try {
                const result =
                    await state.db.storage
                        .from(bucket)
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

                if (result.error) {
                    continue;
                }

                const publicResult =
                    state.db.storage
                        .from(bucket)
                        .getPublicUrl(
                            path
                        );

                return {
                    url:
                        publicResult
                            .data
                            ?.publicUrl ||
                        null,

                    name:
                        file.name,

                    type:
                        file.type ||
                        "application/octet-stream"
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    async function handleFiles(
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

        for (
            const file of files
        ) {
            const uploaded =
                await uploadFile(
                    file
                );

            if (!uploaded?.url) {
                notify(
                    `Unable to upload ${file.name}.`,
                    "error"
                );

                continue;
            }

            const result =
                await state.db
                    .from(
                        "chat_messages"
                    )
                    .insert({
                        channel_id:
                            state.currentChannel
                                ?.id,

                        user_id:
                            state.user.id,

                        content:
                            uploaded.name,

                        message_type:
                            "file",

                        attachment_url:
                            uploaded.url,

                        attachment_name:
                            uploaded.name
                    });

            if (result.error) {
                console.error(
                    "Attachment message failed:",
                    result.error
                );
            }
        }

        event.target.value = "";
    }


    /* ============================================================
       VOICE NOTES
       ============================================================ */

    async function toggleVoiceNote() {
        if (state.recording) {
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

        if (!state.currentChannel) {
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
                        audio: true
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

                    if (blob.size) {
                        await sendVoiceNote(
                            blob
                        );
                    }
                };

            state.mediaRecorder.start();

            state.recording = true;

            const button =
                $("voiceNoteButton");

            if (button) {
                button.textContent =
                    "⏹️";

                button.title =
                    "Stop recording";

                button.classList.add(
                    "recording"
                );
            }

            notify(
                "Recording voice note...",
                "info"
            );
        } catch (error) {
            console.error(
                "Microphone error:",
                error
            );

            notify(
                "Microphone access was denied or unavailable.",
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

            button.title =
                "Record voice note";

            button.classList.remove(
                "recording"
            );
        }
    }

    async function sendVoiceNote(
        blob
    ) {
        const file =
            new File(
                [blob],
                `voice-${Date.now()}.webm`,
                {
                    type:
                        blob.type ||
                        "audio/webm"
                }
            );

        const uploaded =
            await uploadFile(
                file
            );

        if (!uploaded?.url) {
            notify(
                "Unable to upload voice note.",
                "error"
            );

            return;
        }

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

                    content:
                        "Voice note",

                    message_type:
                        "voice",

                    attachment_url:
                        uploaded.url,

                    attachment_name:
                        uploaded.name
                });

        if (result.error) {
            console.error(
                "Voice note failed:",
                result.error
            );

            notify(
                "Unable to send voice note.",
                "error"
            );
        }
    }


    /* ============================================================
       EMOJI
       ============================================================ */

    const EMOJI_LIST = [
        "😀","😃","😄","😁","😆","😅",
        "😂","🤣","😊","🙂","🙃","😉",
        "😍","🥰","😘","😎","🤓","🤔",
        "😐","😑","🙄","😏","😮","😴",
        "🤗","🤩","🥳","😭","😢","😡",
        "🤬","👍","👎","👏","🙌","🙏",
        "❤️","🔥","🎉","✨","⭐","💯",
        "🎓","📚","🧪","🔬","🧬","🩺",
        "💉","💊","🩸","🧠","🫀","🫁",
        "🦠","🧫","📖","✏️","💡","✅"
    ];

    function renderEmojiGrid() {
        const grid =
            $("emojiGrid");

        if (!grid) return;

        grid.innerHTML =
            EMOJI_LIST.map(
                emoji => `
                    <button
                        type="button"
                        class="emoji-item"
                        data-emoji="${emoji}"
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
                                button.dataset
                                    .emoji
                            )
                    )
            );
    }

    function insertEmoji(
        emoji
    ) {
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

    function openEmoji() {
        hide(
            $("stickerPanel")
        );

        hide(
            $("gifPanel")
        );

        renderEmojiGrid();

        show(
            $("emojiPanel")
        );
    }


    /* ============================================================
       DIRECT MESSAGES
       ============================================================ */

    async function openDirectMessage(
        member
    ) {
        /*
         * First use any existing DM
         * function exposed by the application.
         */

        if (
            typeof window.openDirectMessage ===
            "function"
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

        /*
         * Search for an existing private
         * channel without inventing a new
         * table.
         */

        try {
            const result =
                await state.db
                    .from(
                        "chat_channels"
                    )
                    .select("*")
                    .eq(
                        "is_private",
                        true
                    )
                    .eq(
                        "is_active",
                        true
                    );

            if (!result.error) {
                const existing =
                    (
                        result.data ||
                        []
                    ).find(
                        channel => {
                            /*
                             * Private channel membership
                             * may be represented elsewhere,
                             * so do not falsely claim that
                             * a channel belongs to two users.
                             */
                            return false;
                        }
                    );

                if (existing) {
                    await selectChannel(
                        existing.id
                    );

                    return;
                }
            }
        } catch {
            /* Ignore. */
        }

        notify(
            `Messaging ${member.name} is ready, but no private-channel relationship exists yet.`,
            "info"
        );
    }


    /* ============================================================
       CALLS
       ============================================================ */

    async function callMember(
        member
    ) {
        if (!member?.userId) {
            notify(
                "This member cannot be called.",
                "warning"
            );

            return;
        }

        /*
         * IMPORTANT:
         * community-calls.js remains the
         * primary call engine.
         */

        if (
            window.MwanikiCalls &&
            typeof window.MwanikiCalls
                .callUser ===
                "function"
        ) {
            try {
                await window.MwanikiCalls.callUser(
                    member.userId,
                    state.currentCommunity
                        ?.id || null
                );

                return;
            } catch (error) {
                console.error(
                    "Existing call engine failed:",
                    error
                );
            }
        }

        /*
         * Database fallback using the
         * ACTUAL call schema.
         *
         * This gives the existing listener
         * a real room to detect.
         */

        try {
            const roomCode =
                `direct-${crypto.randomUUID()}`;

            const roomResult =
                await state.db
                    .from(
                        "chat_call_rooms"
                    )
                    .insert({
                        community_id:
                            state.currentCommunity
                                ?.id || null,

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

            if (roomResult.error) {
                throw roomResult.error;
            }

            const room =
                roomResult.data;

            await state.db
                .from(
                    "chat_call_participants"
                )
                .insert([
                    {
                        room_id:
                            room.id,

                        user_id:
                            state.user.id,

                        status:
                            "joined",

                        joined_at:
                            new Date().toISOString()
                    },
                    {
                        room_id:
                            room.id,

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
                "Personal call creation failed:",
                error
            );

            notify(
                "Unable to start the personal call.",
                "error"
            );
        }
    }

    async function generalCall() {
        if (
            window.MwanikiCalls &&
            typeof window.MwanikiCalls
                .openPicker ===
                "function"
        ) {
            try {
                await window.MwanikiCalls
                    .openPicker(null);

                return;
            } catch (error) {
                console.error(
                    "General call failed:",
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

        if (
            window.MwanikiCalls &&
            typeof window.MwanikiCalls
                .callCommunity ===
                "function"
        ) {
            try {
                await window.MwanikiCalls
                    .callCommunity(
                        communityId
                    );

                return;
            } catch (error) {
                console.error(
                    "Community call failed:",
                    error
                );
            }
        }

        if (
            window.MwanikiCalls &&
            typeof window.MwanikiCalls
                .openPicker ===
                "function"
        ) {
            await window.MwanikiCalls
                .openPicker(
                    communityId
                );

            return;
        }

        notify(
            "The call engine is still loading.",
            "warning"
        );
    }


    /* ============================================================
       ADD CHANNEL
       ============================================================ */

    function openAddChannelDialog() {
        closeDynamicDialog();

        const overlay =
            createDialog(
                "Add Channel"
            );

        overlay.innerHTML += `
            <div class="dynamic-form">

                <label>
                    Channel name
                    <input
                        id="newChannelName"
                        type="text"
                        placeholder="e.g. Pharmacology"
                        maxlength="80"
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
                        id="cancelNewChannel"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        id="createNewChannel"
                    >
                        Create Channel
                    </button>
                </div>

            </div>
        `;

        showDynamicDialog(
            overlay
        );

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
            () =>
                $("newChannelName")
                    ?.focus(),
            50
        );
    }

    async function createChannel() {
        if (!state.currentCommunity) {
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

        const slug =
            slugify(
                name
            );

        const position =
            state.channels.length;

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

                    slug,

                    description,

                    channel_type:
                        type,

                    icon:
                        type ===
                        "announcement"
                            ? "📢"
                            : type ===
                              "study"
                                ? "📖"
                                : type ===
                                  "course"
                                    ? "📚"
                                    : "#",

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
            `#${name} created.`,
            "success"
        );

        await loadChannels();

        if (result.data) {
            await selectChannel(
                result.data.id
            );
        }
    }

    function slugify(value) {
        return String(value || "")
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
                80
            );
    }


    /* ============================================================
       DYNAMIC DIALOG SYSTEM
       ============================================================ */

    let dynamicDialog = null;

    function createDialog(
        title
    ) {
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
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
            </div>
        `;

        const dialog =
            overlay.querySelector(
                ".dynamic-dialog"
            );

        overlay
            .querySelector(
                ".dynamic-dialog-close"
            )
            ?.addEventListener(
                "click",
                closeDynamicDialog
            );

        dynamicDialog =
            overlay;

        document.body.appendChild(
            overlay
        );

        return dialog;
    }

    function showDynamicDialog(
        dialog
    ) {
        if (!dialog) return;

        show(dialog);

        requestAnimationFrame(
            () => {
                dialog.classList.add(
                    "open"
                );
            }
        );
    }

    function closeDynamicDialog() {
        if (!dynamicDialog) return;

        dynamicDialog.remove();

        dynamicDialog = null;
    }


    /* ============================================================
       PROFILE
       ============================================================ */

    function openProfile() {
        /*
         * Use the existing profile page
         * instead of creating a fake profile
         * modal.
         */

        const paths = [
            "./profile.html",
            "./student-profile.html",
            "./profile"
        ];

        /*
         * profile.html is the standard page
         * for Mwaniki Scholars.
         */

        window.location.href =
            paths[0];
    }


    /* ============================================================
       COURSE + CONTEST SYSTEM
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
                        ascending: true
                    }
                );

        if (result.error) {
            console.error(
                "Course loading failed:",
                result.error
            );

            state.courses = [];

            return;
        }

        state.courses =
            result.data || [];
    }

    async function openContestChooser() {
        await loadCourses();

        const overlay =
            createDialog(
                "Contests"
            );

        overlay.innerHTML += `
            <div class="dynamic-form">

                <p class="contest-intro">
                    Choose a course to view
                    the contest material available
                    for that subject.
                </p>

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
                        Select a course.
                    </div>
                </div>

                <div class="dynamic-dialog-actions">
                    <button
                        type="button"
                        id="closeContestChooser"
                    >
                        Close
                    </button>
                </div>

            </div>
        `;

        showDynamicDialog(
            overlay
        );

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

        if (!container) return;

        if (!courseId) {
            container.innerHTML = `
                <div class="picker-empty">
                    Select a course.
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="picker-empty">
                Loading course material...
            </div>
        `;

        /*
         * Existing quiz material is available
         * by course_id.
         *
         * chat_contests itself does not have
         * course_id, so we do not pretend that
         * it does.
         */

        const result =
            await state.db
                .from("quizzes")
                .select(
                    "id,course_id,question,option_a,option_b,option_c,option_d"
                )
                .eq(
                    "course_id",
                    courseId
                )
                .limit(100);

        if (result.error) {
            console.error(
                "Course contest material failed:",
                result.error
            );

            container.innerHTML = `
                <div class="picker-empty">
                    No contest questions could be loaded.
                </div>
            `;

            return;
        }

        const questions =
            result.data || [];

        if (!questions.length) {
            container.innerHTML = `
                <div class="picker-empty">
                    No quiz questions are currently
                    available for this course.
                </div>
            `;

            return;
        }

        const course =
            state.courses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

        container.innerHTML = `
            <div class="contest-preview">

                <h3>
                    ${escapeHTML(
                        course?.title ||
                            "Course"
                    )}
                </h3>

                <p>
                    ${questions.length}
                    question(s) available.
                </p>

                <div class="contest-question-preview">
                    ${questions
                        .slice(0, 5)
                        .map(
                            (question, index) => `
                                <div class="contest-preview-question">
                                    <strong>
                                        ${index + 1}.
                                    </strong>

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
                    id="startCourseContest"
                >
                    Start Course Quiz
                </button>

            </div>
        `;

        $("startCourseContest")
            ?.addEventListener(
                "click",
                () => {
                    /*
                     * Reuse the existing quiz page
                     * instead of inventing another
                     * quiz engine.
                     */

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
            String(value || "")
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
                    const channelName =
                        button
                            .textContent
                            .toLowerCase();

                    button.style.display =
                        !query ||
                        channelName.includes(
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
        renderMembers(value);
    }

    function searchMessages(
        value
    ) {
        const query =
            String(value || "")
                .trim()
                .toLowerCase();

        document
            .querySelectorAll(
                "#messageList .message-item"
            )
            .forEach(
                item => {
                    const matches =
                        item.textContent
                            .toLowerCase()
                            .includes(
                                query
                            );

                    item.style.display =
                        !query ||
                        matches
                            ? ""
                            : "none";
                }
            );
    }


    /* ============================================================
       EVENTS
       ============================================================ */

    function bindEvents() {

        /* General Call */

        $("generalCallButton")
            ?.addEventListener(
                "click",
                generalCall
            );

        /* Community Call */

        $("communityCallButton")
            ?.addEventListener(
                "click",
                communityCall
            );

        /* Send */

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

        /* Attachments */

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
                handleFiles
            );

        /* Voice */

        $("voiceNoteButton")
            ?.addEventListener(
                "click",
                toggleVoiceNote
            );

        /* Emoji */

        $("emojiButton")
            ?.addEventListener(
                "click",
                openEmoji
            );

        $("closeEmojiButton")
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        $("emojiPanel")
                    )
            );

        /* Sticker */

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

        /* GIF */

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

        /* Channel search */

        $("channelSearchInput")
            ?.addEventListener(
                "input",
                event =>
                    searchChannels(
                        event.target
                            .value
                    )
            );

        /* Member search */

        $("memberSearchInput")
            ?.addEventListener(
                "input",
                event =>
                    searchMembers(
                        event.target
                            .value
                    )
            );

        /* Message search */

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

                    searchMessages("");
                }
            );

        $("messageSearchInput")
            ?.addEventListener(
                "input",
                event =>
                    searchMessages(
                        event.target
                            .value
                    )
            );

        /* Members */

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

        /* Add community button is
           used here as Add Channel
           because the supplied HTML
           has no add-channel button. */

        $("addCommunityButton")
            ?.addEventListener(
                "click",
                openAddChannelDialog
            );

        /*
         * Community menu also opens the
         * channel creator.
         */

        $("communityMenuButton")
            ?.addEventListener(
                "click",
                openAddChannelDialog
            );

        /* Profile */

        $("profileButton")
            ?.addEventListener(
                "click",
                openProfile
            );

        /* Contests */

        $("contestChannelButton")
            ?.addEventListener(
                "click",
                openContestChooser
            );

        /* Mobile */

        $("mobileSidebarButton")
            ?.addEventListener(
                "click",
                () =>
                    $("channelSidebar")
                        ?.classList.toggle(
                            "open"
                        )
            );

        /*
         * Close picker panels when clicking
         * outside the picker.
         */

        document.addEventListener(
            "click",
            event => {
                const picker =
                    event.target.closest(
                        ".picker-panel"
                    );

                const pickerButton =
                    event.target.closest(
                        "#emojiButton, #stickerButton, #gifButton"
                    );

                if (
                    !picker &&
                    !pickerButton
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
       AUTH CHANGES
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
                }
            }
        );
    }


    /* ============================================================
       START
       ============================================================ */

    async function start() {
        if (state.initialized) {
            return;
        }

        state.initialized =
            true;

        try {
            console.log(
                "🚀 Mwaniki Scholars Community starting"
            );

            await waitForSupabase();

            await loadUser();

            await loadProfile();

            bindEvents();

            listenForAuth();

            startPresence();

            await loadCommunities();

            console.log(
                "✅ Mwaniki Scholars Community loaded"
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
        openContestChooser
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
                once: true
            }
        );
    } else {
        start();
    }

})();
