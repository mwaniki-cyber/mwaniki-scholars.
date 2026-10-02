/* ============================================================
   MWANIKI SCHOLARS COMMUNITY
   COMPLETE COMMUNITY + CALL ENGINE
   ============================================================

   ONE FILE.
   ONE COMMUNITY ENGINE.
   ONE CALL ENGINE.

   Handles:
   - Authentication
   - Student profiles
   - Communities
   - Channels
   - Members
   - Messages
   - Presence
   - Realtime
   - General calls
   - Community calls
   - Direct calls
   - Online user picker
   - Real names
   - Real photos
   - WebRTC
   - Supabase signaling

   There is NO UUID input for students.
   ============================================================ */

import { supabase } from "./supabase.js";

(() => {

    "use strict";


    /* ============================================================
       GLOBAL DUPLICATE PROTECTION
       ============================================================ */

    if (
        window.__MWANIKI_COMPLETE_COMMUNITY_ENGINE__
    ) {

        console.warn(
            "⚠️ Mwaniki Community Engine already loaded."
        );

        return;
    }

    window.__MWANIKI_COMPLETE_COMMUNITY_ENGINE__ =
        true;


    console.log(
        "🚀 Mwaniki Scholars Community Engine loading..."
    );


    /* ============================================================
       STATE
       ============================================================ */

    const state = {

        user: null,

        profile: null,

        courses: [],

        communities: [],

        channels: [],

        members: [],

        messages: [],

        currentCommunity: null,

        currentChannel: null,

        currentCourse: null,

        currentRole: "student",

        currentReply: null,

        channelSearch: "",

        memberSearch: "",

        messageSearch: "",

        loadingCommunities: false,

        loadingChannels: false,

        loadingMessages: false,

        sendingMessage: false,

        presenceTimer: null,

        realtimeChannels: [],

        initialized: false

    };


    /* ============================================================
       CALL STATE
       ============================================================ */

    const callState = {

        user: null,

        profile: null,

        room: null,

        roomId: null,

        callType: "video",

        callScope: "general",

        selectedUsers: [],

        onlineUsers: [],

        remoteProfiles: new Map(),

        peers: new Map(),

        localStream: null,

        screenStream: null,

        screenSharing: false,

        microphoneOn: true,

        cameraOn: true,

        callStartedAt: null,

        durationTimer: null,

        realtimeChannels: [],

        initialized: false

    };


    /* ============================================================
       CONSTANTS
       ============================================================ */

    const STORAGE = {

        communityId:
            "mwanikiCommunityId",

        channelId:
            "mwanikiCommunityChannelId",

        courseId:
            "mwanikiCommunityCourseId",

        courseName:
            "mwanikiCommunityCourseName"

    };


    const ROLE_LEVEL = {

        student: 1,

        tutor: 2,

        moderator: 3,

        admin: 4,

        super_admin: 5

    };


    /* ============================================================
       DOM HELPERS
       ============================================================ */

    function byId(id) {

        return document.getElementById(id);

    }


    function show(element) {

        if (!element) return;

        element.classList.remove(
            "hidden"
        );

    }


    function hide(element) {

        if (!element) return;

        element.classList.add(
            "hidden"
        );

    }


    function setText(
        element,
        value
    ) {

        if (!element) return;

        element.textContent =
            value ?? "";

    }


    function escapeHTML(value) {

        return String(value ?? "")

            .replace(
                /&/g,
                "&amp;"
            )

            .replace(
                /</g,
                "&lt;"
            )

            .replace(
                />/g,
                "&gt;"
            )

            .replace(
                /"/g,
                "&quot;"
            )

            .replace(
                /'/g,
                "&#039;"
            );

    }


    function initials(name) {

        return String(
            name || "Student"
        )

            .trim()

            .split(/\s+/)

            .filter(Boolean)

            .slice(0, 2)

            .map(
                word =>
                    word
                        .charAt(0)
                        .toUpperCase()
            )

            .join("") || "MS";

    }


    function slugify(value) {

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

            .slice(0, 80);

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


    /* ============================================================
       TOAST
       ============================================================ */

    function toast(
        message
    ) {

        const element =
            byId(
                "communityToast"
            );

        if (!element) {

            console.log(
                "[Mwaniki]",
                message
            );

            return;
        }

        element.textContent =
            message;

        element.classList.add(
            "show"
        );

        clearTimeout(
            toast.timer
        );

        toast.timer =
            setTimeout(
                () => {

                    element.classList.remove(
                        "show"
                    );

                },
                3500
            );

    }


    /* ============================================================
       PROFILE HELPERS
       ============================================================ */

    function profileName(
        profile,
        userId
    ) {

        return (

            profile?.full_name ||

            profile?.name ||

            profile?.student_name ||

            profile?.display_name ||

            (
                userId ===
                state.user?.id

                    ? (
                        state.profile?.full_name ||

                        state.profile?.name ||

                        state.profile?.student_name ||

                        state.user
                            ?.user_metadata
                            ?.full_name ||

                        state.user
                            ?.user_metadata
                            ?.name ||

                        state.user
                            ?.email
                            ?.split("@")[0]
                    )

                    : "Mwaniki Scholar"
            )

        );

    }


    function profilePhoto(
        profile
    ) {

        return (

            profile?.photo_url ||

            profile?.avatar_url ||

            profile?.profile_photo ||

            profile?.image_url ||

            profile?.profile_image ||

            ""

        );

    }


    function currentDisplayName() {

        return profileName(
            state.profile,
            state.user?.id
        );

    }


    /* ============================================================
       AUTHENTICATION
       ============================================================ */

    async function loadCurrentUser() {

        const {
            data,
            error
        } =
            await supabase
                .auth
                .getUser();


        if (error) {

            throw error;

        }


        if (!data?.user) {

            throw new Error(
                "You must be signed in to use the community."
            );

        }


        state.user =
            data.user;

    }


    async function loadCurrentProfile() {

        if (!state.user?.id) {
            return;
        }


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "students"
                )

                .select("*")

                .eq(
                    "id",
                    state.user.id
                )

                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Student profile:",
                error.message
            );

            return;

        }


        state.profile =
            data || null;

    }


    /* ============================================================
       COURSES
       ============================================================ */

    async function loadCourses() {

        const {
            data,
            error
        } =
            await supabase

                .from(
                    "courses"
                )

                .select(
                    `
                    id,
                    title,
                    description,
                    image,
                    created_at
                    `
                )

                .order(
                    "title",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.warn(
                "⚠️ Courses:",
                error.message
            );

            state.courses =
                [];

            return [];

        }


        state.courses =
            data || [];


        populateCourseSelect();


        console.log(
            `Courses loaded: ${state.courses.length}`
        );


        return state.courses;

    }


    function populateCourseSelect() {

        const select =
            byId(
                "channelCourseSelect"
            );


        if (!select) return;


        select.innerHTML = `

            <option value="">
                No course linked
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

                select.appendChild(
                    option
                );

            }
        );

    }


    /* ============================================================
       COMMUNITIES
       ============================================================ */

    async function loadCommunities() {

        if (
            state.loadingCommunities
        ) {

            return state.communities;

        }


        state.loadingCommunities =
            true;


        const rail =
            byId(
                "communityRail"
            );


        if (rail) {

            rail.innerHTML = `

                <div class="channel-loading">
                    Loading communities...
                </div>

            `;

        }


        try {

            const {
                data,
                error
            } =
                await supabase

                    .from(
                        "chat_communities"
                    )

                    .select(
                        `
                        id,
                        name,
                        slug,
                        description,
                        icon_url,
                        banner_url,
                        is_public,
                        is_active,
                        created_by,
                        created_at,
                        updated_at
                        `
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

                console.error(
                    "❌ Communities:",
                    error
                );

                if (rail) {

                    rail.innerHTML = `

                        <div class="channel-loading">

                            Unable to load communities.

                            <br>

                            <small>
                                ${escapeHTML(
                                    error.message
                                )}
                            </small>

                        </div>

                    `;

                }

                throw error;

            }


            state.communities =
                data || [];


            console.log(
                `Communities loaded: ${state.communities.length}`
            );


            renderCommunities();


            return state.communities;

        }

        finally {

            state.loadingCommunities =
                false;

        }

    }


    function renderCommunities() {

        const rail =
            byId(
                "communityRail"
            );


        if (!rail) return;


        rail.innerHTML =
            "";


        if (
            !state.communities.length
        ) {

            rail.innerHTML = `

                <div class="channel-loading">
                    No communities available.
                </div>

            `;

            return;

        }


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
                        state.currentCommunity.id
                    ) ===
                    String(
                        community.id
                    )
                ) {

                    button.classList.add(
                        "active"
                    );

                }


                const image =
                    community.icon_url

                        ? `

                            <img
                                src="${escapeHTML(
                                    community.icon_url
                                )}"
                                alt=""
                                class="community-rail-icon"
                            >

                        `

                        : `

                            <span
                                class="community-rail-icon community-initials"
                            >
                                ${escapeHTML(
                                    initials(
                                        community.name
                                    )
                                )}
                            </span>

                        `;


                button.innerHTML = `

                    ${image}

                    <span class="community-rail-name">

                        ${escapeHTML(
                            community.name
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


    /* ============================================================
       COMMUNITY MEMBERSHIP
       ============================================================ */

    async function ensureMembership(
        communityId
    ) {

        if (
            !state.user?.id ||
            !communityId
        ) {

            return null;

        }


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_community_members"
                )

                .select(
                    `
                    id,
                    community_id,
                    user_id,
                    role,
                    nickname,
                    is_muted,
                    is_banned,
                    joined_at,
                    last_seen_at
                    `
                )

                .eq(
                    "community_id",
                    communityId
                )

                .eq(
                    "user_id",
                    state.user.id
                )

                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Membership lookup:",
                error.message
            );

        }


        if (data) {

            return data;

        }


        const result =
            await supabase

                .from(
                    "chat_community_members"
                )

                .insert({

                    community_id:
                        communityId,

                    user_id:
                        state.user.id,

                    role:
                        "student"

                })

                .select()

                .single();


        if (result.error) {

            console.warn(
                "⚠️ Membership creation:",
                result.error.message
            );

            return null;

        }


        return result.data;

    }


    async function loadRole(
        communityId
    ) {

        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_community_members"
                )

                .select(
                    `
                    role,
                    is_muted,
                    is_banned
                    `
                )

                .eq(
                    "community_id",
                    communityId
                )

                .eq(
                    "user_id",
                    state.user.id
                )

                .maybeSingle();


        if (error) {

            console.warn(
                "⚠️ Role:",
                error.message
            );

            state.currentRole =
                "student";

            return;

        }


        state.currentRole =
            data?.role ||
            "student";


        if (data?.is_banned) {

            toast(
                "You are restricted from this community."
            );

        }

    }


    function roleLevel() {

        return (
            ROLE_LEVEL[
                state.currentRole
            ] || 1
        );

    }


    function canCreateChannel() {

        return (
            roleLevel() >=
            ROLE_LEVEL.moderator
        );

    }


    function canCreateCommunity() {

        return (
            roleLevel() >=
            ROLE_LEVEL.admin
        );

    }


    /* ============================================================
       SELECT COMMUNITY
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

        state.currentChannel =
            null;

        state.currentCourse =
            null;

        state.channels =
            [];

        state.members =
            [];

        state.messages =
            [];


        localStorage.setItem(
            STORAGE.communityId,
            String(
                community.id
            )
        );


        renderActiveCommunity();


        await ensureMembership(
            community.id
        );


        await loadRole(
            community.id
        );


        renderRole();


        await loadChannels();


        await loadMembers();


        renderCommunities();


        refreshRealtime();


        console.log(
            "Active community:",
            community.name
        );

    }


    function renderActiveCommunity() {

        const community =
            state.currentCommunity;


        if (!community) return;


        setText(
            byId(
                "activeCommunityName"
            ),
            community.name
        );


        setText(
            byId(
                "activeCommunityDescription"
            ),
            community.description ||
                ""
        );


        const icon =
            byId(
                "activeCommunityIcon"
            );


        if (icon) {

            if (
                community.icon_url
            ) {

                icon.src =
                    community.icon_url;

                icon.style.display =
                    "";

            }

            else {

                icon.removeAttribute(
                    "src"
                );

                icon.style.display =
                    "none";

            }

        }

    }


    function renderRole() {

        const badge =
            byId(
                "activeRoleBadge"
            );


        if (!badge) return;


        badge.textContent =
            String(
                state.currentRole
            )

                .replace(
                    /_/g,
                    " "
                )

                .replace(
                    /\b\w/g,
                    char =>
                        char.toUpperCase()
                );

    }


    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels() {

        if (
            !state.currentCommunity?.id
        ) {

            return [];

        }


        const list =
            byId(
                "channelList"
            );


        if (list) {

            list.innerHTML = `

                <div class="channel-loading">
                    Loading channels...
                </div>

            `;

        }


        state.loadingChannels =
            true;


        try {

            const {
                data,
                error
            } =
                await supabase

                    .from(
                        "chat_channels"
                    )

                    .select(
                        `
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
                        created_at,
                        updated_at
                        `
                    )

                    .eq(
                        "community_id",
                        state
                            .currentCommunity
                            .id
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
                    )

                    .order(
                        "created_at",
                        {
                            ascending: true
                        }
                    );


            if (error) {

                console.error(
                    "❌ Channels:",
                    error
                );


                if (list) {

                    list.innerHTML = `

                        <div class="channel-loading">

                            Unable to load channels.

                            <br>

                            <small>
                                ${escapeHTML(
                                    error.message
                                )}
                            </small>

                        </div>

                    `;

                }


                throw error;

            }


            state.channels =
                data || [];


            /*
             * Private channel filtering.
             */

            await filterPrivateChannels();


            console.log(
                `Channels loaded: ${state.channels.length}`
            );


            renderChannels();


            await selectInitialChannel();


            return state.channels;

        }

        finally {

            state.loadingChannels =
                false;

        }

    }


    async function filterPrivateChannels() {

        const privateChannels =
            state.channels.filter(
                channel =>
                    channel.is_private
            );


        if (
            !privateChannels.length
        ) {

            return;

        }


        const ids =
            privateChannels.map(
                channel =>
                    channel.id
            );


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_channel_members"
                )

                .select(
                    `
                    channel_id,
                    user_id
                    `
                )

                .eq(
                    "user_id",
                    state.user.id
                )

                .in(
                    "channel_id",
                    ids
                );


        if (error) {

            console.warn(
                "⚠️ Private channels:",
                error.message
            );

            state.channels =
                state.channels.filter(
                    channel =>
                        !channel.is_private
                );

            return;

        }


        const allowed =
            new Set(
                (data || []).map(
                    row =>
                        String(
                            row.channel_id
                        )
                )
            );


        state.channels =
            state.channels.filter(
                channel => {

                    if (
                        !channel.is_private
                    ) {

                        return true;

                    }

                    return allowed.has(
                        String(
                            channel.id
                        )
                    );

                }
            );

    }


    function renderChannels() {

        const list =
            byId(
                "channelList"
            );


        if (!list) return;


        list.innerHTML =
            "";


        const search =
            state.channelSearch
                .trim()
                .toLowerCase();


        const filtered =
            state.channels.filter(
                channel => {

                    if (!search) {

                        return true;

                    }


                    return (

                        String(
                            channel.name ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                search
                            )

                        ||

                        String(
                            channel.description ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                search
                            )

                    );

                }
            );


        if (!filtered.length) {

            list.innerHTML = `

                <div class="channel-loading">
                    No channels found.
                </div>

            `;

            return;

        }


        filtered.forEach(
            channel => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "channel-item";


                if (
                    state.currentChannel &&
                    String(
                        state.currentChannel.id
                    ) ===
                    String(
                        channel.id
                    )
                ) {

                    button.classList.add(
                        "active"
                    );

                }


                button.innerHTML = `

                    <span class="channel-item-icon">

                        ${escapeHTML(
                            channel.icon ||
                            "#"
                        )}

                    </span>


                    <span class="channel-item-content">

                        <strong>
                            ${escapeHTML(
                                channel.name
                            )}
                        </strong>

                        ${
                            channel.description

                                ? `

                                    <small>
                                        ${escapeHTML(
                                            channel.description
                                        )}
                                    </small>

                                `

                                : ""
                        }

                    </span>

                `;


                button.addEventListener(
                    "click",
                    () =>
                        selectChannel(
                            channel.id
                        )
                );


                list.appendChild(
                    button
                );

            }
        );


        const createButton =
            byId(
                "createChannelButton"
            );


        if (createButton) {

            createButton.style.display =
                canCreateChannel()
                    ? ""
                    : "none";

        }

    }


    async function selectInitialChannel() {

        if (
            !state.channels.length
        ) {

            state.currentChannel =
                null;

            renderNoChannel();

            return;

        }


        const stored =
            localStorage.getItem(
                STORAGE.channelId
            );


        const selected =
            state.channels.find(
                channel =>
                    String(
                        channel.id
                    ) ===
                    String(
                        stored
                    )
            );


        await selectChannel(
            selected?.id ||
            state.channels[0].id
        );

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


        state.currentReply =
            null;


        localStorage.setItem(
            STORAGE.channelId,
            String(
                channel.id
            )
        );


        renderChannels();


        renderActiveChannel();


        await loadMessages();


        refreshRealtime();

    }


    function renderActiveChannel() {

        const channel =
            state.currentChannel;


        if (!channel) {

            renderNoChannel();

            return;

        }


        setText(
            byId(
                "activeChannelName"
            ),
            channel.name
        );


        setText(
            byId(
                "activeChannelDescription"
            ),
            channel.description ||
                ""
        );

    }


    function renderNoChannel() {

        setText(
            byId(
                "activeChannelName"
            ),
            "No channel"
        );


        setText(
            byId(
                "activeChannelDescription"
            ),
            "No accessible channel is available."
        );


        const list =
            byId(
                "messageList"
            );


        if (list) {

            list.innerHTML = `

                <div class="message-empty">

                    <h3>
                        No channel selected
                    </h3>

                    <p>
                        Select a channel to start chatting.
                    </p>

                </div>

            `;

        }

    }


    /* ============================================================
       MEMBERS
       ============================================================ */

    async function loadMembers() {

        if (
            !state.currentCommunity?.id
        ) {

            return;

        }


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_community_members"
                )

                .select(
                    `
                    id,
                    community_id,
                    user_id,
                    role,
                    nickname,
                    is_muted,
                    is_banned,
                    joined_at,
                    last_seen_at
                    `
                )

                .eq(
                    "community_id",
                    state
                        .currentCommunity
                        .id
                )

                .order(
                    "joined_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "❌ Members:",
                error
            );

            return;

        }


        const members =
            data || [];


        const userIds =
            [
                ...new Set(
                    members
                        .map(
                            member =>
                                member.user_id
                        )
                        .filter(Boolean)
                )
            ];


        let profiles =
            [];


        if (
            userIds.length
        ) {

            const result =
                await supabase

                    .from(
                        "students"
                    )

                    .select("*")

                    .in(
                        "id",
                        userIds
                    );


            if (
                !result.error
            ) {

                profiles =
                    result.data ||
                    [];

            }

        }


        const profileMap =
            new Map(
                profiles.map(
                    profile => [
                        String(
                            profile.id
                        ),
                        profile
                    ]
                )
            );


        state.members =
            members.map(
                member => ({

                    ...member,

                    profile:
                        profileMap.get(
                            String(
                                member.user_id
                            )
                        ) || null

                })
            );


        renderMembers();

    }


    function memberName(
        member
    ) {

        return profileName(
            member.profile,
            member.user_id
        );

    }


    function memberPhoto(
        member
    ) {

        return profilePhoto(
            member.profile
        );

    }


    function renderMembers() {

        const list =
            byId(
                "memberList"
            );


        if (!list) return;


        setText(
            byId(
                "memberCount"
            ),
            state.members.length
        );


        list.innerHTML =
            "";


        const search =
            state.memberSearch
                .trim()
                .toLowerCase();


        const members =
            state.members.filter(
                member =>
                    !search ||
                    memberName(
                        member
                    )
                        .toLowerCase()
                        .includes(
                            search
                        )
            );


        members.forEach(
            member => {

                const name =
                    memberName(
                        member
                    );


                const photo =
                    memberPhoto(
                        member
                    );


                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "community-member-item";


                item.innerHTML = `

                    <div class="member-avatar">

                        ${
                            photo

                                ? `

                                    <img
                                        src="${escapeHTML(
                                            photo
                                        )}"
                                        alt=""
                                    >

                                `

                                : `

                                    <span>
                                        ${escapeHTML(
                                            initials(
                                                name
                                            )
                                        )}
                                    </span>

                                `
                        }

                    </div>


                    <div class="member-info">

                        <strong>
                            ${escapeHTML(
                                name
                            )}
                        </strong>

                        <small>
                            ${escapeHTML(
                                member.role ||
                                "student"
                            )}
                        </small>

                    </div>

                `;


                list.appendChild(
                    item
                );

            }
        );

    }


    /* ============================================================
       MESSAGES
       ============================================================ */

    async function loadMessages() {

        const list =
            byId(
                "messageList"
            );


        if (
            !state.currentChannel?.id
        ) {

            renderNoChannel();

            return;

        }


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
        } =
            await supabase

                .from(
                    "chat_messages"
                )

                .select("*")

                .eq(
                    "channel_id",
                    state
                        .currentChannel
                        .id
                )

                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                )

                .limit(
                    500
                );


        if (error) {

            console.error(
                "❌ Messages:",
                error
            );


            if (list) {

                list.innerHTML = `

                    <div class="message-empty">

                        Unable to load messages.

                        <br>

                        <small>
                            ${escapeHTML(
                                error.message
                            )}
                        </small>

                    </div>

                `;

            }

            return;

        }


        state.messages =
            await enrichMessages(
                data || []
            );


        renderMessages();

    }


    async function enrichMessages(
        messages
    ) {

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


        let profiles =
            [];


        if (
            ids.length
        ) {

            const {
                data
            } =
                await supabase

                    .from(
                        "students"
                    )

                    .select("*")

                    .in(
                        "id",
                        ids
                    );


            profiles =
                data || [];

        }


        const profileMap =
            new Map(
                profiles.map(
                    profile => [
                        String(
                            profile.id
                        ),
                        profile
                    ]
                )
            );


        return messages.map(
            message => ({

                ...message,

                profile:
                    profileMap.get(
                        String(
                            message.user_id
                        )
                    ) || null

            })
        );

    }


    function renderMessages() {

        const list =
            byId(
                "messageList"
            );


        if (!list) return;


        list.innerHTML =
            "";


        const search =
            state.messageSearch
                .trim()
                .toLowerCase();


        const messages =
            state.messages.filter(
                message =>
                    !search ||
                    String(
                        message.content ||
                        ""
                    )
                        .toLowerCase()
                        .includes(
                            search
                        )
            );


        if (!messages.length) {

            list.innerHTML = `

                <div class="message-empty">

                    <h3>
                        No messages yet
                    </h3>

                    <p>
                        Start the conversation.
                    </p>

                </div>

            `;

            return;

        }


        messages.forEach(
            message => {

                const profile =
                    message.profile ||
                    {};


                const name =
                    profileName(
                        profile,
                        message.user_id
                    );


                const photo =
                    profilePhoto(
                        profile
                    );


                const article =
                    document.createElement(
                        "article"
                    );


                article.className =
                    "chat-message";


                article.innerHTML = `

                    <div class="message-avatar">

                        ${
                            photo

                                ? `

                                    <img
                                        src="${escapeHTML(
                                            photo
                                        )}"
                                        alt=""
                                    >

                                `

                                : `

                                    <span>
                                        ${escapeHTML(
                                            initials(
                                                name
                                            )
                                        )}
                                    </span>

                                `
                        }

                    </div>


                    <div class="message-body">

                        <div class="message-header">

                            <strong>
                                ${escapeHTML(
                                    name
                                )}
                            </strong>

                            <time>
                                ${escapeHTML(
                                    formatTime(
                                        message.created_at
                                    )
                                )}
                            </time>

                        </div>


                        <div class="message-content">

                            ${escapeHTML(
                                message.content ||
                                ""
                            )}

                        </div>

                    </div>

                `;


                list.appendChild(
                    article
                );

            }
        );


        list.scrollTop =
            list.scrollHeight;

    }


    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    async function sendMessage(
        event
    ) {

        event.preventDefault();


        const input =
            byId(
                "messageInput"
            );


        const content =
            input?.value.trim();


        if (
            !content ||
            !state.currentChannel?.id ||
            !state.user?.id
        ) {

            return;

        }


        const button =
            byId(
                "sendMessageButton"
            );


        if (button) {

            button.disabled =
                true;

        }


        try {

            const {
                data,
                error
            } =
                await supabase

                    .from(
                        "chat_messages"
                    )

                    .insert({

                        channel_id:
                            state
                                .currentChannel
                                .id,

                        user_id:
                            state.user.id,

                        content

                    })

                    .select("*")

                    .single();


            if (error) {

                throw error;

            }


            input.value =
                "";


            const enriched =
                await enrichMessages(
                    [data]
                );


            if (
                enriched[0]
            ) {

                state.messages.push(
                    enriched[0]
                );

                renderMessages();

            }

        }

        catch (error) {

            console.error(
                "❌ Send message:",
                error
            );

            toast(
                error.message
            );

        }

        finally {

            if (button) {

                button.disabled =
                    false;

            }

        }

    }


    /* ============================================================
       PRESENCE
       ============================================================ */

    async function setOnline() {

        if (!state.user?.id) {
            return;
        }


        const now =
            new Date()
                .toISOString();


        const {
            error
        } =
            await supabase

                .from(
                    "chat_presence"
                )

                .upsert(

                    {

                        user_id:
                            state.user.id,

                        status:
                            "online",

                        last_seen_at:
                            now,

                        updated_at:
                            now

                    },

                    {

                        onConflict:
                            "user_id"

                    }

                );


        if (error) {

            console.warn(
                "⚠️ Presence:",
                error.message
            );

        }

    }


    async function setOffline() {

        if (!state.user?.id) {
            return;
        }


        await supabase

            .from(
                "chat_presence"
            )

            .update({

                status:
                    "offline",

                last_seen_at:
                    new Date()
                        .toISOString(),

                updated_at:
                    new Date()
                        .toISOString()

            })

            .eq(
                "user_id",
                state.user.id
            );

    }


    function startPresence() {

        setOnline();


        clearInterval(
            state.presenceTimer
        );


        state.presenceTimer =
            setInterval(
                setOnline,
                30000
            );

    }


    /* ============================================================
       REALTIME
       ============================================================ */

    function clearRealtime() {

        state.realtimeChannels
            .forEach(
                channel => {

                    try {

                        supabase
                            .removeChannel(
                                channel
                            );

                    }

                    catch {}

                }
            );


        state.realtimeChannels =
            [];

    }


    function refreshRealtime() {

        clearRealtime();


        if (
            state.currentChannel?.id
        ) {

            const channel =
                supabase

                    .channel(
                        "messages-" +
                        state
                            .currentChannel
                            .id
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

                            const exists =
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
                                );


                            if (exists) {
                                return;
                            }


                            const enriched =
                                await enrichMessages(
                                    [
                                        payload.new
                                    ]
                                );


                            if (
                                enriched[0]
                            ) {

                                state.messages.push(
                                    enriched[0]
                                );

                                renderMessages();

                            }

                        }

                    )

                    .subscribe();


            state.realtimeChannels.push(
                channel
            );

        }


        if (
            state.currentCommunity?.id
        ) {

            const communityChannel =
                supabase

                    .channel(
                        "community-" +
                        state
                            .currentCommunity
                            .id
                    )

                    .on(

                        "postgres_changes",

                        {

                            event:
                                "*",

                            schema:
                                "public",

                            table:
                                "chat_channels",

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

                            event:
                                "*",

                            schema:
                                "public",

                            table:
                                "chat_community_members",

                            filter:
                                `community_id=eq.${state.currentCommunity.id}`

                        },

                        async () => {

                            await loadMembers();

                        }

                    )

                    .subscribe();


            state.realtimeChannels.push(
                communityChannel
            );

        }

    }


    /* ============================================================
       DRAWERS
       ============================================================ */

    function openChannels() {

        byId(
            "channelSidebar"
        )
            ?.classList
            .add(
                "drawer-open"
            );


        byId(
            "communityDrawerOverlay"
        )
            ?.classList
            .add(
                "show"
            );

    }


    function closeChannels() {

        byId(
            "channelSidebar"
        )
            ?.classList
            .remove(
                "drawer-open"
            );


        closeOverlay();

    }


    function openMembers() {

        byId(
            "memberSidebar"
        )
            ?.classList
            .add(
                "drawer-open"
            );


        byId(
            "communityDrawerOverlay"
        )
            ?.classList
            .add(
                "show"
            );

    }


    function closeMembers() {

        byId(
            "memberSidebar"
        )
            ?.classList
            .remove(
                "drawer-open"
            );


        closeOverlay();

    }


    function closeOverlay() {

        byId(
            "communityDrawerOverlay"
        )
            ?.classList
            .remove(
                "show"
            );

    }


    /* ============================================================
       MODALS
       ============================================================ */

    function openModal(
        id
    ) {

        byId(id)
            ?.classList
            .remove(
                "hidden"
            );

    }


    function closeModal(
        id
    ) {

        byId(id)
            ?.classList
            .add(
                "hidden"
            );

    }


    /* ============================================================
       CREATE COMMUNITY
       ============================================================ */

    async function createCommunity(
        event
    ) {

        event.preventDefault();


        if (
            !canCreateCommunity()
        ) {

            toast(
                "You do not have permission to create communities."
            );

            return;

        }


        const name =
            byId(
                "communityNameInput"
            )
                ?.value
                .trim();


        const description =
            byId(
                "communityDescriptionInput"
            )
                ?.value
                .trim();


        const iconUrl =
            byId(
                "communityIconInput"
            )
                ?.value
                .trim() ||
            null;


        if (!name) {

            setText(
                byId(
                    "communityFormMessage"
                ),
                "Community name is required."
            );

            return;

        }


        /*
         * IMPORTANT:
         * Do not insert course_id here because the
         * current chat_communities schema supplied
         * does not require it.
         */

        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_communities"
                )

                .insert({

                    name,

                    slug:
                        slugify(
                            name
                        ),

                    description:
                        description ||
                        null,

                    icon_url:
                        iconUrl,

                    is_public:
                        true,

                    is_active:
                        true,

                    created_by:
                        state.user.id

                })

                .select()

                .single();


        if (error) {

            console.error(
                "❌ Create community:",
                error
            );

            setText(
                byId(
                    "communityFormMessage"
                ),
                error.message
            );

            return;

        }


        closeModal(
            "communityModal"
        );


        toast(
            "Community created."
        );


        await loadCommunities();


        if (data?.id) {

            await selectCommunity(
                data.id
            );

        }

    }


    /* ============================================================
       CREATE CHANNEL
       ============================================================ */

    async function createChannel(
        event
    ) {

        event.preventDefault();


        if (
            !canCreateChannel()
        ) {

            toast(
                "You do not have permission to create channels."
            );

            return;

        }


        if (
            !state.currentCommunity?.id
        ) {

            return;

        }


        const name =
            byId(
                "channelNameInput"
            )
                ?.value
                .trim();


        const description =
            byId(
                "channelDescriptionInput"
            )
                ?.value
                .trim();


        const category =
            byId(
                "channelCategoryInput"
            )
                ?.value
                .trim() ||
            "text";


        const visibility =
            byId(
                "channelVisibilitySelect"
            )
                ?.value ||
            "public";


        const courseId =
            byId(
                "channelCourseSelect"
            )
                ?.value ||
            null;


        if (!name) {

            setText(
                byId(
                    "channelFormMessage"
                ),
                "Channel name is required."
            );

            return;

        }


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_channels"
                )

                .insert({

                    community_id:
                        state
                            .currentCommunity
                            .id,

                    name,

                    slug:
                        slugify(
                            name
                        ),

                    description:
                        description ||
                        null,

                    channel_type:
                        category,

                    position:
                        state
                            .channels
                            .length + 1,

                    is_private:
                        visibility ===
                        "private",

                    is_archived:
                        false,

                    is_active:
                        true,

                    course_id:
                        courseId,

                    created_by:
                        state.user.id

                })

                .select()

                .single();


        if (error) {

            console.error(
                "❌ Create channel:",
                error
            );

            setText(
                byId(
                    "channelFormMessage"
                ),
                error.message
            );

            return;

        }


        closeModal(
            "channelModal"
        );


        toast(
            "Channel created."
        );


        await loadChannels();


        if (data?.id) {

            await selectChannel(
                data.id
            );

        }

    }


    /* ============================================================
       ONLINE USERS
       ============================================================ */

    async function getOnlineUsers(
        communityOnly = false
    ) {

        const cutoff =
            new Date(
                Date.now() -
                5 * 60 * 1000
            )
                .toISOString();


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_presence"
                )

                .select(
                    `
                    user_id,
                    status,
                    last_seen_at,
                    updated_at
                    `
                )

                .eq(
                    "status",
                    "online"
                )

                .gte(
                    "last_seen_at",
                    cutoff
                );


        if (error) {

            throw error;

        }


        let rows =
            (data || [])
                .filter(
                    row =>
                        String(
                            row.user_id
                        ) !==
                        String(
                            state.user.id
                        )
                );


        /*
         * For community calls, restrict the picker
         * to members of the active community.
         */

        if (
            communityOnly &&
            state.currentCommunity?.id
        ) {

            const {
                data:
                    communityMembers,
                error:
                    memberError
            } =
                await supabase

                    .from(
                        "chat_community_members"
                    )

                    .select(
                        "user_id"
                    )

                    .eq(
                        "community_id",
                        state
                            .currentCommunity
                            .id
                    );


            if (!memberError) {

                const allowed =
                    new Set(
                        (
                            communityMembers ||
                            []
                        )
                            .map(
                                member =>
                                    String(
                                        member.user_id
                                    )
                            )
                    );


                rows =
                    rows.filter(
                        row =>
                            allowed.has(
                                String(
                                    row.user_id
                                )
                            )
                    );

            }

        }


        const ids =
            rows.map(
                row =>
                    row.user_id
            );


        if (!ids.length) {

            return [];

        }


        const {
            data:
                profiles,
            error:
                profileError
        } =
            await supabase

                .from(
                    "students"
                )

                .select("*")

                .in(
                    "id",
                    ids
                );


        if (profileError) {

            throw profileError;

        }


        const map =
            new Map(
                (
                    profiles ||
                    []
                )
                    .map(
                        profile => [
                            String(
                                profile.id
                            ),
                            profile
                        ]
                    )
            );


        return rows.map(
            row => ({

                ...row,

                profile:
                    map.get(
                        String(
                            row.user_id
                        )
                    ) || null

            })
        );

    }


    /* ============================================================
       GENERAL CALL PICKER
       ============================================================ */

    async function openGeneralCall() {

        callState.callScope =
            "general";


        callState.callType =
            "video";


        callState.selectedUsers =
            [];


        openModal(
            "generalCallModal"
        );


        await renderCallPicker(
            false
        );

    }


    async function renderCallPicker(
        communityOnly
    ) {

        const container =
            byId(
                "generalCallUserList"
            );


        if (!container) {
            return;
        }


        container.innerHTML = `

            <div class="call-picker-loading">
                Loading online users...
            </div>

        `;


        try {

            const users =
                await getOnlineUsers(
                    communityOnly
                );


            callState.onlineUsers =
                users;


            if (!users.length) {

                container.innerHTML = `

                    <div class="call-picker-empty">

                        No other users are currently online.

                    </div>

                `;

                return;

            }


            container.innerHTML = "";


            users.forEach(
                person => {

                    const profile =
                        person.profile ||
                        {};


                    const name =
                        profileName(
                            profile,
                            person.user_id
                        );


                    const photo =
                        profilePhoto(
                            profile
                        );


                    const label =
                        document.createElement(
                            "label"
                        );


                    label.className =
                        "call-picker-user";


                    label.innerHTML = `

                        <input
                            type="checkbox"
                            value="${escapeHTML(
                                person.user_id
                            )}"
                        >


                        <span class="call-picker-avatar">

                            ${
                                photo

                                    ? `

                                        <img
                                            src="${escapeHTML(
                                                photo
                                            )}"
                                            alt=""
                                        >

                                    `

                                    : `

                                        <span>
                                            ${escapeHTML(
                                                initials(
                                                    name
                                                )
                                            )}
                                        </span>

                                    `
                            }

                        </span>


                        <span class="call-picker-user-info">

                            <strong>
                                ${escapeHTML(
                                    name
                                )}
                            </strong>

                            <small>
                                Online
                            </small>

                        </span>

                    `;


                    const checkbox =
                        label.querySelector(
                            "input"
                        );


                    checkbox.addEventListener(
                        "change",
                        updateSelectedUsers
                    );


                    container.appendChild(
                        label
                    );

                }
            );


            updatePickerMessage();

        }

        catch (error) {

            console.error(
                "❌ Online users:",
                error
            );


            container.innerHTML = `

                <div class="call-picker-empty">

                    Unable to load online users.

                    <br>

                    <small>
                        ${escapeHTML(
                            error.message
                        )}
                    </small>

                </div>

            `;

        }

    }


    function updateSelectedUsers() {

        const container =
            byId(
                "generalCallUserList"
            );


        if (!container) {
            return;
        }


        callState.selectedUsers =
            Array.from(
                container.querySelectorAll(
                    'input[type="checkbox"]:checked'
                )
            )
                .map(
                    input =>
                        input.value
                );


        updatePickerMessage();

    }


    function updatePickerMessage() {

        const element =
            byId(
                "generalCallMessage"
            );


        if (!element) {
            return;
        }


        const count =
            callState
                .selectedUsers
                .length;


        element.textContent =
            count

                ? `${count} user${
                    count === 1
                        ? ""
                        : "s"
                } selected.`

                : "Select one or more online users.";

    }


    /* ============================================================
       CREATE CALL ROOM
       ============================================================ */

    function roomCode() {

        return (

            "MS-" +

            Date.now()
                .toString(36)
                .toUpperCase() +

            "-" +

            Math.random()
                .toString(36)
                .slice(
                    2,
                    8
                )
                .toUpperCase()

        );

    }


    async function createCallRoom(
        scope,
        type
    ) {

        const communityId =
            scope ===
            "community"

                ? state
                    .currentCommunity
                    ?.id ||
                  null

                : null;


        const payload = {

            community_id:
                communityId,

            room_code:
                roomCode(),

            call_scope:
                scope,

            call_type:
                type,

            status:
                "waiting",

            created_by:
                state.user.id

        };


        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_call_rooms"
                )

                .insert(
                    payload
                )

                .select()

                .single();


        if (error) {

            throw error;

        }


        return data;

    }


    /* ============================================================
       ADD CALL PARTICIPANTS
       ============================================================ */

    async function addCallParticipants(
        roomId,
        userIds
    ) {

        const ids =
            [
                state.user.id,
                ...(userIds || [])
            ];


        const unique =
            [
                ...new Set(
                    ids
                        .filter(Boolean)
                        .map(
                            String
                        )
                )
            ];


        const rows =
            unique.map(
                userId => ({

                    room_id:
                        roomId,

                    user_id:
                        userId,

                    status:
                        userId ===
                        String(
                            state.user.id
                        )

                            ? "joined"

                            : "invited",

                    is_muted:
                        false,

                    is_camera_on:
                        callState.callType ===
                        "video",

                    is_screen_sharing:
                        false

                })
            );


        const {
            error
        } =
            await supabase

                .from(
                    "chat_call_participants"
                )

                .insert(
                    rows
                );


        if (error) {

            throw error;

        }

    }


    /* ============================================================
       START GENERAL CALL
       ============================================================ */

    async function startGeneralCall() {

        if (
            !callState.selectedUsers.length
        ) {

            toast(
                "Select at least one online user."
            );

            return;

        }


        try {

            const room =
                await createCallRoom(
                    "general",
                    callState.callType
                );


            await addCallParticipants(
                room.id,
                callState.selectedUsers
            );


            closeModal(
                "generalCallModal"
            );


            await enterCall(
                room
            );

        }

        catch (error) {

            console.error(
                "❌ General call:",
                error
            );

            toast(
                error.message
            );

        }

    }


    /* ============================================================
       START COMMUNITY CALL
       ============================================================ */

    async function startCommunityCall(
        type
    ) {

        if (
            !state.currentCommunity?.id
        ) {

            toast(
                "Select a community first."
            );

            return;

        }


        callState.callScope =
            "community";


        callState.callType =
            type;


        callState.selectedUsers =
            [];


        /*
         * Community call also uses the same
         * online-user picker.
         */

        openModal(
            "generalCallModal"
        );


        const title =
            document.querySelector(
                "#generalCallModal h2"
            );


        if (title) {

            title.textContent =
                "Start Community Call";

        }


        await renderCallPicker(
            true
        );

    }


    /* ============================================================
       DIRECT CALL
       ============================================================ */

    async function startDirectCall(
        userId,
        type = "video"
    ) {

        if (!userId) {

            toast(
                "Select a user first."
            );

            return;

        }


        callState.callScope =
            "direct";


        callState.callType =
            type;


        callState.selectedUsers =
            [
                userId
            ];


        try {

            const room =
                await createCallRoom(
                    "direct",
                    type
                );


            await addCallParticipants(
                room.id,
                [
                    userId
                ]
            );


            await enterCall(
                room
            );

        }

        catch (error) {

            console.error(
                "❌ Direct call:",
                error
            );

            toast(
                error.message
            );

        }

    }


    /* ============================================================
       LOCAL MEDIA
       ============================================================ */

    async function getLocalMedia() {

        if (
            !navigator
                .mediaDevices
                ?.getUserMedia
        ) {

            throw new Error(
                "Your browser does not support microphone/camera access."
            );

        }


        const stream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    audio: true,

                    video:
                        callState.callType ===
                        "video"

                });


        callState.localStream =
            stream;


        callState.microphoneOn =
            true;


        callState.cameraOn =
            callState.callType ===
            "video";


        const video =
            byId(
                "localVideo"
            );


        if (video) {

            video.srcObject =
                stream;

            video.muted =
                true;

            video.autoplay =
                true;

            video.playsInline =
                true;

        }


        return stream;

    }


    /* ============================================================
       CALL UI
       ============================================================ */

    function showCallOverlay() {

        show(
            byId(
                "callOverlay"
            )
        );


        const title =
            byId(
                "callTitle"
            );


        if (title) {

            title.textContent =

                callState.callScope ===
                "community"

                    ? "Community Call"

                    : callState.callScope ===
                      "direct"

                        ? "Direct Call"

                        : "General Call";

        }


        setText(
            byId(
                "callSubtitle"
            ),
            callState.callType ===
            "video"
                ? "Video call"
                : "Voice call"
        );


        setText(
            byId(
                "callTypeIcon"
            ),
            callState.callType ===
            "video"
                ? "📹"
                : "📞"
        );


        startCallTimer();

    }


    function startCallTimer() {

        callState.callStartedAt =
            Date.now();


        clearInterval(
            callState.durationTimer
        );


        callState.durationTimer =
            setInterval(
                () => {

                    const seconds =
                        Math.floor(
                            (
                                Date.now() -
                                callState.callStartedAt
                            ) / 1000
                        );


                    const minutes =
                        Math.floor(
                            seconds /
                            60
                        );


                    const remaining =
                        seconds %
                        60;


                    setText(
                        byId(
                            "callDuration"
                        ),

                        `${String(
                            minutes
                        ).padStart(
                            2,
                            "0"
                        )}:${String(
                            remaining
                        ).padStart(
                            2,
                            "0"
                        )}`

                    );

                },

                1000

            );

    }


    function hideCallOverlay() {

        hide(
            byId(
                "callOverlay"
            )
        );


        clearInterval(
            callState.durationTimer
        );


        callState.durationTimer =
            null;

    }


    /* ============================================================
       REMOTE TILE
       ============================================================ */

    function createRemoteTile(
        userId
    ) {

        const grid =
            byId(
                "callVideoGrid"
            );


        if (!grid) {
            return null;
        }


        const existing =
            grid.querySelector(
                `[data-user-id="${CSS.escape(
                    String(
                        userId
                    )
                )}"]`
            );


        if (existing) {
            return existing;
        }


        const profile =
            callState
                .remoteProfiles
                .get(
                    String(
                        userId
                    )
                );


        const name =
            profileName(
                profile,
                userId
            );


        const photo =
            profilePhoto(
                profile
            );


        const tile =
            document.createElement(
                "div"
            );


        tile.className =
            "call-video-tile";


        tile.dataset.userId =
            userId;


        tile.innerHTML = `

            <video
                autoplay
                playsinline
            ></video>


            <div class="remote-user-label">

                ${
                    photo

                        ? `

                            <img
                                src="${escapeHTML(
                                    photo
                                )}"
                                alt=""
                            >

                        `

                        : `

                            <span>
                                ${escapeHTML(
                                    initials(
                                        name
                                    )
                                )}
                            </span>

                        `
                }


                <strong>
                    ${escapeHTML(
                        name
                    )}
                </strong>

            </div>

        `;


        grid.appendChild(
            tile
        );


        return tile;

    }


    /* ============================================================
       WEBRTC PEER
       ============================================================ */

    function createPeer(
        remoteUserId
    ) {

        if (
            callState.peers.has(
                remoteUserId
            )
        ) {

            return callState
                .peers
                .get(
                    remoteUserId
                );

        }


        const peer =
            new RTCPeerConnection({

                iceServers: [

                    {
                        urls:
                            "stun:stun.l.google.com:19302"
                    }

                ]

            });


        callState
            .localStream
            ?.getTracks()
            .forEach(
                track => {

                    peer.addTrack(
                        track,
                        callState.localStream
                    );

                }
            );


        peer.onicecandidate =
            event => {

                if (
                    event.candidate
                ) {

                    sendSignal(

                        remoteUserId,

                        "ice-candidate",

                        event.candidate

                    );

                }

            };


        peer.ontrack =
            event => {

                const tile =
                    createRemoteTile(
                        remoteUserId
                    );


                const video =
                    tile?.querySelector(
                        "video"
                    );


                if (video) {

                    video.srcObject =
                        event
                            .streams[0];

                }

            };


        peer.onconnectionstatechange =
            () => {

                if (

                    peer.connectionState ===
                    "failed"

                    ||

                    peer.connectionState ===
                    "closed"

                    ||

                    peer.connectionState ===
                    "disconnected"

                ) {

                    removePeer(
                        remoteUserId
                    );

                }

            };


        callState.peers.set(
            remoteUserId,
            peer
        );


        return peer;

    }


    function removePeer(
        userId
    ) {

        const peer =
            callState
                .peers
                .get(
                    userId
                );


        if (peer) {

            try {

                peer.close();

            }

            catch {}

        }


        callState.peers.delete(
            userId
        );


        const tile =
            byId(
                "callVideoGrid"
            )
                ?.querySelector(
                    `[data-user-id="${CSS.escape(
                        String(
                            userId
                        )
                    )}"]`
                );


        tile?.remove();

    }


    /* ============================================================
       SIGNALING
       ============================================================ */

    async function sendSignal(
        receiverId,
        signalType,
        payload
    ) {

        if (
            !callState.roomId
        ) {

            return;

        }


        const {
            error
        } =
            await supabase

                .from(
                    "chat_call_signals"
                )

                .insert({

                    room_id:
                        callState.roomId,

                    sender_id:
                        callState.user.id,

                    receiver_id:
                        receiverId,

                    signal_type:
                        signalType,

                    payload:
                        payload

                });


        if (error) {

            console.error(
                "❌ Signal:",
                error
            );

        }

    }


    async function handleSignal(
        signal
    ) {

        if (
            String(
                signal.room_id
            ) !==
            String(
                callState.roomId
            )
        ) {

            return;

        }


        if (
            String(
                signal.receiver_id
            ) !==
            String(
                callState.user.id
            )
        ) {

            return;

        }


        const remoteUserId =
            signal.sender_id;


        const peer =
            createPeer(
                remoteUserId
            );


        if (
            signal.signal_type ===
            "offer"
        ) {

            await peer
                .setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );


            const answer =
                await peer
                    .createAnswer();


            await peer
                .setLocalDescription(
                    answer
                );


            await sendSignal(

                remoteUserId,

                "answer",

                answer

            );

        }


        else if (
            signal.signal_type ===
            "answer"
        ) {

            await peer
                .setRemoteDescription(
                    new RTCSessionDescription(
                        signal.payload
                    )
                );

        }


        else if (
            signal.signal_type ===
            "ice-candidate"
        ) {

            try {

                await peer
                    .addIceCandidate(
                        new RTCIceCandidate(
                            signal.payload
                        )
                    );

            }

            catch (
                error
            ) {

                console.warn(
                    "ICE candidate:",
                    error
                );

            }

        }


        else if (
            signal.signal_type ===
            "leave"
        ) {

            removePeer(
                remoteUserId
            );

        }

    }


    function subscribeToCallSignals() {

        const channel =
            supabase

                .channel(
                    "call-" +
                    callState.roomId +
                    "-" +
                    callState.user.id
                )

                .on(

                    "postgres_changes",

                    {

                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "chat_call_signals",

                        filter:
                            `room_id=eq.${callState.roomId}`

                    },

                    payload =>
                        handleSignal(
                            payload.new
                        )

                )

                .subscribe();


        callState
            .realtimeChannels
            .push(
                channel
            );

    }


    /* ============================================================
       PARTICIPANTS
       ============================================================ */

    async function loadCallParticipants() {

        const {
            data,
            error
        } =
            await supabase

                .from(
                    "chat_call_participants"
                )

                .select("*")

                .eq(
                    "room_id",
                    callState.roomId
                );


        if (error) {

            throw error;

        }


        const participants =
            data || [];


        const ids =
            participants
                .map(
                    participant =>
                        participant.user_id
                )
                .filter(
                    id =>
                        String(id) !==
                        String(
                            callState.user.id
                        )
                );


        if (ids.length) {

            const {
                data:
                    profiles
            } =
                await supabase

                    .from(
                        "students"
                    )

                    .select("*")

                    .in(
                        "id",
                        ids
                    );


            (
                profiles ||
                []
            )
                .forEach(
                    profile => {

                        callState
                            .remoteProfiles
                            .set(

                                String(
                                    profile.id
                                ),

                                profile

                            );

                    }
                );

        }


        return participants;

    }


    /* ============================================================
       CREATE OFFER
       ============================================================ */

    async function initiatePeer(
        remoteUserId
    ) {

        /*
         * Deterministic initiator.
         * Only one side creates the offer.
         */

        if (
            String(
                callState.user.id
            ) >=
            String(
                remoteUserId
            )
        ) {

            return;

        }


        const peer =
            createPeer(
                remoteUserId
            );


        const offer =
            await peer
                .createOffer();


        await peer
            .setLocalDescription(
                offer
            );


        await sendSignal(

            remoteUserId,

            "offer",

            offer

        );

    }


    /* ============================================================
       ENTER CALL
       ============================================================ */

    async function enterCall(
        room
    ) {

        callState.room =
            room;

        callState.roomId =
            room.id;


        await getLocalMedia();


        showCallOverlay();


        subscribeToCallSignals();


        const participants =
            await loadCallParticipants();


        const remoteIds =
            [
                ...new Set(
                    [

                        ...callState
                            .selectedUsers,

                        ...participants
                            .map(
                                participant =>
                                    participant
                                        .user_id
                            )

                    ]

                        .filter(
                            id =>
                                String(
                                    id
                                ) !==
                                String(
                                    callState
                                        .user
                                        .id
                                )
                        )
                )
            ];


        for (
            const userId
            of remoteIds
        ) {

            await initiatePeer(
                userId
            );

        }


        await supabase

            .from(
                "chat_call_participants"
            )

            .update({

                status:
                    "joined",

                joined_at:
                    new Date()
                        .toISOString(),

                is_camera_on:
                    callState.callType ===
                    "video"

            })

            .eq(
                "room_id",
                callState.roomId
            )

            .eq(
                "user_id",
                callState.user.id
            );


        await supabase

            .from(
                "chat_call_rooms"
            )

            .update({

                status:
                    "active",

                started_at:
                    new Date()
                        .toISOString()

            })

            .eq(
                "id",
                callState.roomId
            );

    }


    /* ============================================================
       MICROPHONE
       ============================================================ */

    async function toggleMicrophone() {

        const track =
            callState
                .localStream
                ?.getAudioTracks()
                [0];


        if (!track) {
            return;
        }


        track.enabled =
            !track.enabled;


        callState.microphoneOn =
            track.enabled;


        setText(

            byId(
                "toggleMicrophoneButton"
            ),

            track.enabled
                ? "🎙️"
                : "🔇"

        );


        await supabase

            .from(
                "chat_call_participants"
            )

            .update({

                is_muted:
                    !track.enabled

            })

            .eq(
                "room_id",
                callState.roomId
            )

            .eq(
                "user_id",
                callState.user.id
            );

    }


    /* ============================================================
       CAMERA
       ============================================================ */

    async function toggleCamera() {

        const track =
            callState
                .localStream
                ?.getVideoTracks()
                [0];


        if (!track) {
            return;
        }


        track.enabled =
            !track.enabled;


        callState.cameraOn =
            track.enabled;


        setText(

            byId(
                "toggleCameraButton"
            ),

            track.enabled
                ? "📹"
                : "🚫"

        );


        await supabase

            .from(
                "chat_call_participants"
            )

            .update({

                is_camera_on:
                    track.enabled

            })

            .eq(
                "room_id",
                callState.roomId
            )

            .eq(
                "user_id",
                callState.user.id
            );

    }


    /* ============================================================
       SCREEN SHARE
       ============================================================ */

    async function toggleScreenShare() {

        if (
            callState.screenSharing
        ) {

            await stopScreenShare();

            return;

        }


        if (
            !navigator
                .mediaDevices
                ?.getDisplayMedia
        ) {

            toast(
                "Screen sharing is not supported."
            );

            return;

        }


        try {

            const stream =
                await navigator
                    .mediaDevices
                    .getDisplayMedia({
                        video: true
                    });


            callState.screenStream =
                stream;


            const track =
                stream
                    .getVideoTracks()
                    [0];


            for (
                const peer
                of callState.peers.values()
            ) {

                const sender =
                    peer
                        .getSenders()
                        .find(
                            item =>
                                item.track
                                    ?.kind ===
                                "video"
                        );


                if (sender) {

                    await sender
                        .replaceTrack(
                            track
                        );

                }

            }


            const video =
                byId(
                    "localVideo"
                );


            if (video) {

                video.srcObject =
                    stream;

            }


            callState.screenSharing =
                true;


            track.onended =
                () =>
                    stopScreenShare();


            await supabase

                .from(
                    "chat_call_participants"
                )

                .update({

                    is_screen_sharing:
                        true

                })

                .eq(
                    "room_id",
                    callState.roomId
                )

                .eq(
                    "user_id",
                    callState.user.id
                );

        }

        catch (error) {

            console.warn(
                "Screen sharing cancelled:",
                error
            );

        }

    }


    async function stopScreenShare() {

        if (
            callState.screenStream
        ) {

            callState.screenStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        const cameraTrack =
            callState
                .localStream
                ?.getVideoTracks()
                [0];


        for (
            const peer
            of callState.peers.values()
        ) {

            const sender =
                peer
                    .getSenders()
                    .find(
                        item =>
                            item.track
                                ?.kind ===
                            "video"
                    );


            if (
                sender &&
                cameraTrack
            ) {

                await sender
                    .replaceTrack(
                        cameraTrack
                    );

            }

        }


        const video =
            byId(
                "localVideo"
            );


        if (
            video &&
            callState.localStream
        ) {

            video.srcObject =
                callState.localStream;

        }


        callState.screenStream =
            null;


        callState.screenSharing =
            false;


        if (
            callState.roomId
        ) {

            await supabase

                .from(
                    "chat_call_participants"
                )

                .update({

                    is_screen_sharing:
                        false

                })

                .eq(
                    "room_id",
                    callState.roomId
                )

                .eq(
                    "user_id",
                    callState.user.id
                );

        }

    }


    /* ============================================================
       LEAVE CALL
       ============================================================ */

    async function leaveCall() {

        const roomId =
            callState.roomId;


        if (!roomId) {

            cleanupCall();

            return;

        }


        try {

            await supabase

                .from(
                    "chat_call_signals"
                )

                .insert({

                    room_id:
                        roomId,

                    sender_id:
                        callState.user.id,

                    receiver_id:
                        null,

                    signal_type:
                        "leave",

                    payload: {}

                });

        }

        catch {}


        await supabase

            .from(
                "chat_call_participants"
            )

            .update({

                status:
                    "left",

                left_at:
                    new Date()
                        .toISOString()

            })

            .eq(
                "room_id",
                roomId
            )

            .eq(
                "user_id",
                callState.user.id
            );


        if (
            callState.room
                ?.created_by ===
            callState.user.id
        ) {

            await supabase

                .from(
                    "chat_call_rooms"
                )

                .update({

                    status:
                        "ended",

                    ended_at:
                        new Date()
                            .toISOString()

                })

                .eq(
                    "id",
                    roomId
                );

        }


        cleanupCall();

    }


    function cleanupCall() {

        callState.peers.forEach(
            peer => {

                try {

                    peer.close();

                }

                catch {}

            }
        );


        callState.peers.clear();


        callState
            .realtimeChannels
            .forEach(
                channel => {

                    try {

                        supabase
                            .removeChannel(
                                channel
                            );

                    }

                    catch {}

                }
            );


        callState
            .realtimeChannels =
            [];


        callState
            .localStream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        callState
            .screenStream
            ?.getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        callState.localStream =
            null;


        callState.screenStream =
            null;


        callState.room =
            null;


        callState.roomId =
            null;


        callState.selectedUsers =
            [];


        callState.remoteProfiles.clear();


        byId(
            "callVideoGrid"
        )
            ?.querySelectorAll(
                "[data-user-id]"
            )
            .forEach(
                element =>
                    element.remove()
            );


        const video =
            byId(
                "localVideo"
            );


        if (video) {

            video.srcObject =
                null;

        }


        hideCallOverlay();

    }


    /* ============================================================
       EVENTS
       ============================================================ */

    function bindEvents() {

        byId(
            "messageForm"
        )
            ?.addEventListener(
                "submit",
                sendMessage
            );


        byId(
            "channelSearchInput"
        )
            ?.addEventListener(
                "input",
                event => {

                    state.channelSearch =
                        event.target.value;

                    renderChannels();

                }
            );


        byId(
            "memberSearchInput"
        )
            ?.addEventListener(
                "input",
                event => {

                    state.memberSearch =
                        event.target.value;

                    renderMembers();

                }
            );


        byId(
            "messageSearchInput"
        )
            ?.addEventListener(
                "input",
                event => {

                    state.messageSearch =
                        event.target.value;

                    renderMessages();

                }
            );


        byId(
            "channelToggleButton"
        )
            ?.addEventListener(
                "click",
                openChannels
            );


        byId(
            "memberToggleButton"
        )
            ?.addEventListener(
                "click",
                openMembers
            );


        byId(
            "closeMemberSidebarButton"
        )
            ?.addEventListener(
                "click",
                closeMembers
            );


        byId(
            "communityDrawerOverlay"
        )
            ?.addEventListener(
                "click",
                () => {

                    closeChannels();

                    closeMembers();

                }
            );


        byId(
            "createCommunityButton"
        )
            ?.addEventListener(
                "click",
                () => {

                    if (
                        canCreateCommunity()
                    ) {

                        openModal(
                            "communityModal"
                        );

                    }

                    else {

                        toast(
                            "You do not have permission to create communities."
                        );

                    }

                }
            );


        byId(
            "createChannelButton"
        )
            ?.addEventListener(
                "click",
                () => {

                    if (
                        canCreateChannel()
                    ) {

                        openModal(
                            "channelModal"
                        );

                    }

                    else {

                        toast(
                            "You do not have permission to create channels."
                        );

                    }

                }
            );


        byId(
            "closeCommunityModalButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        "communityModal"
                    )
            );


        byId(
            "cancelCommunityButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        "communityModal"
                    )
            );


        byId(
            "closeChannelModalButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        "channelModal"
                    )
            );


        byId(
            "cancelChannelButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        "channelModal"
                    )
            );


        byId(
            "communityForm"
        )
            ?.addEventListener(
                "submit",
                createCommunity
            );


        byId(
            "channelForm"
        )
            ?.addEventListener(
                "submit",
                createChannel
            );


        byId(
            "generalCallButton"
        )
            ?.addEventListener(
                "click",
                openGeneralCall
            );


        byId(
            "generalVoiceCallButton"
        )
            ?.addEventListener(
                "click",
                () => {

                    callState.callType =
                        "voice";

                    byId(
                        "generalVoiceCallButton"
                    )
                        ?.classList
                        .add(
                            "active"
                        );


                    byId(
                        "generalVideoCallButton"
                    )
                        ?.classList
                        .remove(
                            "active"
                        );

                }
            );


        byId(
            "generalVideoCallButton"
        )
            ?.addEventListener(
                "click",
                () => {

                    callState.callType =
                        "video";

                    byId(
                        "generalVideoCallButton"
                    )
                        ?.classList
                        .add(
                            "active"
                        );


                    byId(
                        "generalVoiceCallButton"
                    )
                        ?.classList
                        .remove(
                            "active"
                        );

                }
            );


        byId(
            "startGeneralCallButton"
        )
            ?.addEventListener(
                "click",
                () => {

                    if (
                        callState.callScope ===
                        "community"
                    ) {

                        startSelectedCommunityCall();

                    }

                    else {

                        startGeneralCall();

                    }

                }
            );


        byId(
            "closeGeneralCallModalButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        "generalCallModal"
                    )
            );


        byId(
            "cancelGeneralCallButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    closeModal(
                        "generalCallModal"
                    )
            );


        byId(
            "voiceCallButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    startCommunityCall(
                        "voice"
                    )
            );


        byId(
            "videoCallButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    startCommunityCall(
                        "video"
                    )
            );


        byId(
            "toggleMicrophoneButton"
        )
            ?.addEventListener(
                "click",
                toggleMicrophone
            );


        byId(
            "toggleCameraButton"
        )
            ?.addEventListener(
                "click",
                toggleCamera
            );


        byId(
            "shareScreenButton"
        )
            ?.addEventListener(
                "click",
                toggleScreenShare
            );


        byId(
            "leaveCallButton"
        )
            ?.addEventListener(
                "click",
                leaveCall
            );


        byId(
            "minimizeCallButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    byId(
                        "callOverlay"
                    )
                        ?.classList
                        .toggle(
                            "minimized"
                        )
            );


        byId(
            "chatSearchButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    show(
                        byId(
                            "messageSearchPanel"
                        )
                    )
            );


        byId(
            "closeMessageSearchButton"
        )
            ?.addEventListener(
                "click",
                () =>
                    hide(
                        byId(
                            "messageSearchPanel"
                        )
                    )
            );


        window.addEventListener(
            "beforeunload",
            () => {

                setOffline();

            }
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "visible"
                ) {

                    setOnline();

                }

            }
        );

    }


    /* ============================================================
       COMMUNITY CALL PICKER
       ============================================================ */

    async function startSelectedCommunityCall() {

        if (
            !callState.selectedUsers.length
        ) {

            toast(
                "Select at least one online community member."
            );

            return;

        }


        try {

            const room =
                await createCallRoom(
                    "community",
                    callState.callType
                );


            await addCallParticipants(
                room.id,
                callState.selectedUsers
            );


            closeModal(
                "generalCallModal"
            );


            await enterCall(
                room
            );

        }

        catch (error) {

            console.error(
                "❌ Community call:",
                error
            );

            toast(
                error.message
            );

        }

    }


    /* ============================================================
       COMMUNITY CALL BUTTON OVERRIDE
       ============================================================ */

    /*
     * Clicking a community voice/video button opens
     * the online-user picker first.
     */

    async function communityCallWithPicker(
        type
    ) {

        callState.callScope =
            "community";


        callState.callType =
            type;


        callState.selectedUsers =
            [];


        const title =
            document.querySelector(
                "#generalCallModal h2"
            );


        if (title) {

            title.textContent =
                "Start Community Call";

        }


        openModal(
            "generalCallModal"
        );


        await renderCallPicker(
            true
        );

    }


    /*
     * Replace direct listeners after declaration.
     */

    byId(
        "voiceCallButton"
    )
        ?.addEventListener(
            "click",
            () =>
                communityCallWithPicker(
                    "voice"
                )
        );


    byId(
        "videoCallButton"
    )
        ?.addEventListener(
            "click",
            () =>
                communityCallWithPicker(
                    "video"
                )
        );


    /* ============================================================
       ACCEPT / DECLINE PLACEHOLDER
       ============================================================ */

    /*
     * Incoming-call detection is handled by the same
     * Supabase call-signal system.
     */

    function showIncomingCall(
        callerId,
        roomId
    ) {

        const toastElement =
            byId(
                "incomingCallToast"
            );


        if (!toastElement) {
            return;
        }


        setText(
            byId(
                "incomingCallTitle"
            ),
            "Incoming Call"
        );


        setText(
            byId(
                "incomingCallText"
            ),
            "Someone is calling you."
        );


        show(
            toastElement
        );


        byId(
            "acceptCallButton"
        )
            ?.addEventListener(
                "click",
                async () => {

                    hide(
                        toastElement
                    );


                    const {
                        data,
                        error
                    } =
                        await supabase

                            .from(
                                "chat_call_rooms"
                            )

                            .select("*")

                            .eq(
                                "id",
                                roomId
                            )

                            .maybeSingle();


                    if (
                        !error &&
                        data
                    ) {

                        callState.callScope =
                            data.call_scope;

                        callState.callType =
                            data.call_type;

                        callState.selectedUsers =
                            [
                                callerId
                            ];


                        await enterCall(
                            data
                        );

                    }

                }
            );


        byId(
            "declineCallButton"
        )
            ?.addEventListener(
                "click",
                () => {

                    hide(
                        toastElement
                    );

                }
            );

    }


    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initialize() {

        try {

            await loadCurrentUser();


            await loadCurrentProfile();


            await loadCourses();


            await loadCommunities();


            bindEvents();


            startPresence();


            if (
                state.communities.length
            ) {

                const stored =
                    localStorage.getItem(
                        STORAGE.communityId
                    );


                const selected =
                    state.communities.find(
                        community =>
                            String(
                                community.id
                            ) ===
                            String(
                                stored
                            )
                    );


                await selectCommunity(

                    selected?.id ||

                    state
                        .communities[0]
                        .id

                );

            }


            state.initialized =
                true;


            console.log(
                "Mwaniki Community fully initialized."
            );


            /*
             * Initialize call user state.
             */

            callState.user =
                state.user;


            callState.profile =
                state.profile;


            callState.initialized =
                true;


            console.log(
                "📞 Mwaniki Universal Call Engine ready"
            );


            /*
             * Public API.
             */

            window.mwanikiCommunity = {

                state,

                refresh:
                    initialize,

                selectCommunity,

                selectChannel,

                loadCommunities,

                loadChannels,

                loadMembers,

                loadMessages,

                sendMessage,

                openChannels,

                closeChannels,

                openMembers,

                closeMembers,

                getOnlineUsers

            };


            window.mwanikiCallEngine = {

                state:
                    callState,

                openGeneralCall,

                startGeneralCall,

                startCommunityCall:
                    communityCallWithPicker,

                startDirectCall,

                leaveCall,

                getOnlineUsers

            };


        }

        catch (error) {

            console.error(
                "❌ Mwaniki Community initialization failed:",
                error
            );


            const rail =
                byId(
                    "communityRail"
                );


            if (rail) {

                rail.innerHTML = `

                    <div class="channel-loading">

                        Community failed to load.

                        <br>

                        <small>
                            ${escapeHTML(
                                error.message ||
                                "Unknown error"
                            )}
                        </small>

                    </div>

                `;

            }


            toast(
                error.message ||
                "Community failed to initialize."
            );

        }

    }


    /* ============================================================
       START
       ============================================================ */

    initialize();

})();
