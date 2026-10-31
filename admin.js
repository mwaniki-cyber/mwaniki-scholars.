
import { supabase } from "./supabase.js";

/* ============================================================
   MWANIKI SCHOLARS
   PLATFORM ADMINISTRATION CONTROLLER
   ============================================================ */

const $ = id => document.getElementById(id);

const state = {
    students: [],
    communities: [],
    channels: [],
    studentsSearch: "",
    members: [],
    activeCommunity: "",
    activeView: "overview",
    reports: [],
    auditLogs: [],
    analytics: null
};

const TITLES = {
    overview: "Overview",
    students: "Student Management",
    tutors: "Tutor Management",
    courses: "Course Management",
    learning: "Learning Resources",
    community: "Community Management",
    channels: "Channel Management",
    moderation: "Moderation",
    analytics: "Analytics",
    permissions: "Permissions",
    audit: "Audit Logs",
    settings: "Settings"
};

const ROLE_VALUES = [
    "student",
    "moderator",
    "tutor",
    "admin",
    "super_admin"
];

const CHANNEL_TYPES = [
    "text",
    "announcement",
    "study",
    "course",
    "voice"
];

const REPORT_STATUSES = [
    "pending",
    "reviewing",
    "resolved",
    "dismissed"
];

/* ============================================================
   GENERAL HELPERS
   ============================================================ */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? "—";
}

function setTextAll(id, value) {
    document.querySelectorAll(`[id="${id}"]`).forEach(element => {
        element.textContent = value ?? "—";
    });
}

function showStatus(message, type = "success") {
    const box = $("adminStatus");
    if (!box) return;

    box.textContent = message;
    box.dataset.type = type;
    box.hidden = false;

    if (type !== "error") {
        window.setTimeout(() => {
            if (box.textContent === message) box.hidden = true;
        }, 5000);
    }
}

function showFormStatus(id, message, type = "success") {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.dataset.type = type;
}

function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString();
}

function formatDateTime(value) {
    if (!value) return "Not recorded";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString();
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function errorMessage(error) {
    return error?.message || "An unexpected database error occurred.";
}

function setButtonLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;

    if (loading) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait...';
    } else {
        button.innerHTML = button.dataset.originalText || originalText || "Submit";
    }
}

function emptyRow(columns, message) {
    return `<tr><td colspan="${columns}">${escapeHTML(message)}</td></tr>`;
}

function confirmAction(message) {
    return window.confirm(message);
}

async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error("Your administrator session has expired.");
    return data.user;
}

/* ============================================================
   ADMINISTRATOR VERIFICATION
   ============================================================ */

async function verifyAdminSession() {
    const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
        throw new Error("Administrator session not found.");
    }

    const { data, error } = await supabase.rpc("is_platform_admin");

    if (error) throw error;

    if (data !== true) {
        throw new Error("Platform Administrator access is required.");
    }

    return sessionData.session.user;
}

/* ============================================================
   AUDIT LOGGING
   ============================================================ */

async function writeAuditLog(
    action,
    category,
    targetType = null,
    targetId = null,
    details = {}
) {
    try {
        const { error } = await supabase.rpc("admin_write_audit_log", {
            p_action: action,
            p_category: category,
            p_target_type: targetType,
            p_target_id: targetId ? String(targetId) : null,
            p_details: details
        });

        if (error) {
            console.error("Audit logging failed:", error);
            showStatus(
                "The operation succeeded, but its audit record could not be saved: " +
                error.message,
                "error"
            );
        }
    } catch (error) {
        console.error("Audit logging failed:", error);
    }
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function openMobileSidebar() {
    $("adminSidebar")?.classList.add("mobile-open");
    $("sidebarOverlay")?.classList.add("active");
}

function closeMobileSidebar() {
    $("adminSidebar")?.classList.remove("mobile-open");
    $("sidebarOverlay")?.classList.remove("active");
}

function openWorkspace(viewName) {
    const target = $("view-" + viewName);

    if (!target) {
        console.warn("Unknown workspace:", viewName);
        return;
    }

    state.activeView = viewName;

    document.querySelectorAll(".workspace-view").forEach(view => {
        view.classList.toggle("active", view === target);
    });

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === viewName
        );
    });

    setText("workspaceTitle", TITLES[viewName] || "Administration");

    closeMobileSidebar();

    switch (viewName) {
        case "overview":
            loadOverviewCounts();
            break;

        case "students":
            loadStudents();
            break;

        case "community":
            loadCommunities();
            break;

        case "channels":
            loadCommunities().then(loadChannels);
            break;

        case "moderation":
            loadModeration();
            break;

        case "permissions":
            loadCommunities();
            break;

        case "analytics":
            loadAnalytics();
            break;

        case "audit":
            loadAuditLogs();
            break;
    }
}

function initializeNavigation() {
    document.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
            openWorkspace(button.dataset.view);
        });
    });

    $("sidebarToggle")?.addEventListener("click", openMobileSidebar);
    $("sidebarClose")?.addEventListener("click", closeMobileSidebar);
    $("sidebarOverlay")?.addEventListener("click", closeMobileSidebar);

    openWorkspace("overview");
}

/* ============================================================
   DATABASE COUNTS
   ============================================================ */

async function countRows(table, filters = []) {
    try {
        let query = supabase
            .from(table)
            .select("*", { count: "exact", head: true });

        for (const [column, operator, value] of filters) {
            query = query.filter(column, operator, value);
        }

        const { count, error } = await query;

        if (error) throw error;

        return count ?? 0;

    } catch (error) {
        console.error(`Count failed for ${table}:`, error);
        return null;
    }
}

async function loadOverviewCounts() {
    const requests = [
        ["courseCount", "courses"],
        ["communityCount", "chat_communities"],
        ["channelCount", "chat_channels"],
        ["messageCount", "chat_messages"],
        ["onlineCount", "chat_presence", [
            ["status", "eq", "online"]
        ]],
        ["reportCount", "chat_reports"]
    ];

    const results = await Promise.all(
        requests.map(async ([id, table, filters = []]) => ({
            id,
            count: await countRows(table, filters)
        }))
    );

    results.forEach(({ id, count }) => {
        if (count !== null) setText(id, count);
    });

    const courseCount = results.find(item => item.id === "courseCount");

    if (courseCount?.count !== null && courseCount?.count !== undefined) {
        setText("courseWorkspaceCount", courseCount.count);
    }

    await loadStudents();
}

/* ============================================================
   STUDENT MANAGEMENT
   ============================================================ */

async function loadStudents() {
    const body = $("studentsTableBody");

    if (body) {
        body.innerHTML = emptyRow(8, "Loading registered accounts...");
    }

    try {
        const { data, error } = await supabase.rpc("admin_list_students");

        if (error) throw error;

        state.students = Array.isArray(data) ? data : [];

        const total = state.students.length;

        const complete = state.students.filter(
            student => student.has_student_record === true
        ).length;

        setText("studentCount", total);
        setText("sidebarStudentCount", total);
        setTextAll("registeredAccountCount", total);
        setText("completeStudentCount", complete);
        setText("incompleteStudentCount", total - complete);

        filterStudents();

    } catch (error) {
        console.error("Student loading failed:", error);

        if (body) {
            body.innerHTML = emptyRow(
                8,
                "Could not load students: " + errorMessage(error)
            );
        }

        showStatus("Student loading failed: " + errorMessage(error), "error");
    }
}

function filterStudents() {
    const search = state.studentsSearch.trim().toLowerCase();

    const filtered = state.students.filter(student => {
        const fields = [
            student.full_name,
            student.email,
            student.phone,
            student.course,
            student.level,
            student.user_id
        ];

        return fields.some(value =>
            String(value ?? "").toLowerCase().includes(search)
        );
    });

    renderStudents(filtered);
}

function renderStudents(students) {
    const body = $("studentsTableBody");
    if (!body) return;

    if (!students.length) {
        body.innerHTML = emptyRow(8, "No matching registered accounts found.");
        return;
    }

    body.innerHTML = students.map(student => {
        const name = student.full_name || "Profile incomplete";
        const firstLetter = name.trim().charAt(0).toUpperCase() || "S";

        const photo = student.photo_url
            ? `<img src="${escapeHTML(student.photo_url)}"
                    alt=""
                    class="student-avatar"
                    loading="lazy"
                    onerror="this.style.display='none'">`
            : `<span class="student-avatar-placeholder">${escapeHTML(firstLetter)}</span>`;

        return `
            <tr>
                <td>
                    <div class="student-identity">
                        ${photo}
                        <div>
                            <strong>${escapeHTML(name)}</strong>
                            <small>${escapeHTML(student.user_id)}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(student.email || "Unavailable")}</td>
                <td>${escapeHTML(student.phone || "Not provided")}</td>
                <td>${escapeHTML(student.course || "Not provided")}</td>
                <td>${escapeHTML(student.level || "Not provided")}</td>
                <td>
                    <span class="profile-status ${student.has_student_record ? "complete" : "incomplete"}">
                        ${student.has_student_record ? "Available" : "Incomplete"}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(student.registered_at))}</td>
                <td>
                    <button type="button"
                        class="student-view-button"
                        data-student-id="${escapeHTML(student.user_id)}">
                        View
                    </button>
                </td>
            </tr>`;
    }).join("");

    body.querySelectorAll("[data-student-id]").forEach(button => {
        button.addEventListener("click", () => {
            openStudentDetails(button.dataset.studentId);
        });
    });
}

function openStudentDetails(userId) {
    const student = state.students.find(item => item.user_id === userId);
    if (!student) return;

    const content = $("studentDetailsContent");
    const modal = $("studentDetailsModal");

    if (!content || !modal) return;

    const details = [
        ["Full name", student.full_name],
        ["Email address", student.email],
        ["Phone number", student.phone],
        ["Course", student.course],
        ["Level", student.level],
        ["Account ID", student.user_id],
        ["Registration date", formatDateTime(student.registered_at)],
        ["Last sign-in", formatDateTime(student.last_sign_in_at)],
        ["Email confirmed", student.email_confirmed_at ? "Yes" : "No"],
        ["Student record", student.has_student_record ? "Available" : "Incomplete"]
    ];

    content.innerHTML = `
        <div class="student-detail-grid">
            ${details.map(([label, value]) => `
                <div class="student-detail">
                    <small>${escapeHTML(label)}</small>
                    <strong>${escapeHTML(value || "Not provided")}</strong>
                </div>
            `).join("")}
        </div>`;

    modal.hidden = false;
}

function closeStudentDetails() {
    if ($("studentDetailsModal")) {
        $("studentDetailsModal").hidden = true;
    }
}

/* ============================================================
   COURSE MANAGEMENT
   ============================================================ */

async function createCourse(event) {
    event.preventDefault();

    const title = $("courseName")?.value.trim();
    const description = $("courseDescription")?.value.trim();
    const status = $("courseStatusMessage") || $("courseStatus");
    const form = $("courseForm");
    const button = form?.querySelector('button[type="submit"]');

    if (!title) {
        if (status) status.textContent = "Please enter a course title.";
        return;
    }

    setButtonLoading(button, true);

    if (status) status.textContent = "Creating course...";

    try {
        const { data, error } = await supabase
            .from("courses")
            .insert({
                title,
                description: description || null
            })
            .select("id,title")
            .single();

        if (error) throw error;

        form.reset();

        if (status) status.textContent = "Course created successfully.";

        await writeAuditLog(
            "Created course",
            "courses",
            "course",
            data.id,
            { course_title: data.title }
        );

        const count = await countRows("courses");

        if (count !== null) {
            setText("courseCount", count);
            setText("courseWorkspaceCount", count);
        }

        showStatus("Course created successfully.");

    } catch (error) {
        console.error("Course creation failed:", error);

        if (status) status.textContent = errorMessage(error);

        showStatus("Could not create course: " + errorMessage(error), "error");

    } finally {
        setButtonLoading(button, false);
    }
}

/* ============================================================
   COMMUNITY MANAGEMENT
   ============================================================ */

async function loadCommunities() {
    const container = $("communityList");

    try {
        const { data, error } = await supabase
            .from("chat_communities")
            .select("id,name,slug,description,is_public,is_active,created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        state.communities = data || [];

        renderCommunities();
        populateCommunitySelects();

    } catch (error) {
        console.error("Community loading failed:", error);

        if (container) {
            container.textContent =
                "Could not load communities: " + errorMessage(error);
        }

        showStatus("Community loading failed: " + errorMessage(error), "error");
    }
}

function renderCommunities() {
    const container = $("communityList");
    if (!container) return;

    if (!state.communities.length) {
        container.textContent = "No communities found.";
        return;
    }

    container.innerHTML = state.communities.map(community => `
        <div class="community-admin-item">
            <div>
                <strong>${escapeHTML(community.name)}</strong>
                <p>${escapeHTML(community.description || "No description")}</p>
                <small>
                    ${community.is_active ? "Active" : "Inactive"}
                    · ${community.is_public ? "Public" : "Private"}
                    · ${escapeHTML(community.slug)}
                </small>
            </div>

            <div class="community-actions">
                <button type="button"
                    class="secondary-button"
                    data-edit-community="${escapeHTML(community.id)}">
                    Edit
                </button>

                <button type="button"
                    class="${community.is_active ? "danger-button" : "primary-button"}"
                    data-toggle-community="${escapeHTML(community.id)}">
                    ${community.is_active ? "Deactivate" : "Activate"}
                </button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll("[data-edit-community]").forEach(button => {
        button.addEventListener("click", () => {
            editCommunity(button.dataset.editCommunity);
        });
    });

    container.querySelectorAll("[data-toggle-community]").forEach(button => {
        button.addEventListener("click", () => {
            toggleCommunity(button.dataset.toggleCommunity);
        });
    });
}

function populateCommunitySelects() {
    const selects = [
        "channelCommunity",
        "channelCommunityFilter",
        "permissionCommunity"
    ];

    selects.forEach(id => {
        const select = $(id);
        if (!select) return;

        const oldValue = select.value;

        const firstOption = id === "channelCommunityFilter"
            ? '<option value="">All communities</option>'
            : '<option value="">Select community</option>';

        select.innerHTML = firstOption + state.communities.map(community => `
            <option value="${escapeHTML(community.id)}">
                ${escapeHTML(community.name)}
            </option>
        `).join("");

        if (
            oldValue &&
            state.communities.some(item => item.id === oldValue)
        ) {
            select.value = oldValue;
        }
    });
}

function resetCommunityForm() {
    $("communityForm")?.reset();

    if ($("communityEditId")) $("communityEditId").value = "";

    const button = $("communitySubmitButton");

    if (button) {
        button.innerHTML = '<i class="fas fa-plus"></i> Create Community';
    }

    if ($("cancelCommunityEdit")) {
        $("cancelCommunityEdit").hidden = true;
    }
}

function editCommunity(id) {
    const community = state.communities.find(item => item.id === id);
    if (!community) return;

    $("communityEditId").value = community.id;
    $("communityName").value = community.name || "";
    $("communityDescription").value = community.description || "";

    const button = $("communitySubmitButton");

    if (button) {
        button.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }

    if ($("cancelCommunityEdit")) {
        $("cancelCommunityEdit").hidden = false;
    }

    $("communityForm")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

async function saveCommunity(event) {
    event.preventDefault();

    const id = $("communityEditId")?.value;
    const name = $("communityName")?.value.trim();
    const description = $("communityDescription")?.value.trim();

    const button = $("communitySubmitButton");

    if (!name) {
        showFormStatus("communityFormStatus", "Enter a community name.", "error");
        return;
    }

    setButtonLoading(button, true);

    try {
        const user = await getCurrentUser();

        let result;

        if (id) {
            result = await supabase
                .from("chat_communities")
                .update({
                    name,
                    slug: slugify(name),
                    description: description || null
                })
                .eq("id", id)
                .select("id,name")
                .single();

        } else {
            result = await supabase
                .from("chat_communities")
                .insert({
                    name,
                    slug: slugify(name),
                    description: description || null,
                    created_by: user.id,
                    is_public: true,
                    is_active: true
                })
                .select("id,name")
                .single();
        }

        if (result.error) throw result.error;

        await writeAuditLog(
            id ? "Updated community" : "Created community",
            "communities",
            "community",
            result.data.id,
            { community_name: result.data.name }
        );

        resetCommunityForm();

        showFormStatus(
            "communityFormStatus",
            id ? "Community updated." : "Community created."
        );

        await loadCommunities();
        await loadOverviewCounts();

        showStatus(id ? "Community updated." : "Community created.");

    } catch (error) {
        console.error("Community save failed:", error);

        showFormStatus(
            "communityFormStatus",
            errorMessage(error),
            "error"
        );

        showStatus("Community operation failed: " + errorMessage(error), "error");

    } finally {
        setButtonLoading(button, false);
    }
}

async function toggleCommunity(id) {
    const community = state.communities.find(item => item.id === id);
    if (!community) return;

    const nextStatus = !community.is_active;

    if (!confirmAction(
        `${nextStatus ? "Activate" : "Deactivate"} "${community.name}"?`
    )) return;

    try {
        const { error } = await supabase
            .from("chat_communities")
            .update({ is_active: nextStatus })
            .eq("id", id);

        if (error) throw error;

        await writeAuditLog(
            nextStatus ? "Activated community" : "Deactivated community",
            "communities",
            "community",
            id,
            { community_name: community.name }
        );

        await loadCommunities();
        await loadOverviewCounts();

        showStatus("Community status updated.");

    } catch (error) {
        console.error("Community status update failed:", error);
        showStatus("Could not update community: " + errorMessage(error), "error");
    }
}

/* ============================================================
   CHANNEL MANAGEMENT
   ============================================================ */

async function loadChannels() {
    const body = $("channelsTableBody");
    if (body) body.innerHTML = emptyRow(6, "Loading channels...");

    try {
        let query = supabase
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
                created_at
            `)
            .order("position", { ascending: true });

        const communityFilter = $("channelCommunityFilter")?.value;

        if (communityFilter) {
            query = query.eq("community_id", communityFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        state.channels = data || [];

        renderChannels();

    } catch (error) {
        console.error("Channel loading failed:", error);

        if (body) {
            body.innerHTML = emptyRow(6, errorMessage(error));
        }

        showStatus("Channel loading failed: " + errorMessage(error), "error");
    }
}

function renderChannels() {
    const body = $("channelsTableBody");
    if (!body) return;

    if (!state.channels.length) {
        body.innerHTML = emptyRow(6, "No channels found.");
        return;
    }

    body.innerHTML = state.channels.map(channel => {
        const community = state.communities.find(
            item => item.id === channel.community_id
        );

        const status = channel.is_archived
            ? "Archived"
            : channel.is_active ? "Active" : "Inactive";

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(channel.icon || "#")} ${escapeHTML(channel.name)}</strong>
                    <small>${escapeHTML(channel.slug)}</small>
                </td>

                <td>${escapeHTML(community?.name || channel.community_id)}</td>

                <td>${escapeHTML(channel.channel_type)}</td>

                <td>${channel.is_private ? "Private" : "Public"}</td>

                <td>${escapeHTML(status)}</td>

                <td>
                    <button class="student-view-button"
                        data-edit-channel="${escapeHTML(channel.id)}">
                        Edit
                    </button>

                    <button class="secondary-button"
                        data-toggle-channel="${escapeHTML(channel.id)}">
                        ${channel.is_archived ? "Restore" : "Archive"}
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    body.querySelectorAll("[data-edit-channel]").forEach(button => {
        button.addEventListener("click", () => {
            editChannel(button.dataset.editChannel);
        });
    });

    body.querySelectorAll("[data-toggle-channel]").forEach(button => {
        button.addEventListener("click", () => {
            toggleChannel(button.dataset.toggleChannel);
        });
    });
}

function resetChannelForm() {
    $("channelForm")?.reset();

    if ($("channelEditId")) $("channelEditId").value = "";

    const button = $("channelSubmitButton");

    if (button) {
        button.innerHTML = '<i class="fas fa-plus"></i> Create Channel';
    }

    if ($("cancelChannelEdit")) {
        $("cancelChannelEdit").hidden = true;
    }
}

function editChannel(id) {
    const channel = state.channels.find(item => item.id === id);
    if (!channel) return;

    $("channelEditId").value = channel.id;
    $("channelCommunity").value = channel.community_id;
    $("channelName").value = channel.name || "";
    $("channelDescription").value = channel.description || "";
    $("channelType").value = channel.channel_type;
    $("channelIcon").value = channel.icon || "";
    $("channelPrivate").checked = channel.is_private;

    const button = $("channelSubmitButton");

    if (button) {
        button.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }

    if ($("cancelChannelEdit")) {
        $("cancelChannelEdit").hidden = false;
    }

    $("channelForm")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

async function saveChannel(event) {
    event.preventDefault();

    const id = $("channelEditId")?.value;
    const communityId = $("channelCommunity")?.value;
    const name = $("channelName")?.value.trim();
    const description = $("channelDescription")?.value.trim();
    const type = $("channelType")?.value;
    const icon = $("channelIcon")?.value.trim();
    const isPrivate = $("channelPrivate")?.checked || false;

    const button = $("channelSubmitButton");

    if (!communityId || !name) {
        showFormStatus(
            "channelFormStatus",
            "Select a community and enter a channel name.",
            "error"
        );
        return;
    }

    if (!CHANNEL_TYPES.includes(type)) {
        showFormStatus("channelFormStatus", "Invalid channel type.", "error");
        return;
    }

    setButtonLoading(button, true);

    try {
        let result;

        if (id) {
            result = await supabase
                .from("chat_channels")
                .update({
                    community_id: communityId,
                    name,
                    slug: slugify(name),
                    description: description || null,
                    channel_type: type,
                    icon: icon || null,
                    is_private: isPrivate
                })
                .eq("id", id)
                .select("id,name")
                .single();

        } else {
            const maxPosition = state.channels
                .filter(channel => channel.community_id === communityId)
                .reduce((max, channel) => Math.max(max, channel.position || 0), 0);

            const user = await getCurrentUser();

            result = await supabase
                .from("chat_channels")
                .insert({
                    community_id: communityId,
                    name,
                    slug: slugify(name),
                    description: description || null,
                    channel_type: type,
                    icon: icon || null,
                    position: maxPosition + 1,
                    is_private: isPrivate,
                    is_archived: false,
                    is_active: true,
                    created_by: user.id
                })
                .select("id,name")
                .single();
        }

        if (result.error) throw result.error;

        await writeAuditLog(
            id ? "Updated channel" : "Created channel",
            "channels",
            "channel",
            result.data.id,
            {
                channel_name: result.data.name,
                channel_type: type,
                community_id: communityId
            }
        );

        resetChannelForm();

        showFormStatus(
            "channelFormStatus",
            id ? "Channel updated." : "Channel created."
        );

        await loadChannels();
        await loadOverviewCounts();

        showStatus(id ? "Channel updated." : "Channel created.");

    } catch (error) {
        console.error("Channel save failed:", error);

        showFormStatus(
            "channelFormStatus",
            errorMessage(error),
            "error"
        );

        showStatus("Channel operation failed: " + errorMessage(error), "error");

    } finally {
        setButtonLoading(button, false);
    }
}

async function toggleChannel(id) {
    const channel = state.channels.find(item => item.id === id);
    if (!channel) return;

    const restoring = channel.is_archived || !channel.is_active;

    if (!confirmAction(
        `${restoring ? "Restore" : "Archive"} channel "${channel.name}"?`
    )) return;

    try {
        const { error } = await supabase
            .from("chat_channels")
            .update({
                is_archived: !restoring,
                is_active: restoring
            })
            .eq("id", id);

        if (error) throw error;

        await writeAuditLog(
            restoring ? "Restored channel" : "Archived channel",
            "channels",
            "channel",
            id,
            { channel_name: channel.name }
        );

        await loadChannels();
        await loadOverviewCounts();

        showStatus("Channel status updated.");

    } catch (error) {
        console.error("Channel status update failed:", error);
        showStatus("Could not update channel: " + errorMessage(error), "error");
    }
}

/* ============================================================
   MODERATION: REPORTS
   ============================================================ */

async function loadReports() {
    const body = $("reportsTableBody");
    if (body) body.innerHTML = emptyRow(6, "Loading reports...");

    try {
        const { data, error } = await supabase
            .from("chat_reports")
            .select(`
                id,
                reporter_id,
                reported_user_id,
                message_id,
                channel_id,
                reason,
                details,
                status,
                reviewed_by,
                reviewed_at,
                created_at
            `)
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) throw error;

        state.reports = data || [];

        const pending = state.reports.filter(item => item.status === "pending").length;
        const reviewing = state.reports.filter(item => item.status === "reviewing").length;

        setText("pendingReportCount", pending);
        setText("reviewingReportCount", reviewing);

        renderReports();

    } catch (error) {
        console.error("Report loading failed:", error);

        if (body) body.innerHTML = emptyRow(6, errorMessage(error));

        showStatus("Could not load reports: " + errorMessage(error), "error");
    }
}

function renderReports() {
    const body = $("reportsTableBody");
    if (!body) return;

    if (!state.reports.length) {
        body.innerHTML = emptyRow(6, "No reports found.");
        return;
    }

    body.innerHTML = state.reports.map(report => `
        <tr>
            <td>${escapeHTML(report.reason)}</td>
            <td>${escapeHTML(report.reported_user_id || "Not specified")}</td>
            <td>${escapeHTML(report.reporter_id)}</td>
            <td><span class="profile-status">${escapeHTML(report.status)}</span></td>
            <td>${escapeHTML(formatDate(report.created_at))}</td>
            <td>
                <button class="student-view-button"
                    data-report-details="${escapeHTML(report.id)}">
                    View
                </button>

                <select data-report-status="${escapeHTML(report.id)}"
                    aria-label="Change report status">
                    ${REPORT_STATUSES.map(status => `
                        <option value="${status}" ${report.status === status ? "selected" : ""}>
                            ${status}
                        </option>
                    `).join("")}
                </select>
            </td>
        </tr>
    `).join("");

    body.querySelectorAll("[data-report-details]").forEach(button => {
        button.addEventListener("click", () => {
            openReportDetails(button.dataset.reportDetails);
        });
    });

    body.querySelectorAll("[data-report-status]").forEach(select => {
        select.addEventListener("change", () => {
            updateReportStatus(select.dataset.reportStatus, select.value);
        });
    });
}

function openReportDetails(id) {
    const report = state.reports.find(item => item.id === id);
    if (!report) return;

    const content = $("reportDetailsContent");
    const modal = $("reportDetailsModal");

    if (!content || !modal) return;

    const details = [
        ["Report ID", report.id],
        ["Reason", report.reason],
        ["Details", report.details],
        ["Reporter ID", report.reporter_id],
        ["Reported User ID", report.reported_user_id],
        ["Message ID", report.message_id],
        ["Channel ID", report.channel_id],
        ["Status", report.status],
        ["Created", formatDateTime(report.created_at)],
        ["Reviewed", formatDateTime(report.reviewed_at)],
        ["Reviewed By", report.reviewed_by]
    ];

    content.innerHTML = `
        <div class="student-detail-grid">
            ${details.map(([label, value]) => `
                <div class="student-detail">
                    <small>${escapeHTML(label)}</small>
                    <strong>${escapeHTML(value || "Not provided")}</strong>
                </div>
            `).join("")}
        </div>
    `;

    modal.hidden = false;
}

async function updateReportStatus(id, status) {
    if (!REPORT_STATUSES.includes(status)) return;

    const report = state.reports.find(item => item.id === id);
    if (!report) return;

    try {
        const user = await getCurrentUser();

        const { error } = await supabase
            .from("chat_reports")
            .update({
                status,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString()
            })
            .eq("id", id);

        if (error) throw error;

        await writeAuditLog(
            "Updated report status",
            "moderation",
            "report",
            id,
            { previous_status: report.status, new_status: status }
        );

        showStatus("Report status updated.");

        await loadReports();
        await loadOverviewCounts();

    } catch (error) {
        console.error("Report update failed:", error);
        showStatus("Could not update report: " + errorMessage(error), "error");
        await loadReports();
    }
}

/* ============================================================
   MODERATION EVENTS
   ============================================================ */

async function loadModerationEvents() {
    const body = $("moderationEventsTableBody");
    if (body) body.innerHTML = emptyRow(6, "Loading moderation events...");

    try {
        const { data, error } = await supabase
            .from("chat_moderation_events")
            .select(`
                id,
                user_id,
                community_id,
                channel_id,
                message_id,
                event_type,
                severity,
                rule_code,
                detected_text,
                explanation,
                action_taken,
                confidence,
                created_at,
                reviewed,
                reviewed_by,
                reviewed_at
            `)
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) throw error;

        const events = data || [];

        setText("moderationEventCount", events.length);

        if (!body) return;

        if (!events.length) {
            body.innerHTML = emptyRow(6, "No moderation events found.");
            return;
        }

        body.innerHTML = events.map(event => `
            <tr>
                <td>
                    <strong>${escapeHTML(event.event_type)}</strong>
                    <small>${escapeHTML(event.rule_code || "")}</small>
                </td>
                <td>${escapeHTML(event.severity)}</td>
                <td>${escapeHTML(event.explanation || "No explanation")}</td>
                <td>${escapeHTML(event.action_taken || "None")}</td>
                <td>${escapeHTML(formatDate(event.created_at))}</td>
                <td>
                    <button class="student-view-button"
                        data-review-event="${escapeHTML(event.id)}"
                        data-reviewed="${event.reviewed ? "true" : "false"}">
                        ${event.reviewed ? "Reviewed" : "Mark Reviewed"}
                    </button>
                </td>
            </tr>
        `).join("");

        body.querySelectorAll("[data-review-event]").forEach(button => {
            button.addEventListener("click", () => {
                if (button.dataset.reviewed === "true") return;
                reviewModerationEvent(button.dataset.reviewEvent);
            });
        });

    } catch (error) {
        console.error("Moderation event loading failed:", error);

        if (body) body.innerHTML = emptyRow(6, errorMessage(error));

        showStatus(
            "Could not load moderation events: " + errorMessage(error),
            "error"
        );
    }
}

async function reviewModerationEvent(id) {
    try {
        const user = await getCurrentUser();

        const { error } = await supabase
            .from("chat_moderation_events")
            .update({
                reviewed: true,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString()
            })
            .eq("id", id);

        if (error) throw error;

        await writeAuditLog(
            "Reviewed moderation event",
            "moderation",
            "moderation_event",
            id
        );

        showStatus("Moderation event marked as reviewed.");

        await loadModerationEvents();

    } catch (error) {
        console.error("Moderation review failed:", error);
        showStatus("Could not review event: " + errorMessage(error), "error");
    }
}

/* ============================================================
   MEMBER WARNINGS
   ============================================================ */

async function loadWarnings() {
    const body = $("warningsTableBody");
    if (body) body.innerHTML = emptyRow(6, "Loading warnings...");

    try {
        const { data, error } = await supabase
            .from("chat_member_warnings")
            .select(`
                id,
                user_id,
                community_id,
                moderation_event_id,
                warning_level,
                reason,
                issued_by,
                automatic,
                acknowledged,
                created_at,
                expires_at
            `)
            .order("created_at", { ascending: false })
            .limit(200);

        if (error) throw error;

        if (!body) return;

        if (!data?.length) {
            body.innerHTML = emptyRow(6, "No member warnings found.");
            return;
        }

        body.innerHTML = data.map(warning => {
            const community = state.communities.find(
                item => item.id === warning.community_id
            );

            return `
                <tr>
                    <td>${escapeHTML(warning.user_id)}</td>
                    <td>${escapeHTML(community?.name || warning.community_id || "Platform")}</td>
                    <td>${escapeHTML(warning.warning_level)}</td>
                    <td>${escapeHTML(warning.reason)}</td>
                    <td>${escapeHTML(formatDate(warning.created_at))}</td>
                    <td>${escapeHTML(formatDate(warning.expires_at))}</td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Warning loading failed:", error);

        if (body) body.innerHTML = emptyRow(6, errorMessage(error));

        showStatus("Could not load warnings: " + errorMessage(error), "error");
    }
}

async function loadModeration() {
    await Promise.all([
        loadReports(),
        loadModerationEvents(),
        loadWarnings()
    ]);
}

/* ============================================================
   COMMUNITY MEMBER MANAGEMENT
   ============================================================ */

async function loadMembers() {
    const communityId = $("permissionCommunity")?.value;
    const body = $("membersTableBody");

    if (!communityId) {
        if (body) body.innerHTML = emptyRow(7, "Select a community first.");
        return;
    }

    state.activeCommunity = communityId;

    if (body) body.innerHTML = emptyRow(7, "Loading members...");

    try {
        const { data, error } = await supabase
            .from("chat_community_members")
            .select(`
                id,
                community_id,
                user_id,
                role,
                nickname,
                display_name,
                avatar_url,
                is_muted,
                is_banned,
                joined_at,
                membership_status
            `)
            .eq("community_id", communityId)
            .order("joined_at", { ascending: false });

        if (error) throw error;

        state.members = data || [];

        await renderMembers();

    } catch (error) {
        console.error("Member loading failed:", error);

        if (body) body.innerHTML = emptyRow(7, errorMessage(error));

        showStatus("Could not load members: " + errorMessage(error), "error");
    }
}

async function renderMembers() {
    const body = $("membersTableBody");
    if (!body) return;

    const search = $("memberSearch")?.value.trim().toLowerCase() || "";

    const filtered = state.members.filter(member => {
        const fields = [
            member.user_id,
            member.nickname,
            member.display_name
        ];

        return fields.some(value =>
            String(value || "").toLowerCase().includes(search)
        );
    });

    if (!filtered.length) {
        body.innerHTML = emptyRow(7, "No matching members found.");
        return;
    }

    // Public profiles provide display information only.
    let profileMap = {};

    const userIds = filtered.map(member => member.user_id);

    if (userIds.length) {
        const { data, error } = await supabase
            .from("chat_public_profiles")
            .select("id,full_name,photo_url")
            .in("id", userIds);

        if (error) {
            console.warn("Public profile lookup unavailable:", error);
        } else {
            (data || []).forEach(profile => {
                profileMap[profile.id] = profile;
            });
        }
    }

    body.innerHTML = filtered.map(member => {
        const profile = profileMap[member.user_id];
        const name = member.display_name ||
            member.nickname ||
            profile?.full_name ||
            "Community Member";

        return `
            <tr>
                <td>${escapeHTML(name)}</td>
                <td><small>${escapeHTML(member.user_id)}</small></td>
                <td>
                    <select data-member-role="${escapeHTML(member.id)}">
                        ${ROLE_VALUES.map(role => `
                            <option value="${role}" ${member.role === role ? "selected" : ""}>
                                ${role}
                            </option>
                        `).join("")}
                    </select>
                </td>
                <td>${escapeHTML(member.membership_status || "Active")}</td>
                <td>${member.is_muted ? "Yes" : "No"}</td>
                <td>${member.is_banned ? "Yes" : "No"}</td>
                <td>
                    <button class="secondary-button"
                        data-member-mute="${escapeHTML(member.id)}">
                        ${member.is_muted ? "Unmute" : "Mute"}
                    </button>

                    <button class="danger-button"
                        data-member-ban="${escapeHTML(member.id)}">
                        ${member.is_banned ? "Unban" : "Ban"}
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    body.querySelectorAll("[data-member-role]").forEach(select => {
        select.addEventListener("change", () => {
            changeMemberRole(select.dataset.memberRole, select.value);
        });
    });

    body.querySelectorAll("[data-member-mute]").forEach(button => {
        button.addEventListener("click", () => {
            toggleMemberMute(button.dataset.memberMute);
        });
    });

    body.querySelectorAll("[data-member-ban]").forEach(button => {
        button.addEventListener("click", () => {
            toggleMemberBan(button.dataset.memberBan);
        });
    });
}

async function changeMemberRole(memberId, role) {
    if (!ROLE_VALUES.includes(role)) return;

    const member = state.members.find(item => item.id === memberId);
    if (!member) return;

    if (member.role === role) return;

    if (!confirmAction(
        `Change this member's role from ${member.role} to ${role}?`
    )) {
        await renderMembers();
        return;
    }

    try {
        const { error } = await supabase
            .from("chat_community_members")
            .update({ role })
            .eq("id", memberId);

        if (error) throw error;

        await writeAuditLog(
            "Changed community member role",
            "permissions",
            "community_member",
            memberId,
            {
                user_id: member.user_id,
                community_id: member.community_id,
                previous_role: member.role,
                new_role: role
            }
        );

        showStatus("Member role updated.");

        await loadMembers();

    } catch (error) {
        console.error("Role update failed:", error);
        showStatus("Could not change member role: " + errorMessage(error), "error");
        await loadMembers();
    }
}

async function toggleMemberMute(memberId) {
    const member = state.members.find(item => item.id === memberId);
    if (!member) return;

    const nextValue = !member.is_muted;

    if (!confirmAction(`${nextValue ? "Mute" : "Unmute"} this member?`)) return;

    try {
        const { error } = await supabase
            .from("chat_community_members")
            .update({ is_muted: nextValue })
            .eq("id", memberId);

        if (error) throw error;

        await writeAuditLog(
            nextValue ? "Muted community member" : "Unmuted community member",
            "moderation",
            "community_member",
            memberId,
            { user_id: member.user_id, community_id: member.community_id }
        );

        showStatus(nextValue ? "Member muted." : "Member unmuted.");

        await loadMembers();

    } catch (error) {
        console.error("Member mute update failed:", error);
        showStatus("Could not update member: " + errorMessage(error), "error");
        await loadMembers();
    }
}

async function toggleMemberBan(memberId) {
    const member = state.members.find(item => item.id === memberId);
    if (!member) return;

    const nextValue = !member.is_banned;

    if (!confirmAction(`${nextValue ? "Ban" : "Unban"} this member?`)) return;

    try {
        const { error } = await supabase
            .from("chat_community_members")
            .update({ is_banned: nextValue })
            .eq("id", memberId);

        if (error) throw error;

        await writeAuditLog(
            nextValue ? "Banned community member" : "Unbanned community member",
            "moderation",
            "community_member",
            memberId,
            { user_id: member.user_id, community_id: member.community_id }
        );

        showStatus(nextValue ? "Member banned." : "Member unbanned.");

        await loadMembers();

    } catch (error) {
        console.error("Member ban update failed:", error);
        showStatus("Could not update member: " + errorMessage(error), "error");
        await loadMembers();
    }
}

/* ============================================================
   ANALYTICS
   ============================================================ */

async function loadAnalytics() {
    const days = Number($("analyticsPeriod")?.value || 30);

    try {
        const { data, error } = await supabase.rpc("admin_get_analytics", {
            p_days: days
        });

        if (error) throw error;

        state.analytics = data;

        renderAnalytics(data);

    } catch (error) {
        console.error("Analytics loading failed:", error);

        showStatus("Analytics could not be loaded: " + errorMessage(error), "error");

        if ($("registrationChart")) {
            $("registrationChart").textContent =
                "Analytics unavailable: " + errorMessage(error);
        }
    }
}

function renderAnalytics(data) {
    if (!data) return;

    const totals = data.totals || {};

    setText("analyticsRegistrations", totals.registered_accounts ?? 0);
    setText("analyticsCourses", totals.courses ?? 0);
    setText("analyticsMessages", totals.messages ?? 0);
    setText("analyticsReports", totals.reports ?? 0);

    setText(
        "analyticsGeneratedAt",
        "Last generated: " + formatDateTime(data.generated_at)
    );

    const daily = Array.isArray(data.daily) ? data.daily : [];

    renderSimpleChart(
        "registrationChart",
        daily,
        "registrations",
        "Registrations"
    );

    renderMultiChart(
        "activityChart",
        daily,
        ["messages", "reports"]
    );
}

function renderSimpleChart(containerId, rows, key, label) {
    const container = $(containerId);
    if (!container) return;

    if (!rows.length) {
        container.textContent = "No activity data available.";
        return;
    }

    const values = rows.map(row => Number(row[key] || 0));
    const maximum = Math.max(...values, 1);

    const width = 700;
    const height = 230;
    const left = 38;
    const right = 15;
    const top = 15;
    const bottom = 35;

    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;

    const points = values.map((value, index) => {
        const x = left + (
            values.length === 1
                ? usableWidth / 2
                : index * usableWidth / (values.length - 1)
        );

        const y = top + usableHeight - (value / maximum) * usableHeight;

        return `${x},${y}`;
    }).join(" ");

    const circles = values.map((value, index) => {
        const x = left + (
            values.length === 1
                ? usableWidth / 2
                : index * usableWidth / (values.length - 1)
        );

        const y = top + usableHeight - (value / maximum) * usableHeight;

        return `<circle cx="${x}" cy="${y}" r="3" fill="#087f73">
            <title>${escapeHTML(rows[index].date)}: ${value}</title>
        </circle>`;
    }).join("");

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img"
            aria-label="${escapeHTML(label)} chart">
            <line x1="${left}" y1="${top}"
                x2="${left}" y2="${height - bottom}"
                stroke="#dbe4e7"/>

            <line x1="${left}" y1="${height - bottom}"
                x2="${width - right}" y2="${height - bottom}"
                stroke="#dbe4e7"/>

            <polyline points="${points}"
                fill="none"
                stroke="#087f73"
                stroke-width="3"
                stroke-linejoin="round"
                stroke-linecap="round"/>

            ${circles}

            <text x="${left}" y="${height - 8}" font-size="11" fill="#667">
                ${escapeHTML(rows[0].date)}
            </text>

            <text x="${width - right}" y="${height - 8}"
                text-anchor="end" font-size="11" fill="#667">
                ${escapeHTML(rows[rows.length - 1].date)}
            </text>
        </svg>
        <p class="chart-caption">${escapeHTML(label)} · Total: ${values.reduce((a, b) => a + b, 0)}</p>
    `;
}

function renderMultiChart(containerId, rows, keys) {
    const container = $(containerId);
    if (!container) return;

    if (!rows.length) {
        container.textContent = "No activity data available.";
        return;
    }

    const totals = keys.map(key => ({
        key,
        total: rows.reduce((sum, row) => sum + Number(row[key] || 0), 0)
    }));

    container.innerHTML = `
        <div class="analytics-bars">
            ${totals.map(item => `
                <div class="analytics-bar-item">
                    <div>
                        <strong>${escapeHTML(item.key)}</strong>
                        <span>${item.total.toLocaleString()}</span>
                    </div>
                    <div class="analytics-bar-track">
                        <div class="analytics-bar-fill"
                            style="width:${Math.min(
                                100,
                                item.total / Math.max(...totals.map(x => x.total), 1) * 100
                            )}%">
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

/* ============================================================
   AUDIT LOGS
   ============================================================ */

async function loadAuditLogs() {
    const body = $("auditTableBody");
    if (body) body.innerHTML = emptyRow(6, "Loading audit logs...");

    try {
        const category = $("auditCategoryFilter")?.value || null;

        const { data, error } = await supabase.rpc("admin_list_audit_logs", {
            p_limit: 100,
            p_offset: 0,
            p_category: category
        });

        if (error) throw error;

        state.auditLogs = Array.isArray(data) ? data : [];

        renderAuditLogs();

    } catch (error) {
        console.error("Audit loading failed:", error);

        if (body) body.innerHTML = emptyRow(6, errorMessage(error));

        showStatus("Could not load audit logs: " + errorMessage(error), "error");
    }
}

function renderAuditLogs() {
    const body = $("auditTableBody");
    if (!body) return;

    if (!state.auditLogs.length) {
        body.innerHTML = emptyRow(6, "No audit records found.");
        return;
    }

    body.innerHTML = state.auditLogs.map(log => `
        <tr>
            <td>${escapeHTML(formatDateTime(log.created_at))}</td>
            <td><small>${escapeHTML(log.actor_id)}</small></td>
            <td>${escapeHTML(log.action)}</td>
            <td>${escapeHTML(log.category)}</td>
            <td>
                ${escapeHTML(log.target_type || "—")}
                ${log.target_id ? `<small>${escapeHTML(log.target_id)}</small>` : ""}
            </td>
            <td>
                <button type="button"
                    class="student-view-button"
                    data-audit-details="${escapeHTML(log.id)}">
                    View
                </button>
            </td>
        </tr>
    `).join("");

    body.querySelectorAll("[data-audit-details]").forEach(button => {
        button.addEventListener("click", () => {
            const log = state.auditLogs.find(
                item => String(item.id) === button.dataset.auditDetails
            );

            if (!log) return;

            window.alert(
                "Audit details\n\n" +
                JSON.stringify(log.details || {}, null, 2)
            );
        });
    });
}

/* ============================================================
   DASHBOARD REFRESH
   ============================================================ */

async function refreshDashboard() {
    const button = $("refreshAdminButton");

    if (button) button.disabled = true;

    try {
        await Promise.all([
            loadOverviewCounts(),
            loadCommunities()
        ]);

        showStatus("Dashboard data refreshed.");

    } catch (error) {
        showStatus("Refresh failed: " + errorMessage(error), "error");

    } finally {
        if (button) button.disabled = false;
    }
}

/* ============================================================
   SIGN OUT
   ============================================================ */

async function logoutAdmin() {
    const button = $("adminLogoutButton");

    if (button) button.disabled = true;

    try {
        await writeAuditLog(
            "Administrator signed out",
            "authentication",
            "admin_session"
        );

        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("adminLogin.html");

    } catch (error) {
        console.error("Sign out failed:", error);

        showStatus("Could not sign out: " + errorMessage(error), "error");

        if (button) button.disabled = false;
    }
}

/* ============================================================
   EVENT INITIALIZATION
   ============================================================ */

function initializeEvents() {
    initializeNavigation();

    $("studentSearch")?.addEventListener("input", event => {
        state.studentsSearch = event.target.value;
        filterStudents();
    });

    $("reloadStudentsButton")?.addEventListener("click", loadStudents);

    $("courseForm")?.addEventListener("submit", createCourse);

    $("communityForm")?.addEventListener("submit", saveCommunity);

    $("cancelCommunityEdit")?.addEventListener("click", resetCommunityForm);

    $("channelForm")?.addEventListener("submit", saveChannel);

    $("cancelChannelEdit")?.addEventListener("click", resetChannelForm);

    $("channelCommunityFilter")?.addEventListener("change", loadChannels);

    $("loadMembersButton")?.addEventListener("click", loadMembers);

    $("memberSearch")?.addEventListener("input", renderMembers);

    $("reloadReportsButton")?.addEventListener("click", loadReports);

    $("analyticsPeriod")?.addEventListener("change", loadAnalytics);

    $("reloadAuditButton")?.addEventListener("click", loadAuditLogs);

    $("auditCategoryFilter")?.addEventListener("change", loadAuditLogs);

    $("refreshAdminButton")?.addEventListener("click", refreshDashboard);

    $("adminLogoutButton")?.addEventListener("click", logoutAdmin);

    $("studentDetailsClose")?.addEventListener("click", closeStudentDetails);

    $("reportDetailsClose")?.addEventListener("click", () => {
        if ($("reportDetailsModal")) {
            $("reportDetailsModal").hidden = true;
        }
    });

    $("studentDetailsModal")?.addEventListener("click", event => {
        if (event.target.id === "studentDetailsModal") {
            closeStudentDetails();
        }
    });

    $("reportDetailsModal")?.addEventListener("click", event => {
        if (event.target.id === "reportDetailsModal") {
            $("reportDetailsModal").hidden = true;
        }
    });

    $("memberActionClose")?.addEventListener("click", () => {
        if ($("memberActionModal")) {
            $("memberActionModal").hidden = true;
        }
    });

    $("memberActionModal")?.addEventListener("click", event => {
        if (event.target.id === "memberActionModal") {
            $("memberActionModal").hidden = true;
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeStudentDetails();

            if ($("reportDetailsModal")) {
                $("reportDetailsModal").hidden = true;
            }

            if ($("memberActionModal")) {
                $("memberActionModal").hidden = true;
            }

            closeMobileSidebar();
        }
    });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

async function initializeAdminDashboard() {
    try {
        await verifyAdminSession();

        initializeEvents();

        await refreshDashboard();

        console.log("Mwaniki Scholars Administration Portal loaded.");

    } catch (error) {
        console.error("Admin dashboard initialization failed:", error);

        showStatus(
            "Dashboard initialization failed: " + errorMessage(error),
            "error"
        );
    }
}

initializeAdminDashboard();

/* ============================================================
   PUBLIC FUNCTIONS
   ============================================================ */

window.loadAdminStudents = loadStudents;
window.refreshAdminDashboard = refreshDashboard;
window.openAdminWorkspace = openWorkspace;
window.closeStudentDetails = closeStudentDetails;
window.loadAdminCommunities = loadCommunities;
window.loadAdminChannels = loadChannels;
window.loadAdminReports = loadReports;
window.loadAdminAnalytics = loadAnalytics;
window.loadAdminAuditLogs = loadAuditLogs;
