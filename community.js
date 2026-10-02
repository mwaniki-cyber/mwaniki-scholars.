/* ============================================================
   MWANIKI SCHOLARS COMMUNITY ENGINE
   ============================================================
   RESPONSIBILITIES:
   - Authentication
   - Student profile
   - Courses
   - Communities
   - Channels
   - Community members
   - Messages
   - Presence
   - Realtime
   - Community/channel UI

   IMPORTANT:
   This file contains NO call engine.
   Calls are handled exclusively by community-calls.js.
   ============================================================ */

import { supabase } from "./supabase.js";

(() => {
    "use strict";

    console.log("🚀 Mwaniki Scholars Community Engine loading...");

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

        realtimeChannels: [],

        presenceTimer: null,
        initialized: false,

        loadingCommunities: false,
        loadingChannels: false,
        loadingMessages: false,
        sendingMessage: false,

        drawerOverlayActive: false
    };

    /* ============================================================
       STORAGE
       ============================================================ */

    const STORAGE = {
        communityId: "mwanikiCommunityId",
        communityName: "mwanikiCommunityName",
        courseId: "mwanikiCommunityCourseId",
        courseName: "mwanikiCommunityCourseName",
        channelId: "mwanikiCommunityChannelId"
    };

    /* ============================================================
       ROLES
       ============================================================ */

    const ROLE_ORDER = {
        super_admin: 5,
        admin: 4,
        moderator: 3,
        tutor: 2,
        student: 1
    };

    /* ============================================================
       DOM HELPERS
       ============================================================ */

    function byId(id) {
        return document.getElementById(id);
    }

    function query(selector, parent = document) {
        return parent.querySelector(selector);
    }

    function queryAll(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    function showElement(element) {
        if (!element) return;
        element.classList.remove("hidden");
    }

    function hideElement(element) {
        if (!element) return;
        element.classList.add("hidden");
    }

    function setText(element, value) {
        if (!element) return;
        element.textContent = value ?? "";
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function initials(name) {
        const words = String(name || "Student")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) return "MS";

        return words
            .slice(0, 2)
            .map(word => word.charAt(0).toUpperCase())
            .join("");
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function formatTime(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    /* ============================================================
       TOAST
       ============================================================ */

    function toast(message, type = "info") {
        const element = byId("communityToast");

        if (!element) {
            console.log(`[Community ${type}]`, message);
            return;
        }

        element.textContent = message;
        element.dataset.type = type;
        element.classList.add("show");

        clearTimeout(toast.timer);

        toast.timer = setTimeout(() => {
            element.classList.remove("show");
        }, 3500);
    }

    /* ============================================================
       CURRENT USER
       ============================================================ */

    async function loadCurrentUser() {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error("❌ Authentication error:", error);
            throw error;
        }

        if (!user) {
            console.warn("⚠️ No authenticated user.");
            toast("Please sign in to use the community.", "error");
            return null;
        }

        state.user = user;

        return user;
    }

    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadStudentProfile() {
        if (!state.user?.id) return null;

        const { data, error } = await supabase
            .from("students")
            .select("*")
            .eq("id", state.user.id)
            .maybeSingle();

        if (error) {
            console.warn("⚠️ Student profile query:", error.message);
            state.profile = null;
            return null;
        }

        state.profile = data || null;

        return state.profile;
    }

    function getDisplayName(profile = state.profile, fallbackUser = state.user) {
        return (
            profile?.full_name ||
            profile?.name ||
            profile?.student_name ||
            profile?.display_name ||
            fallbackUser?.user_metadata?.full_name ||
            fallbackUser?.user_metadata?.name ||
            fallbackUser?.email?.split("@")[0] ||
            "Mwaniki Scholar"
        );
    }

    function getProfilePhoto(profile = state.profile, fallbackUser = state.user) {
        return (
            profile?.photo_url ||
            profile?.avatar_url ||
            profile?.profile_photo ||
            profile?.image_url ||
            fallbackUser?.user_metadata?.avatar_url ||
            fallbackUser?.user_metadata?.picture ||
            ""
        );
    }

    /* ============================================================
       COURSES
       ============================================================ */

    async function loadCourses() {
        const { data, error } = await supabase
            .from("courses")
            .select(`
                id,
                title,
                description,
                image,
                created_at
            `)
            .order("title", {
                ascending: true
            });

        if (error) {
            console.error("❌ Courses failed:", error);
            state.courses = [];
            return [];
        }

        state.courses = data || [];

        console.log(`Courses loaded: ${state.courses.length}`);

        populateCourseSelects();

        return state.courses;
    }

    function populateCourseSelects() {
        const selects = [
            byId("communityCourseSelect"),
            byId("channelCourseSelect")
        ];

        selects.forEach(select => {
            if (!select) return;

            const currentValue = select.value;

            select.innerHTML = `
                <option value="">No course linked</option>
            `;

            state.courses.forEach(course => {
                const option = document.createElement("option");

                option.value = course.id;
                option.textContent = course.title;

                select.appendChild(option);
            });

            if (currentValue) {
                select.value = currentValue;
            }
        });
    }

    /* ============================================================
       COMMUNITIES
       ============================================================ */

    async function loadCommunities() {
        if (state.loadingCommunities) {
            return state.communities;
        }

        state.loadingCommunities = true;

        const rail = byId("communityRail");

        if (rail) {
            rail.innerHTML = `
                <div class="channel-loading">
                    Loading communities...
                </div>
            `;
        }

        console.log("Loading communities...");

        try {
            const { data, error } = await supabase
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
                    created_at,
                    updated_at
                `)
                .eq("is_active", true)
                .order("created_at", {
                    ascending: true
                });

            if (error) {
                console.error("❌ Communities query failed:", error);

                if (rail) {
                    rail.innerHTML = `
                        <div class="channel-loading">
                            Unable to load communities.
                            <br>
                            <small>${escapeHTML(error.message)}</small>
                        </div>
                    `;
                }

                throw error;
            }

            state.communities = data || [];

            console.log(
                `Communities loaded: ${state.communities.length}`
            );

            renderCommunities();

            return state.communities;

        } finally {
            state.loadingCommunities = false;
        }
    }

    function renderCommunities() {
        const rail = byId("communityRail");

        if (!rail) return;

        rail.innerHTML = "";

        if (!state.communities.length) {
            rail.innerHTML = `
                <div class="channel-loading">
                    No communities available.
                </div>
            `;
            return;
        }

        state.communities.forEach(community => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "community-rail-item";

            if (
                state.currentCommunity &&
                String(state.currentCommunity.id) === String(community.id)
            ) {
                button.classList.add("active");
            }

            button.dataset.communityId = community.id;

            const icon = community.icon_url
                ? `
                    <img
                        src="${escapeHTML(community.icon_url)}"
                        alt=""
                        class="community-rail-icon"
                    >
                `
                : `
                    <span class="community-rail-icon community-initials">
                        ${escapeHTML(initials(community.name))}
                    </span>
                `;

            button.innerHTML = `
                ${icon}
                <span class="community-rail-name">
                    ${escapeHTML(community.name)}
                </span>
            `;

            button.addEventListener("click", () => {
                selectCommunity(community.id);
            });

            rail.appendChild(button);
        });

        const createButton = byId("createCommunityButton");

        if (createButton) {
            createButton.style.display =
                canManageCommunities()
                    ? ""
                    : "none";
        }
    }

    /* ============================================================
       COMMUNITY PERMISSIONS
       ============================================================ */

    function getRoleLevel(role = state.currentRole) {
        return ROLE_ORDER[role] || 0;
    }

    function canManageCommunities() {
        return getRoleLevel() >= ROLE_ORDER.admin;
    }

    function canManageChannels() {
        return getRoleLevel() >= ROLE_ORDER.moderator;
    }

    /* ============================================================
       MEMBERSHIP
       ============================================================ */

    async function ensureCommunityMembership(communityId) {
        if (!state.user?.id || !communityId) {
            return null;
        }

        const { data: existing, error: selectError } = await supabase
            .from("chat_community_members")
            .select(`
                id,
                community_id,
                user_id,
                role,
                nickname,
                is_muted,
                is_banned,
                joined_at,
                last_seen_at
            `)
            .eq("community_id", communityId)
            .eq("user_id", state.user.id)
            .maybeSingle();

        if (selectError) {
            console.warn(
                "⚠️ Membership lookup:",
                selectError.message
            );
        }

        if (existing) {
            return existing;
        }

        const { data: inserted, error: insertError } = await supabase
            .from("chat_community_members")
            .insert({
                community_id: communityId,
                user_id: state.user.id,
                role: "student"
            })
            .select()
            .single();

        if (insertError) {
            console.warn(
                "⚠️ Could not create membership:",
                insertError.message
            );

            return null;
        }

        return inserted;
    }

    async function loadCommunityRole(communityId) {
        if (!state.user?.id || !communityId) {
            state.currentRole = "student";
            return "student";
        }

        const { data, error } = await supabase
            .from("chat_community_members")
            .select(`
                role,
                is_muted,
                is_banned
            `)
            .eq("community_id", communityId)
            .eq("user_id", state.user.id)
            .maybeSingle();

        if (error) {
            console.warn(
                "⚠️ Community role lookup:",
                error.message
            );

            state.currentRole = "student";
            return "student";
        }

        if (data?.is_banned) {
            toast(
                "You are restricted from this community.",
                "error"
            );
        }

        state.currentRole = data?.role || "student";

        return state.currentRole;
    }

    /* ============================================================
       SELECT COMMUNITY
       ============================================================ */

    async function selectCommunity(communityId) {
        const community = state.communities.find(
            item => String(item.id) === String(communityId)
        );

        if (!community) {
            console.warn(
                "Community not found:",
                communityId
            );
            return;
        }

        state.currentCommunity = community;
        state.currentChannel = null;
        state.currentCourse = null;
        state.currentRole = "student";
        state.channels = [];
        state.members = [];
        state.messages = [];

        localStorage.setItem(
            STORAGE.communityId,
            String(community.id)
        );

        localStorage.setItem(
            STORAGE.communityName,
            community.name || ""
        );

        renderCommunities();
        renderActiveCommunity();

        await ensureCommunityMembership(community.id);
        await loadCommunityRole(community.id);

        renderActiveRole();

        await loadCommunityCourse(community);

        await loadChannels();

        await loadMembers();

        closeChannelDrawer();

        console.log(
            "Active community:",
            community.name
        );
    }

    /* ============================================================
       ACTIVE COMMUNITY UI
       ============================================================ */

    function renderActiveCommunity() {
        const community = state.currentCommunity;

        if (!community) return;

        setText(
            byId("activeCommunityName"),
            community.name
        );

        setText(
            byId("activeCommunityDescription"),
            community.description || ""
        );

        const icon = byId("activeCommunityIcon");

        if (icon) {
            if (community.icon_url) {
                icon.src = community.icon_url;
                icon.style.display = "";
            } else {
                icon.removeAttribute("src");
                icon.style.display = "none";
            }
        }

        const banner = byId("communityCourseBanner");

        if (banner) {
            banner.classList.add("hidden");
        }

        const courseName = byId("communityCourseName");
        const courseLabel = byId("communityCourseLabel");

        if (courseName) {
            courseName.textContent = "";
        }

        if (courseLabel) {
            courseLabel.textContent = "";
        }
    }

    function renderActiveRole() {
        const badge = byId("activeRoleBadge");

        if (!badge) return;

        badge.textContent =
            String(state.currentRole || "student")
                .replace("_", " ")
                .replace(/\b\w/g, char => char.toUpperCase());
    }

    /* ============================================================
       COURSE CONTEXT
       ============================================================ */

    async function loadCommunityCourse(community) {
        if (!community?.course_id) {
            return null;
        }

        const course = state.courses.find(
            item => String(item.id) === String(community.course_id)
        );

        if (!course) {
            return null;
        }

        state.currentCourse = course;

        localStorage.setItem(
            STORAGE.courseId,
            String(course.id)
        );

        localStorage.setItem(
            STORAGE.courseName,
            course.title || ""
        );

        const banner = byId("communityCourseBanner");
        const name = byId("communityCourseName");
        const label = byId("communityCourseLabel");

        if (banner) {
            banner.classList.remove("hidden");
        }

        setText(name, course.title);
        setText(label, "Course Community");

        return course;
    }

    /* ============================================================
       CHANNELS
       ============================================================ */

    async function loadChannels() {
        if (!state.currentCommunity?.id) {
            return [];
        }

        if (state.loadingChannels) {
            return state.channels;
        }

        state.loadingChannels = true;

        const list = byId("channelList");

        if (list) {
            list.innerHTML = `
                <div class="channel-loading">
                    Loading channels...
                </div>
            `;
        }

        console.log(
            "Loading channels for community:",
            state.currentCommunity.id
        );

        try {
            const { data, error } = await supabase
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
                    created_at,
                    updated_at
                `)
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

            if (error) {
                console.error(
                    "❌ Channels query failed:",
                    error
                );

                if (list) {
                    list.innerHTML = `
                        <div class="channel-loading">
                            Unable to load channels.
                            <br>
                            <small>${escapeHTML(error.message)}</small>
                        </div>
                    `;
                }

                throw error;
            }

            state.channels = data || [];

            console.log(
                `Channels loaded: ${state.channels.length}`
            );

            await filterPrivateChannels();

            renderChannels();

            await selectInitialChannel();

            return state.channels;

        } finally {
            state.loadingChannels = false;
        }
    }

    async function filterPrivateChannels() {
        if (!state.user?.id) return;

        const privateChannels = state.channels.filter(
            channel => channel.is_private
        );

        if (!privateChannels.length) {
            return;
        }

        const privateIds = privateChannels.map(
            channel => channel.id
        );

        const { data, error } = await supabase
            .from("chat_channel_members")
            .select(`
                channel_id,
                user_id
            `)
            .eq("user_id", state.user.id)
            .in("channel_id", privateIds);

        if (error) {
            console.warn(
                "⚠️ Private channel lookup:",
                error.message
            );

            state.channels = state.channels.filter(
                channel => !channel.is_private
            );

            return;
        }

        const allowed = new Set(
            (data || []).map(row => String(row.channel_id))
        );

        state.channels = state.channels.filter(channel => {
            if (!channel.is_private) {
                return true;
            }

            return allowed.has(String(channel.id));
        });
    }

    function renderChannels() {
        const list = byId("channelList");

        if (!list) return;

        list.innerHTML = "";

        const search = state.channelSearch
            .trim()
            .toLowerCase();

        const channels = state.channels.filter(channel => {
            if (!search) return true;

            return (
                String(channel.name || "")
                    .toLowerCase()
                    .includes(search) ||
                String(channel.description || "")
                    .toLowerCase()
                    .includes(search)
            );
        });

        if (!channels.length) {
            list.innerHTML = `
                <div class="channel-loading">
                    No channels found.
                </div>
            `;
            return;
        }

        const categories = new Map();

        channels.forEach(channel => {
            const category =
                channel.channel_type ||
                "text";

            if (!categories.has(category)) {
                categories.set(category, []);
            }

            categories.get(category).push(channel);
        });

        categories.forEach((items, category) => {
            const categoryTitle =
                document.createElement("div");

            categoryTitle.className =
                "channel-category-title";

            categoryTitle.textContent =
                String(category)
                    .replace("_", " ")
                    .toUpperCase();

            list.appendChild(categoryTitle);

            items.forEach(channel => {
                const button =
                    document.createElement("button");

                button.type = "button";
                button.className = "channel-item";

                if (
                    state.currentChannel &&
                    String(state.currentChannel.id) ===
                        String(channel.id)
                ) {
                    button.classList.add("active");
                }

                button.dataset.channelId = channel.id;

                const icon =
                    channel.icon ||
                    (channel.channel_type === "voice"
                        ? "🔊"
                        : "#");

                button.innerHTML = `
                    <span class="channel-item-icon">
                        ${escapeHTML(icon)}
                    </span>

                    <span class="channel-item-content">
                        <strong>
                            ${escapeHTML(channel.name)}
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
                    () => selectChannel(channel.id)
                );

                list.appendChild(button);
            });
        });

        const createButton =
            byId("createChannelButton");

        if (createButton) {
            createButton.style.display =
                canManageChannels()
                    ? ""
                    : "none";
        }
    }

    async function selectInitialChannel() {
        if (!state.channels.length) {
            state.currentChannel = null;
            renderNoChannel();
            return;
        }

        const storedId =
            localStorage.getItem(STORAGE.channelId);

        let channel =
            state.channels.find(
                item =>
                    String(item.id) ===
                    String(storedId)
            );

        if (!channel) {
            channel = state.channels[0];
        }

        await selectChannel(channel.id);
    }

    async function selectChannel(channelId) {
        const channel = state.channels.find(
            item => String(item.id) === String(channelId)
        );

        if (!channel) {
            console.warn(
                "Channel not found:",
                channelId
            );
            return;
        }

        state.currentChannel = channel;
        state.currentReply = null;
        state.messages = [];

        localStorage.setItem(
            STORAGE.channelId,
            String(channel.id)
        );

        renderChannels();
        renderActiveChannel();

        await loadMessages();

        closeChannelDrawer();
    }

    function renderActiveChannel() {
        const channel = state.currentChannel;

        if (!channel) {
            renderNoChannel();
            return;
        }

        setText(
            byId("activeChannelName"),
            channel.name
        );

        setText(
            byId("activeChannelDescription"),
            channel.description || ""
        );

        renderActiveRole();
    }

    function renderNoChannel() {
        setText(
            byId("activeChannelName"),
            "No channel"
        );

        setText(
            byId("activeChannelDescription"),
            "There are no accessible channels in this community."
        );

        const list = byId("messageList");

        if (list) {
            list.innerHTML = `
                <div class="message-empty">
                    <h3>No channel selected</h3>
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
        if (!state.currentCommunity?.id) {
            state.members = [];
            renderMembers();
            return [];
        }

        const { data, error } = await supabase
            .from("chat_community_members")
            .select(`
                id,
                community_id,
                user_id,
                role,
                nickname,
                is_muted,
                is_banned,
                joined_at,
                last_seen_at
            `)
            .eq(
                "community_id",
                state.currentCommunity.id
            )
            .order("joined_at", {
                ascending: true
            });

        if (error) {
            console.error(
                "❌ Members query failed:",
                error
            );

            state.members = [];
            renderMembers();

            return [];
        }

        const members = data || [];

        const userIds = [
            ...new Set(
                members
                    .map(member => member.user_id)
                    .filter(Boolean)
            )
        ];

        let profiles = [];

        if (userIds.length) {
            const result = await supabase
                .from("students")
                .select("*")
                .in("id", userIds);

            if (result.error) {
                console.warn(
                    "⚠️ Student profiles:",
                    result.error.message
                );
            } else {
                profiles = result.data || [];
            }
        }

        const profileMap = new Map(
            profiles.map(profile => [
                String(profile.id),
                profile
            ])
        );

        state.members = members.map(member => ({
            ...member,
            profile:
                profileMap.get(
                    String(member.user_id)
                ) || null
        }));

        renderMembers();

        return state.members;
    }

    function renderMembers() {
        const list = byId("memberList");

        if (!list) return;

        const count = byId("memberCount");

        if (count) {
            count.textContent =
                String(state.members.length);
        }

        list.innerHTML = "";

        const search =
            state.memberSearch
                .trim()
                .toLowerCase();

        const members =
            state.members.filter(member => {
                const name =
                    getMemberName(member)
                        .toLowerCase();

                return !search ||
                    name.includes(search);
            });

        if (!members.length) {
            list.innerHTML = `
                <div class="member-empty">
                    No members found.
                </div>
            `;
            return;
        }

        members.forEach(member => {
            const profile = member.profile || {};

            const name =
                getMemberName(member);

            const photo =
                getMemberPhoto(member);

            const item =
                document.createElement("div");

            item.className = "community-member-item";

            item.innerHTML = `
                <div class="member-avatar">
                    ${
                        photo
                            ? `
                                <img
                                    src="${escapeHTML(photo)}"
                                    alt=""
                                >
                            `
                            : `
                                <span>
                                    ${escapeHTML(
                                        initials(name)
                                    )}
                                </span>
                            `
                    }
                </div>

                <div class="member-info">
                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <small>
                        ${escapeHTML(
                            formatRole(member.role)
                        )}
                    </small>
                </div>
            `;

            list.appendChild(item);
        });
    }

    function getMemberName(member) {
        const profile =
            member?.profile || {};

        return (
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            member.nickname ||
            (member.user_id === state.user?.id
                ? getDisplayName()
                : "Mwaniki Scholar")
        );
    }

    function getMemberPhoto(member) {
        const profile =
            member?.profile || {};

        return (
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.image_url ||
            ""
        );
    }

    function formatRole(role) {
        return String(role || "student")
            .replace(/_/g, " ")
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            );
    }

    /* ============================================================
       MESSAGES
       ============================================================ */

    async function loadMessages() {
        if (!state.currentChannel?.id) {
            state.messages = [];
            renderMessages();
            return [];
        }

        state.loadingMessages = true;

        const list = byId("messageList");

        if (list) {
            list.innerHTML = `
                <div class="message-loading">
                    Loading messages...
                </div>
            `;
        }

        try {
            const { data, error } = await supabase
                .from("chat_messages")
                .select("*")
                .eq(
                    "channel_id",
                    state.currentChannel.id
                )
                .order("created_at", {
                    ascending: true
                })
                .limit(500);

            if (error) {
                console.error(
                    "❌ Messages query failed:",
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

                return [];
            }

            state.messages =
                await enrichMessages(data || []);

            renderMessages();

            return state.messages;

        } finally {
            state.loadingMessages = false;
        }
    }

    async function enrichMessages(messages) {
        if (!messages.length) {
            return [];
        }

        const userIds = [
            ...new Set(
                messages
                    .map(message => message.user_id)
                    .filter(Boolean)
            )
        ];

        let profiles = [];

        if (userIds.length) {
            const { data, error } =
                await supabase
                    .from("students")
                    .select("*")
                    .in("id", userIds);

            if (error) {
                console.warn(
                    "⚠️ Message profile lookup:",
                    error.message
                );
            } else {
                profiles = data || [];
            }
        }

        const profileMap =
            new Map(
                profiles.map(profile => [
                    String(profile.id),
                    profile
                ])
            );

        return messages.map(message => ({
            ...message,
            profile:
                profileMap.get(
                    String(message.user_id)
                ) || null
        }));
    }

    function renderMessages() {
        const list = byId("messageList");

        if (!list) return;

        list.innerHTML = "";

        const search =
            state.messageSearch
                .trim()
                .toLowerCase();

        const messages =
            state.messages.filter(message => {
                if (!search) return true;

                return String(
                    message.content || ""
                )
                    .toLowerCase()
                    .includes(search);
            });

        if (!messages.length) {
            list.innerHTML = `
                <div class="message-empty">
                    <h3>No messages yet</h3>
                    <p>
                        Start the conversation.
                    </p>
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            list.appendChild(
                createMessageElement(message)
            );
        });

        list.scrollTop = list.scrollHeight;
    }

    function createMessageElement(message) {
        const wrapper =
            document.createElement("article");

        wrapper.className = "chat-message";

        wrapper.dataset.messageId =
            message.id || "";

        const profile =
            message.profile || {};

        const name =
            profile.full_name ||
            profile.name ||
            profile.student_name ||
            profile.display_name ||
            (
                message.user_id ===
                state.user?.id
                    ? getDisplayName()
                    : "Mwaniki Scholar"
            );

        const photo =
            profile.photo_url ||
            profile.avatar_url ||
            profile.profile_photo ||
            profile.image_url ||
            "";

        const content =
            message.content ||
            message.message ||
            "";

        const created =
            message.created_at;

        wrapper.innerHTML = `
            <div class="message-avatar">
                ${
                    photo
                        ? `
                            <img
                                src="${escapeHTML(photo)}"
                                alt=""
                            >
                        `
                        : `
                            <span>
                                ${escapeHTML(
                                    initials(name)
                                )}
                            </span>
                        `
                }
            </div>

            <div class="message-body">

                <div class="message-header">

                    <strong class="message-author">
                        ${escapeHTML(name)}
                    </strong>

                    <time
                        class="message-time"
                        datetime="${escapeHTML(
                            created || ""
                        )}"
                    >
                        ${escapeHTML(
                            formatTime(created)
                        )}
                    </time>

                </div>

                <div class="message-content">
                    ${escapeHTML(content)}
                </div>

            </div>
        `;

        return wrapper;
    }

    /* ============================================================
       SEND MESSAGE
       ============================================================ */

    async function sendMessage(event) {
        if (event) {
            event.preventDefault();
        }

        if (state.sendingMessage) {
            return;
        }

        if (!state.user?.id) {
            toast(
                "You must be signed in.",
                "error"
            );
            return;
        }

        if (!state.currentChannel?.id) {
            toast(
                "Select a channel first.",
                "error"
            );
            return;
        }

        const input =
            byId("messageInput");

        if (!input) return;

        const content =
            input.value.trim();

        if (!content) {
            return;
        }

        state.sendingMessage = true;

        const sendButton =
            byId("sendMessageButton");

        if (sendButton) {
            sendButton.disabled = true;
        }

        try {
            const payload = {
                channel_id:
                    state.currentChannel.id,

                user_id:
                    state.user.id,

                content
            };

            if (state.currentReply?.id) {
                payload.reply_to =
                    state.currentReply.id;
            }

            const { data, error } =
                await supabase
                    .from("chat_messages")
                    .insert(payload)
                    .select("*")
                    .single();

            if (error) {
                console.error(
                    "❌ Send message failed:",
                    error
                );

                toast(
                    error.message ||
                        "Unable to send message.",
                    "error"
                );

                return;
            }

            input.value = "";

            cancelReply();

            const enriched =
                await enrichMessages([data]);

            if (enriched[0]) {
                state.messages.push(
                    enriched[0]
                );

                renderMessages();
            }

        } finally {
            state.sendingMessage = false;

            if (sendButton) {
                sendButton.disabled = false;
            }
        }
    }

    /* ============================================================
       REPLY
       ============================================================ */

    function cancelReply() {
        state.currentReply = null;

        const preview =
            byId("replyPreview");

        if (preview) {
            preview.classList.add("hidden");
        }

        setText(
            byId("replyPreviewText"),
            ""
        );
    }

    /* ============================================================
       PRESENCE
       ============================================================ */

    async function setOnlinePresence() {
        if (!state.user?.id) return;

        const now =
            new Date().toISOString();

        const { error } =
            await supabase
                .from("chat_presence")
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
                "⚠️ Presence update:",
                error.message
            );
        }
    }

    async function setOfflinePresence() {
        if (!state.user?.id) return;

        const { error } =
            await supabase
                .from("chat_presence")
                .update({
                    status: "offline",
                    last_seen_at:
                        new Date().toISOString(),
                    updated_at:
                        new Date().toISOString()
                })
                .eq(
                    "user_id",
                    state.user.id
                );

        if (error) {
            console.warn(
                "⚠️ Offline presence:",
                error.message
            );
        }
    }

    function startPresence() {
        if (state.presenceTimer) {
            clearInterval(
                state.presenceTimer
            );
        }

        setOnlinePresence();

        state.presenceTimer =
            setInterval(
                setOnlinePresence,
                30000
            );
    }

    /* ============================================================
       REALTIME
       ============================================================ */

    function removeRealtimeChannels() {
        state.realtimeChannels.forEach(channel => {
            try {
                supabase.removeChannel(
                    channel
                );
            } catch (error) {
                console.warn(
                    "Realtime cleanup:",
                    error
                );
            }
        });

        state.realtimeChannels = [];
    }

    function subscribeToMessages() {
        if (!state.currentChannel?.id) {
            return;
        }

        const channel =
            supabase
                .channel(
                    `community-messages-${state.currentChannel.id}`
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
                    async payload => {
                        const enriched =
                            await enrichMessages([
                                payload.new
                            ]);

                        if (!enriched[0]) {
                            return;
                        }

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

    function subscribeToCommunityChanges() {
        if (!state.currentCommunity?.id) {
            return;
        }

        const channel =
            supabase
                .channel(
                    `community-data-${state.currentCommunity.id}`
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
            channel
        );
    }

    function refreshRealtime() {
        removeRealtimeChannels();

        subscribeToMessages();
        subscribeToCommunityChanges();
    }

    /* ============================================================
       DRAWERS
       ============================================================ */

    function openChannelDrawer() {
        const sidebar =
            byId("channelSidebar");

        if (sidebar) {
            sidebar.classList.add(
                "drawer-open"
            );
        }

        openDrawerOverlay();
    }

    function closeChannelDrawer() {
        const sidebar =
            byId("channelSidebar");

        if (sidebar) {
            sidebar.classList.remove(
                "drawer-open"
            );
        }

        if (!byId("memberSidebar")?.classList.contains("drawer-open")) {
            closeDrawerOverlay();
        }
    }

    function openMemberDrawer() {
        const sidebar =
            byId("memberSidebar");

        if (sidebar) {
            sidebar.classList.add(
                "drawer-open"
            );
        }

        openDrawerOverlay();
    }

    function closeMemberDrawer() {
        const sidebar =
            byId("memberSidebar");

        if (sidebar) {
            sidebar.classList.remove(
                "drawer-open"
            );
        }

        if (!byId("channelSidebar")?.classList.contains("drawer-open")) {
            closeDrawerOverlay();
        }
    }

    function openDrawerOverlay() {
        const overlay =
            byId("communityDrawerOverlay");

        if (!overlay) return;

        overlay.classList.add("show");

        state.drawerOverlayActive =
            true;
    }

    function closeDrawerOverlay() {
        const overlay =
            byId("communityDrawerOverlay");

        if (!overlay) return;

        overlay.classList.remove("show");

        state.drawerOverlayActive =
            false;
    }

    /* ============================================================
       MODALS
       ============================================================ */

    function openCommunityModal() {
        if (!canManageCommunities()) {
            toast(
                "You do not have permission to create communities.",
                "error"
            );
            return;
        }

        const modal =
            byId("communityModal");

        if (modal) {
            modal.classList.remove(
                "hidden"
            );
        }
    }

    function closeCommunityModal() {
        const modal =
            byId("communityModal");

        if (modal) {
            modal.classList.add(
                "hidden"
            );
        }

        const form =
            byId("communityForm");

        if (form) {
            form.reset();
        }

        setText(
            byId("communityFormMessage"),
            ""
        );
    }

    function openChannelModal() {
        if (!canManageChannels()) {
            toast(
                "You do not have permission to create channels.",
                "error"
            );
            return;
        }

        const modal =
            byId("channelModal");

        if (modal) {
            modal.classList.remove(
                "hidden"
            );
        }
    }

    function closeChannelModal() {
        const modal =
            byId("channelModal");

        if (modal) {
            modal.classList.add(
                "hidden"
            );
        }

        const form =
            byId("channelForm");

        if (form) {
            form.reset();
        }

        setText(
            byId("channelFormMessage"),
            ""
        );
    }

    /* ============================================================
       CREATE COMMUNITY
       ============================================================ */

    async function createCommunity(event) {
        event.preventDefault();

        if (!canManageCommunities()) {
            return;
        }

        const name =
            byId("communityNameInput")
                ?.value
                .trim();

        const description =
            byId("communityDescriptionInput")
                ?.value
                .trim();

        const courseId =
            byId("communityCourseSelect")
                ?.value || null;

        const iconUrl =
            byId("communityIconInput")
                ?.value
                .trim() || null;

        if (!name) {
            setText(
                byId("communityFormMessage"),
                "Community name is required."
            );
            return;
        }

        const slug =
            createSlug(name);

        const { data, error } =
            await supabase
                .from("chat_communities")
                .insert({
                    name,
                    slug,
                    description:
                        description || null,
                    icon_url:
                        iconUrl,
                    is_public: true,
                    is_active: true,
                    created_by:
                        state.user.id,
                    ...(courseId
                        ? {
                            course_id:
                                courseId
                        }
                        : {})
                })
                .select()
                .single();

        if (error) {
            console.error(
                "❌ Create community failed:",
                error
            );

            setText(
                byId("communityFormMessage"),
                error.message
            );

            return;
        }

        closeCommunityModal();

        toast(
            "Community created successfully.",
            "success"
        );

        await loadCommunities();

        if (data?.id) {
            await selectCommunity(data.id);
        }
    }

    /* ============================================================
       CREATE CHANNEL
       ============================================================ */

    async function createChannel(event) {
        event.preventDefault();

        if (!canManageChannels()) {
            return;
        }

        if (!state.currentCommunity?.id) {
            return;
        }

        const name =
            byId("channelNameInput")
                ?.value
                .trim();

        const description =
            byId("channelDescriptionInput")
                ?.value
                .trim();

        const category =
            byId("channelCategoryInput")
                ?.value
                .trim();

        const visibility =
            byId("channelVisibilitySelect")
                ?.value || "public";

        const courseId =
            byId("channelCourseSelect")
                ?.value || null;

        if (!name) {
            setText(
                byId("channelFormMessage"),
                "Channel name is required."
            );
            return;
        }

        const position =
            state.channels.length + 1;

        const { data, error } =
            await supabase
                .from("chat_channels")
                .insert({
                    community_id:
                        state.currentCommunity.id,

                    name,

                    slug:
                        createSlug(name),

                    description:
                        description || null,

                    channel_type:
                        category || "text",

                    position,

                    is_private:
                        visibility === "private",

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
                "❌ Create channel failed:",
                error
            );

            setText(
                byId("channelFormMessage"),
                error.message
            );

            return;
        }

        closeChannelModal();

        toast(
            "Channel created successfully.",
            "success"
        );

        await loadChannels();

        if (data?.id) {
            await selectChannel(data.id);
        }
    }

    function createSlug(value) {
        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80);
    }

    /* ============================================================
       SEARCH
       ============================================================ */

    function handleChannelSearch(event) {
        state.channelSearch =
            event.target.value || "";

        renderChannels();
    }

    function handleMemberSearch(event) {
        state.memberSearch =
            event.target.value || "";

        renderMembers();
    }

    function openMessageSearch() {
        const panel =
            byId("messageSearchPanel");

        if (!panel) return;

        panel.classList.remove(
            "hidden"
        );

        byId("messageSearchInput")?.focus();
    }

    function closeMessageSearch() {
        const panel =
            byId("messageSearchPanel");

        if (!panel) return;

        panel.classList.add(
            "hidden"
        );

        const input =
            byId("messageSearchInput");

        if (input) {
            input.value = "";
        }

        state.messageSearch = "";

        renderMessages();
    }

    function handleMessageSearch(event) {
        state.messageSearch =
            event.target.value || "";

        renderMessages();
    }

    /* ============================================================
       MENU
       ============================================================ */

    function openCommunityMenu() {
        const menu =
            byId("communityMenu");

        if (menu) {
            menu.classList.toggle(
                "hidden"
            );
        }
    }

    function closeCommunityMenu() {
        const menu =
            byId("communityMenu");

        if (menu) {
            menu.classList.add(
                "hidden"
            );
        }
    }

    /* ============================================================
       REFRESH
       ============================================================ */

    async function refreshCommunity() {
        console.log(
            "🔄 Refreshing community..."
        );

        await loadCourses();
        await loadCommunities();

        if (state.currentCommunity?.id) {
            const exists =
                state.communities.some(
                    community =>
                        String(community.id) ===
                        String(
                            state.currentCommunity.id
                        )
                );

            if (exists) {
                await selectCommunity(
                    state.currentCommunity.id
                );

                return;
            }
        }

        if (state.communities.length) {
            const stored =
                localStorage.getItem(
                    STORAGE.communityId
                );

            const selected =
                state.communities.find(
                    community =>
                        String(community.id) ===
                        String(stored)
                );

            await selectCommunity(
                selected?.id ||
                state.communities[0].id
            );
        }
    }

    /* ============================================================
       EVENT BINDINGS
       ============================================================ */

    function bindEvents() {
        byId("messageForm")
            ?.addEventListener(
                "submit",
                sendMessage
            );

        byId("channelSearchInput")
            ?.addEventListener(
                "input",
                handleChannelSearch
            );

        byId("memberSearchInput")
            ?.addEventListener(
                "input",
                handleMemberSearch
            );

        byId("messageSearchInput")
            ?.addEventListener(
                "input",
                handleMessageSearch
            );

        byId("chatSearchButton")
            ?.addEventListener(
                "click",
                openMessageSearch
            );

        byId("closeMessageSearchButton")
            ?.addEventListener(
                "click",
                closeMessageSearch
            );

        byId("channelToggleButton")
            ?.addEventListener(
                "click",
                openChannelDrawer
            );

        byId("memberToggleButton")
            ?.addEventListener(
                "click",
                openMemberDrawer
            );

        byId("closeMemberSidebarButton")
            ?.addEventListener(
                "click",
                closeMemberDrawer
            );

        byId("communityDrawerOverlay")
            ?.addEventListener(
                "click",
                () => {
                    closeChannelDrawer();
                    closeMemberDrawer();
                }
            );

        byId("createCommunityButton")
            ?.addEventListener(
                "click",
                openCommunityModal
            );

        byId("createChannelButton")
            ?.addEventListener(
                "click",
                openChannelModal
            );

        byId("closeCommunityModalButton")
            ?.addEventListener(
                "click",
                closeCommunityModal
            );

        byId("cancelCommunityButton")
            ?.addEventListener(
                "click",
                closeCommunityModal
            );

        byId("closeChannelModalButton")
            ?.addEventListener(
                "click",
                closeChannelModal
            );

        byId("cancelChannelButton")
            ?.addEventListener(
                "click",
                closeChannelModal
            );

        byId("communityForm")
            ?.addEventListener(
                "submit",
                createCommunity
            );

        byId("channelForm")
            ?.addEventListener(
                "submit",
                createChannel
            );

        byId("cancelReplyButton")
            ?.addEventListener(
                "click",
                cancelReply
            );

        byId("communityMenuRefresh")
            ?.addEventListener(
                "click",
                async () => {
                    closeCommunityMenu();
                    await refreshCommunity();
                }
            );

        byId("communityMenuCreateCommunity")
            ?.addEventListener(
                "click",
                () => {
                    closeCommunityMenu();
                    openCommunityModal();
                }
            );

        byId("communityMenuCreateChannel")
            ?.addEventListener(
                "click",
                () => {
                    closeCommunityMenu();
                    openChannelModal();
                }
            );

        window.addEventListener(
            "beforeunload",
            () => {
                setOfflinePresence();
            }
        );

        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    document.visibilityState ===
                    "visible"
                ) {
                    setOnlinePresence();
                }
            }
        );
    }

    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initialize() {
        try {
            await loadCurrentUser();

            if (!state.user) {
                return;
            }

            await loadStudentProfile();

            await loadCourses();

            await loadCommunities();

            bindEvents();

            startPresence();

            if (state.communities.length) {
                const storedCommunity =
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
                                storedCommunity
                            )
                    );

                await selectCommunity(
                    selected?.id ||
                    state.communities[0].id
                );
            }

            state.initialized = true;

            console.log(
                "Mwaniki Community fully initialized."
            );

            /*
             * Calls are intentionally NOT initialized here.
             * community-calls.js initializes its own engine.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "mwaniki-community-ready",
                    {
                        detail: {
                            state
                        }
                    }
                )
            );

        } catch (error) {
            console.error(
                "❌ Mwaniki Community initialization failed:",
                error
            );

            const rail =
                byId("communityRail");

            if (rail) {
                rail.innerHTML = `
                    <div class="channel-loading">
                        Community failed to load.
                        <br>
                        <small>
                            ${escapeHTML(
                                error?.message ||
                                "Unknown error"
                            )}
                        </small>
                    </div>
                `;
            }

            toast(
                "Community failed to initialize.",
                "error"
            );
        }
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.mwanikiCommunity = {
        state,

        refresh:
            refreshCommunity,

        loadCommunities,

        loadChannels,

        loadMembers,

        loadMessages,

        openChannels:
            openChannelDrawer,

        closeChannels:
            closeChannelDrawer,

        openMembers:
            openMemberDrawer,

        closeMembers:
            closeMemberDrawer,

        selectChannel,

        selectCommunity,

        sendMessage,

        cancelReply,

        getDisplayName,

        getProfilePhoto
    };

    initialize();

})();
