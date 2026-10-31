
import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS — PLATFORM ADMIN DASHBOARD
   Student management + platform monitoring
   ========================================================= */

const $ = (id) => document.getElementById(id);

const state = {
    students: [],
    filteredStudents: [],
    studentSearch: "",
    initialized: false
};

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? "0";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showAdminMessage(message, type = "info") {
    const element = $("adminStatus");
    if (!element) {
        console.log(message);
        return;
    }

    element.textContent = message;
    element.dataset.type = type;
    element.hidden = false;
}

async function getCount(table, filters = []) {
    let query = supabase
        .from(table)
        .select("*", { count: "exact", head: true });

    for (const [column, operator, value] of filters) {
        query = query.filter(column, operator, value);
    }

    const { count, error } = await query;

    if (error) {
        console.error(`Could not count ${table}:`, error);
        return null;
    }

    return count ?? 0;
}

/* =========================================================
   ADMIN OVERVIEW
   ========================================================= */

async function loadOverview() {
    const tasks = [
        ["studentCount", getCount("students")],
        ["courseCount", getCount("courses")],
        ["communityCount", getCount("chat_communities")],
        ["channelCount", getCount("chat_channels")],
        ["messageCount", getCount("chat_messages")],
        ["onlineCount", getCount("chat_presence", [
            ["status", "eq", "online"]
        ])],
        ["reportCount", getCount("chat_reports")]
    ];

    await Promise.all(tasks.map(async ([id, promise]) => {
        const count = await promise;
        if (count !== null) setText(id, count);
    }));

    // The student directory count is based on actual
    // authenticated accounts, not only profile records.
    await loadStudents();
}

/* =========================================================
   STUDENT MANAGEMENT
   ========================================================= */

async function loadStudents() {
    const tableBody = $("studentsTableBody");

    if (tableBody) {
        tableBody.innerHTML =
            `<tr><td colspan="7">Loading registered students...</td></tr>`;
    }

    try {
        const { data, error } = await supabase.rpc("admin_list_students");

        if (error) throw error;

        state.students = Array.isArray(data) ? data : [];

        setText("studentCount", state.students.length);
        setText("registeredAccountCount", state.students.length);

        const complete = state.students.filter(
            student => student.has_student_record
        ).length;

        setText("completeStudentCount", complete);
        setText(
            "incompleteStudentCount",
            state.students.length - complete
        );

        filterStudents();

    } catch (error) {
        console.error("Student directory error:", error);

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        Unable to load students.
                        Check administrator permissions and the RPC function.
                    </td>
                </tr>`;
        }

        showAdminMessage(
            "Could not load student accounts: " + error.message,
            "error"
        );
    }
}

function filterStudents() {
    const term = state.studentSearch.trim().toLowerCase();

    state.filteredStudents = state.students.filter(student => {
        const searchable = [
            student.full_name,
            student.email,
            student.phone,
            student.course,
            student.level,
            student.user_id
        ].join(" ").toLowerCase();

        return searchable.includes(term);
    });

    renderStudents();
}

function renderStudents() {
    const tableBody = $("studentsTableBody");
    if (!tableBody) return;

    if (!state.filteredStudents.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    No matching registered students found.
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = state.filteredStudents.map(student => {
        const name = student.full_name || "Profile incomplete";
        const email = student.email || "No email";
        const profileStatus = student.has_student_record
            ? "Complete"
            : "Incomplete";

        const date = student.registered_at
            ? new Date(student.registered_at).toLocaleDateString()
            : "Unavailable";

        return `
            <tr>
                <td>
                    <div class="student-identity">
                        ${
                            student.photo_url
                            ? `<img class="student-avatar"
                                src="${escapeHTML(student.photo_url)}"
                                alt=""
                                onerror="this.style.display='none'">`
                            : `<span class="student-avatar-placeholder">
                                ${escapeHTML(name.charAt(0).toUpperCase())}
                               </span>`
                        }
                        <div>
                            <strong>${escapeHTML(name)}</strong>
                            <small>${escapeHTML(student.user_id)}</small>
                        </div>
                    </div>
                </td>

                <td>${escapeHTML(email)}</td>
                <td>${escapeHTML(student.phone || "Not provided")}</td>
                <td>${escapeHTML(student.course || "Not provided")}</td>
                <td>${escapeHTML(student.level || "Not provided")}</td>
                <td>
                    <span class="profile-status ${
                        student.has_student_record ? "complete" : "incomplete"
                    }">
                        ${profileStatus}
                    </span>
                </td>
                <td>${escapeHTML(date)}</td>
                <td>
                    <button type="button"
                        class="student-view-button"
                        data-student-id="${escapeHTML(student.user_id)}">
                        View details
                    </button>
                </td>
            </tr>`;
    }).join("");

    tableBody.querySelectorAll("[data-student-id]").forEach(button => {
        button.addEventListener("click", () => {
            openStudentDetails(button.dataset.studentId);
        });
    });
}

/* =========================================================
   INDIVIDUAL STUDENT DETAILS
   ========================================================= */

function openStudentDetails(userId) {
    const student = state.students.find(
        item => item.user_id === userId
    );

    if (!student) return;

    const modal = $("studentDetailsModal");
    const content = $("studentDetailsContent");

    if (!modal || !content) {
        showAdminMessage(
            "Student details: " +
            (student.full_name || student.email || student.user_id)
        );
        return;
    }

    const details = [
        ["Full name", student.full_name],
        ["Email", student.email],
        ["Phone", student.phone],
        ["Course", student.course],
        ["Level", student.level],
        ["Account ID", student.user_id],
        ["Registration date", student.registered_at],
        ["Last sign-in", student.last_sign_in_at],
        ["Email confirmed", student.email_confirmed_at ? "Yes" : "No"],
        ["Student profile", student.has_student_record ? "Available" : "Incomplete"]
    ];

    content.innerHTML = `
        <h3>${escapeHTML(student.full_name || "Student account")}</h3>
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

/* =========================================================
   COURSE MANAGEMENT
   ========================================================= */

window.addCourse = async function () {
    const title = $("courseName")?.value.trim();
    const description = $("courseDescription")?.value.trim();
    const status = $("courseStatus");

    if (!title) {
        showAdminMessage("Enter a course title.", "error");
        return;
    }

    if (status) status.textContent = "Creating course...";

    try {
        const { error } = await supabase
            .from("courses")
            .insert({
                title,
                description
            });

        if (error) throw error;

        if ($("courseName")) $("courseName").value = "";
        if ($("courseDescription")) $("courseDescription").value = "";

        if (status) status.textContent = "Course created successfully.";

        const count = await getCount("courses");
        if (count !== null) setText("courseCount", count);

    } catch (error) {
        console.error(error);
        if (status) status.textContent = error.message;
    }
};

/* =========================================================
   COMMUNITY DIRECTORY
   ========================================================= */

window.loadAdminCommunities = async function () {
    const container = $("communityList");
    if (!container) return;

    container.textContent = "Loading communities...";

    try {
        const { data, error } = await supabase
            .from("chat_communities")
            .select("id,name,description,is_active,created_at")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data?.length) {
            container.textContent = "No communities found.";
            return;
        }

        container.innerHTML = data.map(community => `
            <div class="community-admin-item">
                <div>
                    <strong>${escapeHTML(community.name)}</strong>
                    <p>${escapeHTML(community.description || "")}</p>
                    <small>${community.is_active ? "Active" : "Inactive"}</small>
                </div>
                <button type="button"
                    data-community-id="${escapeHTML(community.id)}">
                    Manage
                </button>
            </div>
        `).join("");

        container.querySelectorAll("[data-community-id]").forEach(button => {
            button.addEventListener("click", () => {
                window.openCommunityAdmin(button.dataset.communityId);
            });
        });

    } catch (error) {
        console.error(error);
        container.textContent = "Unable to load communities: " + error.message;
    }
};

window.openCommunityAdmin = function (communityId) {
    window.location.href =
        "communityAdmin.html?community=" +
        encodeURIComponent(communityId);
};

/* =========================================================
   REFRESH AND INITIALIZATION
   ========================================================= */

window.refreshAdminDashboard = async function () {
    showAdminMessage("Refreshing dashboard...");
    await loadOverview();
    await window.loadAdminCommunities();
    showAdminMessage("Dashboard refreshed.", "success");
};

window.loadAdminStudents = loadStudents;
window.filterAdminStudents = filterStudents;
window.closeStudentDetails = closeStudentDetails;

async function initializeAdminDashboard() {
    if (state.initialized) return;
    state.initialized = true;

    const search = $("studentSearch");

    if (search) {
        search.addEventListener("input", event => {
            state.studentSearch = event.target.value;
            filterStudents();
        });
    }

    $("studentDetailsClose")?.addEventListener(
        "click",
        closeStudentDetails
    );

    $("studentDetailsModal")?.addEventListener("click", event => {
        if (event.target.id === "studentDetailsModal") {
            closeStudentDetails();
        }
    });

    await Promise.all([
        loadOverview(),
        window.loadAdminCommunities()
    ]);
}

initializeAdminDashboard();
