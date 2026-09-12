import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT DASHBOARD ENGINE
// MATCHED TO CURRENT dashboard.html
// =====================================================

console.log("🚀 Mwaniki Scholars dashboard starting...");

// =====================================================
// STATE
// =====================================================

let currentUser = null;
let currentStudent = null;

let dashboardCourses = [];
let dashboardNotes = [];
let dashboardQuizCount = 0;

// =====================================================
// HELPERS
// =====================================================

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setText(id, value, fallback = "Not available") {
    const element = $(id);

    if (!element) {
        return;
    }

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        element.textContent = fallback;
        return;
    }

    element.textContent = value;
}

function getInitials(name) {
    if (!name) {
        return "S";
    }

    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return "S";
    }

    if (parts.length === 1) {
        return parts[0]
            .charAt(0)
            .toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

// =====================================================
// COURSE ICONS
// =====================================================

function getCourseIcon(courseTitle) {
    const title = String(courseTitle || "").toLowerCase();

    if (
        title.includes("physiology") ||
        title.includes("cardio")
    ) {
        return "🫀";
    }

    if (title.includes("pharmac")) {
        return "💊";
    }

    if (title.includes("micro")) {
        return "🦠";
    }

    if (title.includes("pathology")) {
        return "🔬";
    }

    if (title.includes("parasit")) {
        return "🪱";
    }

    if (
        title.includes("mycology") ||
        title.includes("fung")
    ) {
        return "🍄";
    }

    if (title.includes("hemat")) {
        return "🩸";
    }

    if (title.includes("immun")) {
        return "🛡️";
    }

    if (title.includes("anatom")) {
        return "🦴";
    }

    if (title.includes("biochem")) {
        return "🧪";
    }

    if (title.includes("genetic")) {
        return "🧬";
    }

    return "📚";
}

// =====================================================
// COURSE URL
// =====================================================

function getCourseURL(course) {
    const id = course?.id;

    if (!id) {
        return "./course.html";
    }

    return `./course.html?course=${encodeURIComponent(id)}`;
}

// =====================================================
// AUTHENTICATED USER
// =====================================================

async function loadCurrentUser() {
    try {
        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error(
                "❌ Could not load authenticated user:",
                error
            );

            return null;
        }

        currentUser = data?.user || null;

        return currentUser;

    } catch (error) {
        console.error(
            "❌ Authentication error:",
            error
        );

        return null;
    }
}

// =====================================================
// STUDENT PROFILE
// =====================================================

async function loadStudentProfile() {
    if (!currentUser) {
        return;
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from("students")
            .select(`
                id,
                full_name,
                email,
                phone,
                course,
                level,
                photo_url,
                created_at
            `)
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {
            console.warn(
                "⚠️ Student profile could not be loaded:",
                error
            );

            currentStudent = null;
        } else {
            currentStudent = data || null;
        }

        const metadata =
            currentUser.user_metadata || {};

        const studentName =
            currentStudent?.full_name ||
            metadata.full_name ||
            metadata.name ||
            currentUser.email?.split("@")[0] ||
            "Student";

        const studentEmail =
            currentStudent?.email ||
            currentUser.email ||
            "Not available";

        updateStudentIdentity(
            studentName,
            studentEmail
        );

        setText(
            "profilePanelCourse",
            currentStudent?.course,
            "Not available"
        );

        setText(
            "profilePanelLevel",
            currentStudent?.level,
            "Not available"
        );

    } catch (error) {
        console.error(
            "❌ Student profile error:",
            error
        );
    }
}

// =====================================================
// STUDENT IDENTITY
// =====================================================

function updateStudentIdentity(name, email) {
    setText(
        "welcomeName",
        name,
        "Student"
    );

    setText(
        "profileButtonName",
        name,
        "Student"
    );

    setText(
        "profilePanelName",
        name,
        "Student"
    );

    setText(
        "profilePanelEmail",
        email,
        "Not available"
    );

    const initials =
        getInitials(name);

    setText(
        "profileInitial",
        initials,
        "S"
    );

    setText(
        "profilePanelInitial",
        initials,
        "S"
    );
}

// =====================================================
// CURRENT DATE
// =====================================================

function setupCurrentDate() {
    const element = $("currentDate");

    if (!element) {
        return;
    }

    const now = new Date();

    element.textContent =
        now.toLocaleDateString(
            undefined,
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
}

// =====================================================
// LOAD COURSES
// =====================================================

async function loadCourses() {
    const grid = $("courseGrid");
    const recommendations = $("recommendationsGrid");

    try {
        if (grid) {
            grid.innerHTML = `
                <div class="loading-card">
                    <div class="loading-spinner"></div>
                    <p>Loading courses...</p>
                </div>
            `;
        }

        if (recommendations) {
            recommendations.innerHTML = `
                <div class="loading-card">
                    <div class="loading-spinner"></div>
                    <p>Loading recommendations...</p>
                </div>
            `;
        }

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select("*")
            .order("id", {
                ascending: true
            });

        if (error) {
            console.error(
                "❌ Course loading failed:",
                error
            );

            dashboardCourses = [];

            showCourseError(
                "Unable to load courses right now."
            );

            return;
        }

        dashboardCourses =
            Array.isArray(data)
                ? data
                : [];

        setText(
            "totalCourses",
            dashboardCourses.length,
            "0"
        );

        renderRecommendations();
        renderCourseLibrary();
        renderRecentCourse();

    } catch (error) {
        console.error(
            "❌ Course error:",
            error
        );

        showCourseError(
            "Something went wrong while loading courses."
        );
    }
}

// =====================================================
// COURSE CARD
// =====================================================

function createCourseCard(course) {
    const title =
        course?.title ||
        "Untitled Course";

    const description =
        course?.description ||
        "Explore this medical course and begin learning.";

    const icon =
        getCourseIcon(title);

    const image =
        String(course?.image || "").trim();

    let imageHTML;

    if (image) {
        imageHTML = `
            <div class="course-card-image">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(title)}"
                    loading="lazy"
                    onerror="this.style.display='none'; this.parentElement.classList.add('image-failed');"
                >
            </div>
        `;
    } else {
        imageHTML = `
            <div
                class="course-card-image course-card-image-placeholder"
                aria-hidden="true"
            >
                ${icon}
            </div>
        `;
    }

    return `
        <article class="course-card">

            ${imageHTML}

            <div class="course-card-content">

                <span class="course-label">
                    MEDICAL COURSE
                </span>

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(description)}
                </p>

                <a
                    href="${getCourseURL(course)}"
                    class="primary-button course-open-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    Open Course →
                </a>

            </div>

        </article>
    `;
}

// =====================================================
// RECOMMENDATIONS
// =====================================================

function renderRecommendations() {
    const container =
        $("recommendationsGrid");

    if (!container) {
        return;
    }

    if (!dashboardCourses.length) {
        container.innerHTML = `
            <div class="loading-card">
                <p>No courses are available yet.</p>
            </div>
        `;

        return;
    }

    const recentCourseId =
        localStorage.getItem(
            "selectedCourse"
        );

    let recommended =
        dashboardCourses.filter(
            course =>
                String(course.id) !==
                String(recentCourseId)
        );

    if (!recommended.length) {
        recommended =
            dashboardCourses;
    }

    recommended =
        recommended.slice(0, 3);

    container.innerHTML =
        recommended
            .map(createRecommendationCard)
            .join("");

    attachCourseLinks(container);
}

// =====================================================
// RECOMMENDATION CARD
// =====================================================

function createRecommendationCard(course) {
    const title =
        course?.title ||
        "Untitled Course";

    const description =
        course?.description ||
        "Explore this medical course.";

    const image =
        String(course?.image || "").trim();

    const icon =
        getCourseIcon(title);

    const visual =
        image
            ? `
                <div class="recommendation-image">
                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(title)}"
                        loading="lazy"
                        onerror="this.style.display='none'; this.parentElement.classList.add('image-failed');"
                    >
                </div>
            `
            : `
                <div
                    class="recommendation-image recommendation-image-placeholder"
                    aria-hidden="true"
                >
                    ${icon}
                </div>
            `;

    return `
        <article class="recommendation-card">

            ${visual}

            <div class="recommendation-content">

                <span class="course-label">
                    RECOMMENDED
                </span>

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
                    ${escapeHTML(description)}
                </p>

                <a
                    href="${getCourseURL(course)}"
                    class="primary-button course-open-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    Open Course →
                </a>

            </div>

        </article>
    `;
}

// =====================================================
// COURSE LIBRARY
// =====================================================

function renderCourseLibrary() {
    const container =
        $("courseGrid");

    if (!container) {
        return;
    }

    if (!dashboardCourses.length) {
        container.innerHTML = `
            <div class="loading-card">
                <p>No courses are available.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        dashboardCourses
            .map(createCourseCard)
            .join("");

    attachCourseLinks(container);
}

// =====================================================
// COURSE LINKS
// =====================================================

function attachCourseLinks(container) {
    const links =
        container.querySelectorAll(
            "[data-course-id]"
        );

    links.forEach(link => {
        link.addEventListener(
            "click",
            event => {
                event.preventDefault();

                const id =
                    link.dataset.courseId;

                const course =
                    dashboardCourses.find(
                        item =>
                            String(item.id) ===
                            String(id)
                    );

                if (course) {
                    openCourse(course);
                }
            }
        );
    });
}

// =====================================================
// OPEN COURSE
// =====================================================

function openCourse(course) {
    if (!course) {
        return;
    }

    const courseId =
        course.id;

    const courseName =
        course.title || "";

    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );

    localStorage.setItem(
        "selectedCourseName",
        courseName
    );

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: courseId,
            title: courseName,
            description:
                course.description || "",
            image:
                course.image || "",
            openedAt:
                new Date().toISOString()
        })
    );

    window.location.href =
        getCourseURL(course);
}

// =====================================================
// COURSE ERROR
// =====================================================

function showCourseError(message) {
    const html = `
        <div class="error-card">
            ${escapeHTML(message)}
        </div>
    `;

    const grid =
        $("courseGrid");

    const recommendations =
        $("recommendationsGrid");

    if (grid) {
        grid.innerHTML = html;
    }

    if (recommendations) {
        recommendations.innerHTML = html;
    }
}

// =====================================================
// RECENT COURSE
// =====================================================

function getStoredRecentCourse() {
    try {
        const stored =
            localStorage.getItem(
                "mwanikiLastCourse"
            );

        if (stored) {
            return JSON.parse(stored);
        }

    } catch (error) {
        console.warn(
            "⚠️ Could not read recent course:",
            error
        );
    }

    const id =
        localStorage.getItem(
            "selectedCourse"
        );

    const title =
        localStorage.getItem(
            "selectedCourseName"
        );

    if (id || title) {
        return {
            id,
            title
        };
    }

    return null;
}

// =====================================================
// RECENT COURSE
// =====================================================

function renderRecentCourse() {
    const titleElement =
        $("recentCourseTitle");

    const descriptionElement =
        $("recentCourseDescription");

    const button =
        $("continueRecentCourse");

    const image =
        $("recentCourseImage");

    const placeholder =
        $("recentCourseImagePlaceholder");

    if (
        !titleElement ||
        !descriptionElement ||
        !button
    ) {
        return;
    }

    const recent =
        getStoredRecentCourse();

    // -------------------------------------------------
    // NO RECENT COURSE
    // -------------------------------------------------

    if (!recent) {
        titleElement.textContent =
            "No recent course";

        descriptionElement.textContent =
            "Select a course from the course library to begin learning.";

        button.textContent =
            "Browse Courses";

        button.href =
            "#courses";

        if (image) {
            image.hidden = true;
            image.removeAttribute("src");
        }

        if (placeholder) {
            placeholder.hidden = false;
            placeholder.textContent = "📚";
        }

        return;
    }

    // -------------------------------------------------
    // FIND ACTUAL COURSE
    // -------------------------------------------------

    const matchingCourse =
        dashboardCourses.find(
            course =>
                String(course.id) ===
                String(recent.id)
        );

    const course =
        matchingCourse || recent;

    const title =
        course?.title ||
        recent?.title ||
        "Recent Course";

    const description =
        course?.description ||
        "Continue studying this course from where you left off.";

    titleElement.textContent =
        title;

    descriptionElement.textContent =
        description;

    button.textContent =
        "Continue Course →";

    // -------------------------------------------------
    // COURSE IMAGE
    // -------------------------------------------------

    const courseImage =
        String(course?.image || "").trim();

    if (courseImage && image) {
        image.src =
            courseImage;

        image.alt =
            title;

        image.hidden = false;

        if (placeholder) {
            placeholder.hidden = true;
        }

        image.onerror = () => {
            image.hidden = true;
            image.removeAttribute("src");

            if (placeholder) {
                placeholder.hidden = false;
                placeholder.textContent =
                    getCourseIcon(title);
            }
        };

    } else {
        if (image) {
            image.hidden = true;
            image.removeAttribute("src");
        }

        if (placeholder) {
            placeholder.hidden = false;
            placeholder.textContent =
                getCourseIcon(title);
        }
    }

    // -------------------------------------------------
    // CONTINUE BUTTON
    // -------------------------------------------------

    if (matchingCourse) {
        button.onclick = event => {
            event.preventDefault();
            openCourse(matchingCourse);
        };

        button.href =
            getCourseURL(matchingCourse);

    } else {
        button.onclick = null;

        button.href =
            "./course.html";
    }
}

// =====================================================
// NOTES
// =====================================================

async function loadNotes() {
    const container =
        $("notesGrid");

    try {
        if (container) {
            container.innerHTML = `
                <div class="loading-card">
                    <div class="loading-spinner"></div>
                    <p>Loading notes...</p>
                </div>
            `;
        }

        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select("*")
            .eq("published", true)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            console.error(
                "❌ Notes loading failed:",
                error
            );

            dashboardNotes = [];

            if (container) {
                container.innerHTML = `
                    <div class="error-card">
                        Notes could not be loaded.
                        Please check the Supabase notes
                        RLS policy.
                    </div>
                `;
            }

            return;
        }

        dashboardNotes =
            Array.isArray(data)
                ? data
                : [];

        setText(
            "totalNotes",
            dashboardNotes.length,
            "0"
        );

        renderNotes();

    } catch (error) {
        console.error(
            "❌ Notes error:",
            error
        );
    }
}

// =====================================================
// RENDER NOTES
// =====================================================

function renderNotes() {
    const container =
        $("notesGrid");

    if (!container) {
        return;
    }

    if (!dashboardNotes.length) {
        container.innerHTML = `
            <div class="loading-card">
                <p>
                    No published notes are available yet.
                </p>
            </div>
        `;

        return;
    }

    const notes =
        dashboardNotes.slice(0, 9);

    container.innerHTML =
        notes
            .map(note => {
                const title =
                    note.file_name ||
                    note.unit ||
                    "Study Note";

                const course =
                    note.course ||
                    "Medical Studies";

                const unit =
                    note.unit ||
                    "Published learning resource";

                const url =
                    String(note.file_url || "").trim();

                return `
                    <article class="note-card">

                        <div class="note-card-top">

                            <div class="note-icon">
                                📝
                            </div>

                            <div>

                                <h3>
                                    ${escapeHTML(title)}
                                </h3>

                                <div class="note-card-course">
                                    ${escapeHTML(course)}
                                </div>

                            </div>

                        </div>

                        <p>
                            ${escapeHTML(unit)}
                        </p>

                        ${
                            url
                                ? `
                                    <a
                                        href="${escapeHTML(url)}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="note-button"
                                    >
                                        View Note →
                                    </a>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="note-button"
                                        disabled
                                    >
                                        Resource unavailable
                                    </button>
                                `
                        }

                    </article>
                `;
            })
            .join("");
}

// =====================================================
// QUIZ COUNT
// =====================================================

async function loadQuizCount() {
    try {
        const {
            count,
            error
        } = await supabase
            .from("quizzes")
            .select(
                "*",
                {
                    count: "exact",
                    head: true
                }
            );

        if (error) {
            console.error(
                "❌ Quiz count failed:",
                error
            );

            setText(
                "totalQuizzes",
                "0",
                "0"
            );

            return;
        }

        dashboardQuizCount =
            Number(count || 0);

        setText(
            "totalQuizzes",
            dashboardQuizCount,
            "0"
        );
    } catch (error) {
        console.error(
            "❌ Quiz error:",
            error
        );
    }
}

// =====================================================
// LEARNING PROGRESS
// =====================================================

function loadLearningProgress() {
    let percentage = 0;

    try {
        const raw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );

        if (raw) {
            const parsed =
                JSON.parse(raw);

            if (
                typeof parsed === "number"
            ) {
                percentage =
                    parsed;
            } else if (
                parsed &&
                typeof parsed === "object"
            ) {
                const values =
                    Object.values(parsed);

                if (values.length) {
                    const completed =
                        values.filter(
                            item =>
                                item?.completed === true ||
                                item === true
                        ).length;

                    percentage =
                        Math.round(
                            (
                                completed /
                                values.length
                            ) * 100
                        );
                }
            }
        }

    } catch (error) {
        console.warn(
            "⚠️ Could not read quiz progress:",
            error
        );
    }

    updateLearningProgress(
        percentage
    );
}

// =====================================================
// UPDATE PROGRESS
// =====================================================

function updateLearningProgress(percentage) {
    const safe =
        Math.max(
            0,
            Math.min(
                100,
                Number(percentage) || 0
            )
        );

    setText(
        "learningProgress",
        `${safe}%`,
        "0%"
    );

    setText(
        "quizProgressPercent",
        `${safe}%`,
        "0%"
    );

    const bar =
        $("learningProgressBar");

    if (bar) {
        bar.style.width =
            `${safe}%`;
    }
}

// =====================================================
// NAVIGATION
// =====================================================

function setupNavigation() {
    const links =
        document.querySelectorAll(
            ".dashboard-nav-link"
        );

    links.forEach(link => {
        link.addEventListener(
            "click",
            event => {

                const href =
                    link.getAttribute("href");

                // External page links such as
                // AI Tutor / Tutor / Inbox
                // should work normally.

                if (
                    href &&
                    !href.startsWith("#")
                ) {
                    return;
                }

                links.forEach(item => {
                    item.classList.remove(
                        "active"
                    );
                });

                link.classList.add(
                    "active"
                );
            }
        );
    });

    // Smooth scrolling for dashboard sections

    document.querySelectorAll(
        'a[href^="#"]'
    ).forEach(link => {

        link.addEventListener(
            "click",
            event => {

                const targetId =
                    link.getAttribute("href");

                if (
                    !targetId ||
                    targetId === "#"
                ) {
                    return;
                }

                const target =
                    document.querySelector(
                        targetId
                    );

                if (!target) {
                    return;
                }

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        );
    });
}

// =====================================================
// NOTIFICATIONS
// =====================================================

function setupNotifications() {
    const button =
        $("notificationButton");

    const panel =
        $("notificationPanel");

    const closeButton =
        $("closeNotificationPanel");

    if (!button || !panel) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            const willOpen =
                panel.hidden;

            panel.hidden =
                !willOpen;

            const profile =
                $("profilePanel");

            if (profile) {
                profile.hidden = true;
            }

            button.setAttribute(
                "aria-expanded",
                String(willOpen)
            );
        }
    );

    closeButton?.addEventListener(
        "click",
        () => {
            panel.hidden = true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}

// =====================================================
// PROFILE PANEL
// =====================================================

function setupProfilePanel() {
    const button =
        $("profileButton");

    const panel =
        $("profilePanel");

    const closeButton =
        $("closeProfilePanel");

    if (!button || !panel) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            const willOpen =
                panel.hidden;

            panel.hidden =
                !willOpen;

            const notifications =
                $("notificationPanel");

            if (notifications) {
                notifications.hidden = true;
            }

            button.setAttribute(
                "aria-expanded",
                String(willOpen)
            );
        }
    );

    closeButton?.addEventListener(
        "click",
        () => {

            panel.hidden = true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}

// =====================================================
// CLICK OUTSIDE PANELS
// =====================================================

function setupOutsidePanelClose() {
    document.addEventListener(
        "click",
        event => {

            const profile =
                $("profilePanel");

            const profileButton =
                $("profileButton");

            const notification =
                $("notificationPanel");

            const notificationButton =
                $("notificationButton");

            if (
                profile &&
                !profile.hidden &&
                !profile.contains(event.target) &&
                !profileButton?.contains(event.target)
            ) {
                profile.hidden = true;

                profileButton?.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }

            if (
                notification &&
                !notification.hidden &&
                !notification.contains(event.target) &&
                !notificationButton?.contains(event.target)
            ) {
                notification.hidden = true;

                notificationButton?.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );
}

// =====================================================
// LOGOUT
// =====================================================

function setupLogout() {
    const button =
        $("logoutButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "Logging out...";

            try {
                const {
                    error
                } = await supabase.auth.signOut();

                if (error) {
                    throw error;
                }

                localStorage.removeItem(
                    "selectedCourse"
                );

                localStorage.removeItem(
                    "selectedCourseName"
                );

                localStorage.removeItem(
                    "selectedUnit"
                );

                localStorage.removeItem(
                    "selectedUnitTitle"
                );

                localStorage.removeItem(
                    "mwanikiLastCourse"
                );

                window.location.href =
                    "./index.html";

            } catch (error) {

                console.error(
                    "❌ Logout failed:",
                    error
                );

                button.disabled = false;

                button.textContent =
                    "Log Out";
            }
        }
    );
}

// =====================================================
// REFRESH BUTTONS
// =====================================================

function setupRefreshButtons() {
    const coursesButton =
        $("refreshCoursesButton");

    if (coursesButton) {
        coursesButton.addEventListener(
            "click",
            async () => {

                coursesButton.disabled =
                    true;

                coursesButton.textContent =
                    "Refreshing...";

                await loadCourses();

                coursesButton.disabled =
                    false;

                coursesButton.textContent =
                    "Refresh";
            }
        );
    }

    const notesButton =
        $("refreshNotesButton");

    if (notesButton) {
        notesButton.addEventListener(
            "click",
            async () => {

                notesButton.disabled =
                    true;

                notesButton.textContent =
                    "Refreshing...";

                await loadNotes();

                notesButton.disabled =
                    false;

                notesButton.textContent =
                    "Refresh";
            }
        );
    }
}

// =====================================================
// TRACK COURSE / UNIT
// =====================================================

window.mwanikiTrackUnit = function (
    courseId,
    courseTitle,
    unitId,
    unitTitle
) {
    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );

    localStorage.setItem(
        "selectedCourseName",
        courseTitle || ""
    );

    localStorage.setItem(
        "selectedUnit",
        String(unitId)
    );

    localStorage.setItem(
        "selectedUnitTitle",
        unitTitle || ""
    );

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: courseId,
            title: courseTitle || "",
            unitId: unitId,
            unitTitle: unitTitle || "",
            openedAt:
                new Date().toISOString()
        })
    );
};

// =====================================================
// PUBLIC DASHBOARD API
// =====================================================

window.mwanikiDashboard = {
    refreshCourses: loadCourses,
    refreshNotes: loadNotes,
    refreshQuizCount: loadQuizCount,
    refreshProgress: loadLearningProgress,

    getCourses: () =>
        dashboardCourses,

    getNotes: () =>
        dashboardNotes,

    getCurrentStudent: () =>
        currentStudent,

    getCurrentUser: () =>
        currentUser
};

// =====================================================
// INITIALIZE
// =====================================================

async function initializeDashboard() {
    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    setupCurrentDate();
    setupNavigation();
    setupNotifications();
    setupProfilePanel();
    setupOutsidePanelClose();
    setupLogout();
    setupRefreshButtons();

    const user =
        await loadCurrentUser();

    if (!user) {
        console.warn(
            "⚠️ No authenticated user found."
        );

        window.location.href =
            "./index.html";

        return;
    }

    await loadStudentProfile();

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizCount()
    ]);

    loadLearningProgress();

    console.log(
        "✅ Mwaniki Scholars dashboard ready."
    );
}

// =====================================================
// START
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeDashboard
);
