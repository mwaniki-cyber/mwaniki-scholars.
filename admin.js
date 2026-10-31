
import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   PLATFORM ADMINISTRATION CONTROLLER

   Modules:
   1. Course management
   2. Student statistics
   3. Platform statistics
   4. Community monitoring
   5. Channel statistics
   6. Message monitoring statistics
   7. Online user statistics
   8. Report monitoring statistics

   Existing community and calling systems are not modified.
========================================================= */


/* =========================================================
   GENERAL HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function setHTML(id, value) {
    const element = $(id);
    if (element) element.innerHTML = value;
}

function showStatus(id, message, success = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#087f73" : "#dc2626";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

async function getCount(table, filters = []) {
    let query = supabase
        .from(table)
        .select("*", { count: "exact", head: true });

    for (const filter of filters) {
        query = query.eq(filter.column, filter.value);
    }

    const { count, error } = await query;

    if (error) {
        console.error(`Unable to count ${table}:`, error);
        return null;
    }

    return count ?? 0;
}

function displayCount(id, count, label = "Unavailable") {
    setText(id, count === null ? label : count.toLocaleString());
}


/* =========================================================
   1. ADD COURSE
========================================================= */

window.addCourse = async function () {

    const name = $("courseName")?.value.trim();
    const description = $("courseDescription")?.value.trim() || "";

    if (!name) {
        showStatus("courseStatus", "Please enter a course title.");
        return;
    }

    showStatus("courseStatus", "Adding course...", true);

    try {
        const { error } = await supabase
            .from("courses")
            .insert({
                title: name,
                description: description
            });

        if (error) throw error;

        showStatus(
            "courseStatus",
            "Course added successfully.",
            true
        );

        if ($("courseName")) $("courseName").value = "";
        if ($("courseDescription")) {
            $("courseDescription").value = "";
        }

        await loadCourseCount();

    } catch (error) {
        console.error("Add course error:", error);

        showStatus(
            "courseStatus",
            "Unable to add course: " + error.message
        );
    }
};


/* =========================================================
   2. STUDENT STATISTICS
========================================================= */

async function loadStudents() {

    const count = await getCount("profiles");

    displayCount("studentCount", count);

    return count;
}


/* =========================================================
   3. COURSE STATISTICS
========================================================= */

async function loadCourseCount() {

    const count = await getCount("courses");

    displayCount("courseCount", count);

    return count;
}


/* =========================================================
   4. COMMUNITY STATISTICS
========================================================= */

async function loadCommunityCount() {

    const count = await getCount("chat_communities");

    displayCount("communityCount", count);

    return count;
}


/* =========================================================
   5. CHANNEL STATISTICS
========================================================= */

async function loadChannelCount() {

    const count = await getCount("chat_channels");

    displayCount("channelCount", count);

    return count;
}


/* =========================================================
   6. MESSAGE STATISTICS
========================================================= */

async function loadMessageCount() {

    const count = await getCount("chat_messages");

    displayCount("messageCount", count);

    return count;
}


/* =========================================================
   7. ONLINE USER MONITORING
========================================================= */

async function loadOnlineUsers() {

    const count = await getCount("chat_presence", [
        {
            column: "status",
            value: "online"
        }
    ]);

    displayCount("onlineCount", count);

    return count;
}


/* =========================================================
   8. REPORT MONITORING
========================================================= */

async function loadReportCount() {

    const count = await getCount("chat_reports");

    displayCount("reportCount", count);

    return count;
}


/* =========================================================
   9. COMMUNITY DIRECTORY
========================================================= */

window.loadAdminCommunities = async function () {

    const container = $("communityList");

    if (!container) return;

    container.textContent = "Loading communities...";

    try {

        const { data, error } = await supabase
            .from("chat_communities")
            .select(`
                id,
                name,
                description,
                is_active,
                created_at
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.textContent = "No communities found.";
            return;
        }

        container.innerHTML = data.map(community => `

            <div class="admin-community-item"
                 data-community-id="${escapeHTML(community.id)}">

                <div class="admin-community-information">

                    <h3>${escapeHTML(community.name)}</h3>

                    <p>
                        ${escapeHTML(
                            community.description || "No description"
                        )}
                    </p>

                </div>

                <span class="admin-community-status"
                      style="color:${
                          community.is_active ? "#087f73" : "#dc2626"
                      }">

                    ${community.is_active ? "Active" : "Inactive"}

                </span>

                <button
                    type="button"
                    onclick="openCommunityAdmin('${escapeHTML(community.id)}')">

                    Manage Community

                </button>

            </div>

        `).join("");

    } catch (error) {

        console.error("Community loading error:", error);

        container.textContent =
            "Unable to load communities: " + error.message;
    }
};


/* =========================================================
   10. OPEN COMMUNITY ADMINISTRATION
========================================================= */

window.openCommunityAdmin = function (communityId) {

    if (!communityId) return;

    const params = new URLSearchParams({
        community: communityId
    });

    window.location.href =
        "communityAdmin.html?" + params.toString();
};


/* =========================================================
   11. PLATFORM OVERVIEW
========================================================= */

window.loadAdminOverview = async function () {

    const results = await Promise.allSettled([

        loadStudents(),
        loadCourseCount(),
        loadCommunityCount(),
        loadChannelCount(),
        loadMessageCount(),
        loadOnlineUsers(),
        loadReportCount()

    ]);

    console.log("Mwaniki Scholars statistics loaded.");

    return results;
};


/* =========================================================
   12. REFRESH DASHBOARD
========================================================= */

window.refreshAdminDashboard = async function () {

    const button = $("refreshAdminButton");

    if (button) {
        button.disabled = true;
        button.textContent = "Refreshing...";
    }

    try {

        await window.loadAdminOverview();

        await window.loadAdminCommunities();

        console.log("Admin dashboard refreshed.");

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "Refresh Dashboard";
        }
    }
};


/* =========================================================
   13. INITIALIZATION
========================================================= */

async function initializeAdminDashboard() {

    console.log("Initializing Mwaniki Scholars Admin Dashboard...");

    try {

        await window.loadAdminOverview();

        await window.loadAdminCommunities();

        console.log("Admin Dashboard Connected.");

    } catch (error) {

        console.error("Admin initialization error:", error);

    }
}

initializeAdminDashboard();
