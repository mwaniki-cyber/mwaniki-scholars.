
import { supabase } from "./supabase.js";

/* ======================================================
   MWANIKI SCHOLARS
   PLATFORM ADMINISTRATION CONTROLLER
   ====================================================== */

const $ = id => document.getElementById(id);

const state = {
    students: [],
    communities: [],
    activeView: "overview",
    search: ""
};

const viewTitles = {
    overview: "Overview",
    students: "Student Management",
    tutors: "Tutor Management",
    courses: "Course Management",
    learning: "Learning Resources",
    community: "Community Management",
    moderation: "Moderation",
    analytics: "Analytics",
    permissions: "Permissions",
    audit: "Audit Logs",
    settings: "Settings"
};

/* ======================================================
   GENERAL HELPERS
   ====================================================== */

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

function showStatus(message, type = "success") {
    const box = $("adminStatus");
    if (!box) return;

    box.textContent = message;
    box.dataset.type = type;
    box.hidden = false;

    if (type !== "error") {
        window.setTimeout(() => {
            if (box.textContent === message) box.hidden = true;
        }, 4500);
    }
}

function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function formatDateTime(value) {
    if (!value) return "Never recorded";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString();
}

/* ======================================================
   WORKSPACE NAVIGATION
   ====================================================== */

function openWorkspace(viewName) {
    const target = $("view-" + viewName);

    if (!target) {
        console.warn("Unknown dashboard workspace:", viewName);
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

    setText("workspaceTitle", viewTitles[viewName] || "Administration");

    closeMobileSidebar();

    if (viewName === "students" && state.students.length === 0) {
        loadStudents();
    }

    if (viewName === "community" && state.communities.length === 0) {
        loadCommunities();
    }
}

function initializeNavigation() {
    document.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
            openWorkspace(button.dataset.view);
        });
    });

    openWorkspace("overview");
}

/* ======================================================
   RESPONSIVE SIDEBAR
   ====================================================== */

function openMobileSidebar() {
    $("adminSidebar")?.classList.add("mobile-open");
    $("sidebarOverlay")?.classList.add("active");
}

function closeMobileSidebar() {
    $("adminSidebar")?.classList.remove("mobile-open");
    $("sidebarOverlay")?.classList.remove("active");
}

function initializeSidebar() {
    $("sidebarToggle")?.addEventListener("click", openMobileSidebar);
    $("sidebarClose")?.addEventListener("click", closeMobileSidebar);
    $("sidebarOverlay")?.addEventListener("click", closeMobileSidebar);
}

/* ======================================================
   DATABASE COUNTS
   ====================================================== */

async function countRows(table, filters = []) {
    try {
        let query = supabase
            .from(table)
            .select("*", { count: "exact", head: true });

        for (const [column, operator, value] of filters) {
            query = query.filter(column, operator, value);
        }

        const { count, error } = await query;

        if (error) {
            console.error(`Count failed for ${table}:`, error);
            return null;
        }

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

/* ======================================================
   STUDENT DIRECTORY
   ====================================================== */

async function loadStudents() {
    const body = $("studentsTableBody");

    if (body) {
        body.innerHTML = `
            <tr>
                <td colspan="8">Loading registered accounts...</td>
            </tr>`;
    }

    try {
        const { data, error } = await supabase.rpc("admin_list_students");

        if (error) throw error;

        state.students = Array.isArray(data) ? data : [];

        const total = state.students.length;

        const complete = state.students.filter(
            student => student.has_student_record === true
        ).length;

        const incomplete = total - complete;

        setText("studentCount", total);
        setText("sidebarStudentCount", total);
        setText("registeredAccountCount", total);
        setText("completeStudentCount", complete);
        setText("incompleteStudentCount", incomplete);

        filterStudents();

    } catch (error) {
        console.error("Could not load student directory:", error);

        if (body) {
            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        Student directory could not be loaded.
                        ${escapeHTML(error.message)}
                    </td>
                </tr>`;
        }

        showStatus(
            "Student directory error: " + error.message,
            "error"
        );
    }
}

function filterStudents() {
    const search = state.search.trim().toLowerCase();

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
        body.innerHTML = `
            <tr>
                <td colspan="8">No matching registered accounts found.</td>
            </tr>`;
        return;
    }

    body.innerHTML = students.map(student => {
        const name = student.full_name || "Profile incomplete";
        const firstLetter = name.trim().charAt(0).toUpperCase() || "S";

        const photo = student.photo_url
            ? `<img
                src="${escapeHTML(student.photo_url)}"
                alt=""
                class="student-avatar"
                loading="lazy"
                onerror="this.style.display='none';this.nextElementSibling.hidden=false">
               <span class="student-avatar-placeholder" hidden>${escapeHTML(firstLetter)}</span>`
            : `<span class="student-avatar-placeholder">${escapeHTML(firstLetter)}</span>`;

        const profileStatus = student.has_student_record
            ? `<span class="profile-status complete">Available</span>`
            : `<span class="profile-status incomplete">Incomplete</span>`;

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
                <td>${profileStatus}</td>
                <td>${escapeHTML(formatDate(student.registered_at))}</td>
                <td>
                    <button
                        type="button"
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

/* ======================================================
   STUDENT DETAILS
   ====================================================== */

function openStudentDetails(userId) {
    const student = state.students.find(
        item => item.user_id === userId
    );

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
        </div>
    `;

    modal.hidden = false;
}

function closeStudentDetails() {
    const modal = $("studentDetailsModal");
    if (modal) modal.hidden = true;
}

/* ======================================================
   COURSE MANAGEMENT
   ====================================================== */

async function createCourse(event) {
    event.preventDefault();

    const title = $("courseName")?.value.trim();
    const description = $("courseDescription")?.value.trim();
    const status = $("courseStatus");
    const submitButton = $("courseForm")?.querySelector(
        'button[type="submit"]'
    );

    if (!title) {
        if (status) status.textContent = "Please enter a course title.";
        return;
    }

    if (submitButton) submitButton.disabled = true;
    if (status) status.textContent = "Creating course...";

    try {
        const { error } = await supabase
            .from("courses")
            .insert({
                title,
                description: description || null
            });

        if (error) throw error;

        $("courseForm")?.reset();

        if (status) {
            status.textContent = "Course created successfully.";
        }

        const count = await countRows("courses");

        if (count !== null) {
            setText("courseCount", count);
            setText("courseWorkspaceCount", count);
        }

        showStatus("Course created successfully.");

    } catch (error) {
        console.error("Course creation failed:", error);

        if (status) status.textContent = error.message;

        showStatus("Could not create course: " + error.message, "error");

    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

/* ======================================================
   COMMUNITY MANAGEMENT
   ====================================================== */

async function loadCommunities() {
    const container = $("communityList");
    if (!container) return;

    container.textContent = "Loading communities...";

    try {
        const { data, error } = await supabase
            .from("chat_communities")
            .select("id,name,description,is_active,created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        state.communities = data || [];

        if (!state.communities.length) {
            container.textContent = "No communities found.";
            return;
        }

        container.innerHTML = state.communities.map(community => `
            <div class="community-admin-item">
                <div>
                    <strong>${escapeHTML(community.name)}</strong>
                    <p>${escapeHTML(community.description || "No description")}</p>
                    <small>${community.is_active ? "Active" : "Inactive"}</small>
                </div>

                <button
                    type="button"
                    data-community-id="${escapeHTML(community.id)}">
                    Manage
                </button>
            </div>
        `).join("");

        container.querySelectorAll("[data-community-id]").forEach(button => {
            button.addEventListener("click", () => {
                window.location.href =
                    "communityAdmin.html?community=" +
                    encodeURIComponent(button.dataset.communityId);
            });
        });

    } catch (error) {
        console.error("Community loading failed:", error);
        container.textContent =
            "Could not load communities: " + error.message;
    }
}

/* ======================================================
   DASHBOARD REFRESH
   ====================================================== */

async function refreshDashboard() {
    const button = $("refreshAdminButton");

    if (button) button.disabled = true;

    try {
        await Promise.all([
            loadOverviewCounts(),
            loadCommunities()
        ]);

        showStatus("Dashboard data refreshed.");

    } finally {
        if (button) button.disabled = false;
    }
}

/* ======================================================
   SIGN OUT
   ====================================================== */

async function logoutAdmin() {
    const button = $("adminLogoutButton");

    if (button) button.disabled = true;

    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("adminLogin.html");

    } catch (error) {
        console.error("Sign out failed:", error);

        showStatus("Could not sign out: " + error.message, "error");

        if (button) button.disabled = false;
    }
}

/* ======================================================
   INITIALIZATION
   ====================================================== */

function initializeDashboardEvents() {
    initializeNavigation();
    initializeSidebar();

    $("studentSearch")?.addEventListener("input", event => {
        state.search = event.target.value;
        filterStudents();
    });

    $("reloadStudentsButton")?.addEventListener("click", loadStudents);

    $("courseForm")?.addEventListener("submit", createCourse);

    $("refreshAdminButton")?.addEventListener(
        "click",
        refreshDashboard
    );

    $("adminLogoutButton")?.addEventListener(
        "click",
        logoutAdmin
    );

    $("studentDetailsClose")?.addEventListener(
        "click",
        closeStudentDetails
    );

    $("studentDetailsModal")?.addEventListener("click", event => {
        if (event.target.id === "studentDetailsModal") {
            closeStudentDetails();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeStudentDetails();
            closeMobileSidebar();
        }
    });
}

async function initializeAdminDashboard() {
    initializeDashboardEvents();

    await refreshDashboard();

    console.log("Mwaniki Scholars Administration Portal loaded.");
}

initializeAdminDashboard();

/* Public functions for any existing integrations */
window.loadAdminStudents = loadStudents;
window.refreshAdminDashboard = refreshDashboard;
window.openAdminWorkspace = openWorkspace;
window.closeStudentDetails = closeStudentDetails;
