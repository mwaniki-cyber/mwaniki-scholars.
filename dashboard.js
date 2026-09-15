import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
   ALIGNED WITH THE CURRENT dashboard.html
========================================================= */

console.log("🚀 Mwaniki Scholars dashboard engine loaded");

/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;
let dashboardInitializing = false;
let dashboardClockTimer = null;

/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent = value ?? "";
    }
}

function setHTML(selector, value) {
    const element = $(selector);

    if (element) {
        element.innerHTML = value ?? "";
    }
}

function showElement(selector, displayValue = "") {
    const element = $(selector);

    if (element) {
        element.style.display = displayValue;
    }
}

function hideElement(selector) {
    const element = $(selector);

    if (element) {
        element.style.display = "none";
    }
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setCounterText(selector, value) {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent = Number(value || 0).toLocaleString();
}

function showMessage(selector, message, type = "info") {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent = message;
    element.dataset.type = type;
}

/* =========================================================
   LOCAL STORAGE HELPERS
========================================================= */

function readStorage(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        return JSON.parse(value);
    } catch (error) {
        console.warn(`⚠️ Could not read localStorage key: ${key}`, error);
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`⚠️ Could not write localStorage key: ${key}`, error);
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn(`⚠️ Could not remove localStorage key: ${key}`, error);
    }
}

/* =========================================================
   COURSE NORMALIZATION
========================================================= */

function normalizeCourse(course) {
    if (!course) {
        return null;
    }

    const id = course.id ?? course.courseId ?? course.course_id ?? null;

    const title =
        course.title ||
        course.courseTitle ||
        course.course_name ||
        course.name ||
        "Untitled Course";

    if (id === null || id === undefined || id === "") {
        return null;
    }

    return {
        id,
        title,
        description: course.description || "",
        image: course.image || "",
        created_at: course.created_at || null
    };
}

function getCourseURL(course) {
    const normalizedCourse = normalizeCourse(course);

    if (!normalizedCourse) {
        return "./courses.html";
    }

    return `./course.html?course_id=${encodeURIComponent(
        normalizedCourse.id
    )}`;
}

/* =========================================================
   RECENT COURSE STORAGE
========================================================= */

function getLastCourse() {
    const storedCourse = readStorage("mwanikiLastCourse", null);

    return normalizeCourse(storedCourse);
}

function saveLastCourse(course) {
    const normalizedCourse = normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    writeStorage("mwanikiLastCourse", normalizedCourse);
}

function getRecentCourses() {
    const recentCourses = readStorage("mwanikiRecentCourses", []);

    if (!Array.isArray(recentCourses)) {
        return [];
    }

    return recentCourses
        .map(normalizeCourse)
        .filter(Boolean);
}

function saveRecentCourse(course) {
    const normalizedCourse = normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    const existingCourses = getRecentCourses();

    const filteredCourses = existingCourses.filter(
        item => String(item.id) !== String(normalizedCourse.id)
    );

    filteredCourses.unshift(normalizedCourse);

    writeStorage(
        "mwanikiRecentCourses",
        filteredCourses.slice(0, 8)
    );
}

function saveSelectedCourse(course) {
    const normalizedCourse = normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    writeStorage("selectedCourse", normalizedCourse.id);
    writeStorage("selectedCourseName", normalizedCourse.title);

    saveLastCourse(normalizedCourse);
    saveRecentCourse(normalizedCourse);
}

/* =========================================================
   COURSE OPENING
========================================================= */

function openCourse(course) {
    const normalizedCourse = normalizeCourse(course);

    if (!normalizedCourse) {
        console.warn("⚠️ Cannot open invalid course:", course);
        return;
    }

    saveSelectedCourse(normalizedCourse);

    window.location.href = getCourseURL(normalizedCourse);
}

window.mwanikiOpenCourse = openCourse;

/* =========================================================
   LIVE DATE AND TIME
========================================================= */

function updateCurrentDate() {
    const currentDateElement = $("#currentDate");

    if (!currentDateElement) {
        return;
    }

    const now = new Date();

    const formattedDate = now.toLocaleDateString("en-KE", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    const formattedTime = now.toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit"
    });

    currentDateElement.textContent =
        `${formattedDate} • ${formattedTime}`;
}

function startDashboardClock() {
    updateCurrentDate();

    if (dashboardClockTimer) {
        clearInterval(dashboardClockTimer);
    }

    dashboardClockTimer = setInterval(updateCurrentDate, 60000);
}

/* =========================================================
   AUTHENTICATION
========================================================= */

async function getAuthenticatedUser() {
    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        console.error("❌ Could not get authenticated user:", error);
        return null;
    }

    return data?.user || null;
}

async function handleSignedOut() {
    currentUser = null;
    currentStudent = null;
    dashboardReady = false;

    window.location.href = "./index.html";
}

/* =========================================================
   STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {
    if (!currentUser) {
        return false;
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
            console.error("❌ Student profile loading failed:", error);
            return false;
        }

        currentStudent = data || {
            id: currentUser.id,
            full_name:
                currentUser.user_metadata?.full_name ||
                currentUser.user_metadata?.name ||
                "Student",
            email: currentUser.email || "",
            phone: "",
            course: "",
            level: "",
            photo_url: ""
        };

        renderStudentProfile();

        return true;
    } catch (error) {
        console.error("❌ Unexpected profile error:", error);
        return false;
    }
}

function getStudentDisplayName() {
    if (!currentStudent) {
        return "Student";
    }

    return (
        currentStudent.full_name ||
        currentStudent.name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.email?.split("@")[0] ||
        "Student"
    );
}

function getStudentFirstName() {
    return getStudentDisplayName()
        .trim()
        .split(/\s+/)[0] || "Student";
}

function renderStudentProfile() {
    const displayName = getStudentDisplayName();

    setText("#headerProfileName", displayName);
    setText("#welcomeName", getStudentFirstName());

    setText("#profileName", currentStudent?.full_name || displayName);
    setText("#profileEmail", currentStudent?.email || currentUser?.email || "");
    setText("#profilePhone", currentStudent?.phone || "");
    setText("#profileCourse", currentStudent?.course || "");
    setText("#profileLevel", currentStudent?.level || "");

    const photoURL = currentStudent?.photo_url || "";

    if (photoURL) {
        setAvatar("#headerProfileAvatar", photoURL, displayName);
        setAvatar("#profileLargeAvatar", photoURL, displayName);
    } else {
        setAvatar("#headerProfileAvatar", "", displayName);
        setAvatar("#profileLargeAvatar", "", displayName);
    }
}

function setAvatar(selector, photoURL, name) {
    const element = $(selector);

    if (!element) {
        return;
    }

    if (photoURL) {
        element.src = photoURL;
        element.alt = `${name} profile photo`;
        element.style.display = "block";
    } else {
        element.removeAttribute("src");
        element.alt = name;
    }
}

/* =========================================================
   PROFILE PANEL
========================================================= */

function openProfilePanel() {
    const panel = $("#profilePanel");

    if (!panel) {
        return;
    }

    panel.classList.add("active");
    panel.setAttribute("aria-hidden", "false");
}

function closeProfilePanel() {
    const panel = $("#profilePanel");

    if (!panel) {
        return;
    }

    panel.classList.remove("active");
    panel.setAttribute("aria-hidden", "true");
}

function setupProfilePanel() {
    const profileButton = $("#profileButton");
    const closeProfileButton = $("#closeProfilePanel");

    profileButton?.addEventListener("click", () => {
        renderStudentProfile();
        openProfilePanel();
    });

    closeProfileButton?.addEventListener("click", closeProfilePanel);
}

function setupProfileForm() {
    const saveButton = $("#saveProfileButton");

    saveButton?.addEventListener("click", saveStudentProfile);
}

async function saveStudentProfile() {
    if (!currentUser || !currentStudent) {
        return;
    }

    const fullName =
        $("#profileName")?.value?.trim() ||
        $("#profileName")?.textContent?.trim() ||
        getStudentDisplayName();

    const phone = $("#profilePhone")?.value?.trim() || "";
    const course = $("#profileCourse")?.value?.trim() || "";
    const level = $("#profileLevel")?.value?.trim() || "";

    const saveStatus = $("#profileSaveStatus");

    if (saveStatus) {
        saveStatus.textContent = "Saving profile...";
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from("students")
            .update({
                full_name: fullName,
                phone,
                course,
                level
            })
            .eq("id", currentUser.id)
            .select()
            .maybeSingle();

        if (error) {
            console.error("❌ Profile update failed:", error);

            if (saveStatus) {
                saveStatus.textContent =
                    "Could not save profile. Check the console.";
            }

            return;
        }

        currentStudent = {
            ...currentStudent,
            ...(data || {}),
            full_name: fullName,
            phone,
            course,
            level
        };

        renderStudentProfile();

        if (saveStatus) {
            saveStatus.textContent = "Profile saved successfully.";
        }
    } catch (error) {
        console.error("❌ Unexpected profile save error:", error);

        if (saveStatus) {
            saveStatus.textContent = "Unexpected error while saving.";
        }
    }
}/* =========================================================
   PROFILE PHOTO PREVIEW
========================================================= */

function setupProfilePhoto() {
    const photoInput = $("#profilePhotoInput");

    if (!photoInput) {
        return;
    }

    photoInput.addEventListener("change", event => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            showMessage(
                "#profileSaveStatus",
                "Please select an image file.",
                "error"
            );

            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const imageURL = reader.result;

            setAvatar(
                "#headerProfileAvatar",
                imageURL,
                getStudentDisplayName()
            );

            setAvatar(
                "#profileLargeAvatar",
                imageURL,
                getStudentDisplayName()
            );

            showMessage(
                "#profileSaveStatus",
                "Photo preview updated. Permanent photo storage requires a configured Supabase Storage bucket.",
                "info"
            );
        };

        reader.readAsDataURL(file);
    });
}

/* =========================================================
   PASSWORD RESET
========================================================= */

function setupChangePassword() {
    const button = $("#changePasswordButton");

    button?.addEventListener("click", async () => {
        if (!currentUser?.email) {
            return;
        }

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const {
                error
            } = await supabase.auth.resetPasswordForEmail(
                currentUser.email
            );

            if (error) {
                console.error("❌ Password reset error:", error);
                alert("Could not send the password reset email.");
                return;
            }

            alert(
                "A password reset email has been sent to your registered email address."
            );
        } catch (error) {
            console.error("❌ Unexpected password reset error:", error);
            alert("An unexpected error occurred.");
        } finally {
            button.disabled = false;
            button.textContent = "Change Password";
        }
    });
}

/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {
    const logoutButton = $("#logoutButton");

    logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";

        const {
            error
        } = await supabase.auth.signOut();

        if (error) {
            console.error("❌ Logout failed:", error);

            logoutButton.disabled = false;
            logoutButton.textContent = "Logout";
            return;
        }

        window.location.href = "./index.html";
    });
}

/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function openNotificationPanel() {
    const panel = $("#notificationPanel");

    if (!panel) {
        return;
    }

    panel.classList.add("active");
    panel.setAttribute("aria-hidden", "false");
}

function closeNotificationPanel() {
    const panel = $("#notificationPanel");

    if (!panel) {
        return;
    }

    panel.classList.remove("active");
    panel.setAttribute("aria-hidden", "true");
}

function setupNotificationPanel() {
    const notificationButton = $("#notificationButton");
    const closeButton = $("#closeNotificationPanel");

    notificationButton?.addEventListener("click", () => {
        renderNotifications();
        openNotificationPanel();
    });

    closeButton?.addEventListener(
        "click",
        closeNotificationPanel
    );
}

function renderNotifications() {
    const notificationContent = $("#notificationContent");

    if (!notificationContent) {
        return;
    }

    notificationContent.innerHTML = `
        <div class="notification-item">
            <strong>Welcome to Mwaniki Scholars</strong>
            <p>Your medical learning dashboard is ready.</p>
        </div>

        <div class="notification-item">
            <strong>Course Library</strong>
            <p>Explore your available medical courses and learning units.</p>
        </div>

        <div class="notification-item">
            <strong>Keep learning</strong>
            <p>Complete quizzes and review your notes regularly.</p>
        </div>
    `;
}

/* =========================================================
   NAVIGATION
========================================================= */

function activateSection(sectionId) {
    $all(".nav-link").forEach(link => {
        const isActive =
            link.dataset.section === sectionId;

        link.classList.toggle("active", isActive);
        link.setAttribute("aria-current", isActive ? "page" : "false");
    });
}

function setupNavigation() {
    $all(".nav-link").forEach(link => {
        const sectionId = link.dataset.section;

        if (!sectionId) {
            return;
        }

        link.addEventListener("click", event => {
            const section = document.getElementById(sectionId);

            if (!section) {
                return;
            }

            event.preventDefault();

            activateSection(sectionId);

            section.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    });
}

/* =========================================================
   COURSE LOADING
========================================================= */

async function loadCourses() {
    const courseGrid = $("#courseGrid");

    if (courseGrid) {
        courseGrid.innerHTML = `
            <div class="loading-state">
                Loading courses...
            </div>
        `;
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select(`
                id,
                title,
                description,
                image,
                created_at
            `)
            .order("id", {
                ascending: true
            });

        if (error) {
            console.error("❌ Course loading failed:", error);

            allCourses = [];

            if (courseGrid) {
                courseGrid.innerHTML = `
                    <div class="empty-state">
                        Unable to load courses.
                    </div>
                `;
            }

            updateDashboardStatistics();
            return;
        }

        allCourses = (data || [])
            .map(normalizeCourse)
            .filter(Boolean);

        console.log("📚 Courses loaded:", allCourses.length);

        renderCourseLibrary();
        renderRecentCourse();
        renderRecommendations();
        updateDashboardStatistics();
    } catch (error) {
        console.error("❌ Unexpected course loading error:", error);

        allCourses = [];

        if (courseGrid) {
            courseGrid.innerHTML = `
                <div class="empty-state">
                    An unexpected error occurred while loading courses.
                </div>
            `;
        }
    }
}

function renderCourseLibrary() {
    const courseGrid = $("#courseGrid");

    if (!courseGrid) {
        console.warn("⚠️ #courseGrid was not found.");
        return;
    }

    if (!allCourses.length) {
        courseGrid.innerHTML = `
            <div class="empty-state">
                No courses are currently available.
            </div>
        `;

        return;
    }

    courseGrid.innerHTML = allCourses
        .map(course => {
            const imageHTML = course.image
                ? `
                    <img
                        src="${escapeHTML(course.image)}"
                        alt="${escapeHTML(course.title)}"
                        loading="lazy"
                        onerror="this.style.display='none';"
                    >
                `
                : `
                  <div class="course-card-placeholder" aria-hidden="true"></div>
                `;

            return `
                <article class="course-card" data-course-id="${escapeHTML(course.id)}">
                    <div class="course-card-image">
                        ${imageHTML}
                    </div>

                    <div class="course-card-content">
                        <h3>${escapeHTML(course.title)}</h3>

                        <p>
                            ${escapeHTML(
                                course.description ||
                                "Explore this medical course and begin learning."
                            )}
                        </p>

                        <button
                            type="button"
                            class="course-card-button"
                            data-open-course="${escapeHTML(course.id)}"
                        >
                            Start Learning
                        </button>
                    </div>
                </article>
            `;
        })
        .join("");

    courseGrid
        .querySelectorAll("[data-open-course]")
        .forEach(button => {
            button.addEventListener("click", () => {
                const courseId = button.dataset.openCourse;

                const course = allCourses.find(
                    item => String(item.id) === String(courseId)
                );

                openCourse(course);
            });
        });
}

/* =========================================================
   RECENT COURSE
========================================================= */

function renderRecentCourse() {
    const recentCourse = getLastCourse();

    const titleElement = $("#recentCourseTitle");
    const descriptionElement = $("#recentCourseDescription");
    const imageElement = $("#recentCourseImage");
    const placeholderElement = $("#recentCourseImagePlaceholder");
    const buttonElement = $("#recentCourseButton");

    if (!titleElement || !descriptionElement || !buttonElement) {
        return;
    }

    if (!recentCourse) {
        titleElement.textContent = "No recent course";
        descriptionElement.textContent =
            "Choose a course from the Course Library to begin learning.";

        if (imageElement) {
            imageElement.style.display = "none";
        }

        if (placeholderElement) {
            placeholderElement.style.display = "flex";
        }

        buttonElement.textContent = "Explore Courses";

        buttonElement.onclick = () => {
            $("#courses")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

            activateSection("courses");
        };

        return;
    }

    titleElement.textContent = recentCourse.title;

    descriptionElement.textContent =
        recentCourse.description ||
        "Continue learning from your previously selected course.";

    if (recentCourse.image && imageElement) {
        imageElement.src = recentCourse.image;
        imageElement.alt = recentCourse.title;
        imageElement.style.display = "block";

        if (placeholderElement) {
            placeholderElement.style.display = "none";
        }
    } else {
        if (imageElement) {
            imageElement.style.display = "none";
        }

        if (placeholderElement) {
            placeholderElement.style.display = "flex";
        }
    }

    buttonElement.textContent = "Continue Learning";

    buttonElement.onclick = () => {
        openCourse(recentCourse);
    };
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function renderRecommendations() {
    const recommendationsGrid = $("#recommendationsGrid");

    if (!recommendationsGrid) {
        return;
    }

    if (!allCourses.length) {
        recommendationsGrid.innerHTML = `
            <div class="empty-state">
                Recommendations will appear when courses are available.
            </div>
        `;

        return;
    }

    const lastCourse = getLastCourse();

    let recommendations = allCourses.filter(course => {
        if (!lastCourse) {
            return true;
        }

        return String(course.id) !== String(lastCourse.id);
    });

    if (!recommendations.length) {
        recommendations = allCourses;
    }

    recommendations = recommendations.slice(0, 3);

    recommendationsGrid.innerHTML = recommendations
        .map(course => {
            return `
                <article class="recommendation-card">
                    <div class="recommendation-card-content">
                        <span class="recommendation-label">
                            Recommended for you
                        </span>

                        <h3>${escapeHTML(course.title)}</h3>

                        <p>
                            ${escapeHTML(
                                course.description ||
                                "Build your medical knowledge with this course."
                            )}
                        </p>

                        <button
                            type="button"
                            class="recommendation-button"
                            data-recommendation-course="${escapeHTML(course.id)}"
                        >
                            Start Learning
                        </button>
                    </div>
                </article>
            `;
        })
        .join("");

    recommendationsGrid
        .querySelectorAll("[data-recommendation-course]")
        .forEach(button => {
            button.addEventListener("click", () => {
                const courseId = button.dataset.recommendationCourse;

                const course = allCourses.find(
                    item => String(item.id) === String(courseId)
                );

                openCourse(course);
            });
        });
}/* =========================================================
   NOTES LOADING
========================================================= */

async function loadNotes() {
    const notesGrid = $("#notesGrid");

    if (notesGrid) {
        notesGrid.innerHTML = `
            <div class="loading-state">
                Loading notes...
            </div>
        `;
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select(`
                id,
                course,
                unit,
                file_name,
                file_url,
                created_at,
                uploaded_by,
                course_id,
                unit_id,
                published
            `)
            .eq("published", true)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error("❌ Notes loading failed:", error);

            allNotes = [];

            if (notesGrid) {
                notesGrid.innerHTML = `
                    <div class="empty-state">
                        Unable to load notes.
                    </div>
                `;
            }

            updateDashboardStatistics();
            return;
        }

        allNotes = data || [];

        console.log("📝 Notes loaded:", allNotes.length);

        renderNotesLibrary();
        updateDashboardStatistics();
    } catch (error) {
        console.error("❌ Unexpected notes loading error:", error);

        allNotes = [];

        if (notesGrid) {
            notesGrid.innerHTML = `
                <div class="empty-state">
                    An unexpected error occurred while loading notes.
                </div>
            `;
        }
    }
}

function renderNotesLibrary() {
    const notesGrid = $("#notesGrid");

    if (!notesGrid) {
        console.warn("⚠️ #notesGrid was not found.");
        return;
    }

    if (!allNotes.length) {
        notesGrid.innerHTML = `
            <div class="empty-state">
                No published notes are currently available.
            </div>
        `;

        return;
    }

    notesGrid.innerHTML = allNotes
        .map(note => {
            const noteTitle =
                note.file_name ||
                note.unit ||
                "Medical Study Note";

            const courseName =
                note.course ||
                "Mwaniki Scholars";

            const unitName =
                note.unit ||
                "Study material";

            const noteURL = note.file_url || "#";

            return `
                <article class="note-card">
                    <div class="note-card-icon">
                        📄
                    </div>

                    <div class="note-card-content">
                        <h3>${escapeHTML(noteTitle)}</h3>

                        <p>
                            ${escapeHTML(courseName)}
                        </p>

                        <span>
                            ${escapeHTML(unitName)}
                        </span>

                        ${
                            note.file_url
                                ? `
                                    <a
                                        href="${escapeHTML(noteURL)}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="note-card-button"
                                    >
                                        View Notes
                                    </a>
                                `
                                : `
                                    <span class="note-unavailable">
                                        File unavailable
                                    </span>
                                `
                        }
                    </div>
                </article>
            `;
        })
        .join("");
}

/* =========================================================
   QUIZ LOADING
========================================================= */

async function loadQuizzes() {
    try {
        const {
            data,
            error
        } = await supabase
            .from("quizzes")
            .select(`
                id,
                course_id,
                question,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                created_at,
                course,
                unit
            `)
            .order("id", {
                ascending: true
            });

        if (error) {
            console.error("❌ Quiz loading failed:", error);
            allQuizzes = [];
            updateDashboardStatistics();
            return;
        }

        allQuizzes = data || [];

        console.log(
            "📝 Quiz questions loaded:",
            allQuizzes.length
        );

        updateDashboardStatistics();
    } catch (error) {
        console.error("❌ Unexpected quiz loading error:", error);
        allQuizzes = [];
        updateDashboardStatistics();
    }
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function calculateQuizProgress() {
    const progress = readStorage("mwanikiQuizProgress", {});

    if (!progress || typeof progress !== "object") {
        return 0;
    }

    const progressValues = Object.values(progress);

    if (!progressValues.length) {
        return 0;
    }

    let completed = 0;

    progressValues.forEach(value => {
        if (typeof value === "number") {
            completed += value > 0 ? 1 : 0;
        } else if (value && typeof value === "object") {
            if (
                value.completed === true ||
                value.finished === true ||
                value.score !== undefined
            ) {
                completed += 1;
            }
        }
    });

    return Math.min(
        100,
        Math.round((completed / progressValues.length) * 100)
    );
}

function updateDashboardStatistics() {
    setCounterText("#totalCourses", allCourses.length);
    setCounterText("#totalNotes", allNotes.length);
    setCounterText("#totalQuizzes", allQuizzes.length);

    const progress = calculateQuizProgress();

    setText("#learningProgress", `${progress}%`);

    const progressBar = $("#learningProgressBar");

    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute("aria-valuenow", String(progress));
    }
}

/* Compatibility function for older dashboard calls */
function updateDashboardStats() {
    updateDashboardStatistics();
}

window.updateDashboardStats = updateDashboardStats;
window.updateDashboardStatistics = updateDashboardStatistics;

/* =========================================================
   UNIT TRACKING
========================================================= */

function mwanikiTrackUnit(
    courseId,
    unitId,
    unitTitle,
    courseTitle
) {
    const activity = readStorage(
        "mwanikiRecentActivity",
        []
    );

    const newActivity = {
        courseId,
        unitId,
        unitTitle: unitTitle || "",
        courseTitle: courseTitle || "",
        timestamp: new Date().toISOString()
    };

    const updatedActivity = [
        newActivity,
        ...(Array.isArray(activity) ? activity : [])
    ].slice(0, 20);

    writeStorage(
        "mwanikiRecentActivity",
        updatedActivity
    );

    const matchingCourse = allCourses.find(
        course => String(course.id) === String(courseId)
    );

    const fallbackCourse = normalizeCourse({
        id: courseId,
        title: courseTitle || "Selected Course"
    });

    const courseToSave =
        matchingCourse ||
        fallbackCourse;

    if (courseToSave) {
        saveLastCourse(courseToSave);
        saveRecentCourse(courseToSave);
    }

    writeStorage("mwanikiLastUnit", {
        courseId,
        unitId,
        unitTitle: unitTitle || "",
        courseTitle: courseTitle || "",
        timestamp: new Date().toISOString()
    });

    renderRecentCourse();
    renderRecommendations();
}

window.mwanikiTrackUnit = mwanikiTrackUnit;

/* =========================================================
   REFRESH BUTTONS
========================================================= */

function setupRefreshButtons() {
    const refreshCoursesButton = $("#refreshCoursesButton");
    const refreshNotesButton = $("#refreshNotesButton");

    refreshCoursesButton?.addEventListener("click", async () => {
        refreshCoursesButton.disabled = true;
        refreshCoursesButton.textContent = "Refreshing...";

        await loadCourses();

        refreshCoursesButton.disabled = false;
        refreshCoursesButton.textContent = "Refresh Courses";
    });

    refreshNotesButton?.addEventListener("click", async () => {
        refreshNotesButton.disabled = true;
        refreshNotesButton.textContent = "Refreshing...";

        await loadNotes();

        refreshNotesButton.disabled = false;
        refreshNotesButton.textContent = "Refresh Notes";
    });
}

/* =========================================================
   SAFE SEARCH SETUP
========================================================= */

function setupSearch() {
    const searchInputs = $all(
        'input[type="search"], [data-dashboard-search]'
    );

    if (!searchInputs.length) {
        return;
    }

    searchInputs.forEach(input => {
        input.addEventListener("input", () => {
            const searchTerm = input.value
                .trim()
                .toLowerCase();

            $all(".course-card, .note-card").forEach(card => {
                const cardText = card.textContent.toLowerCase();

                card.style.display =
                    !searchTerm || cardText.includes(searchTerm)
                        ? ""
                        : "none";
            });
        });
    });
}

/* =========================================================
   CLOSE PANELS WHEN CLICKING OUTSIDE
========================================================= */

function setupOutsidePanelClosing() {
    document.addEventListener("click", event => {
        const profilePanel = $("#profilePanel");
        const notificationPanel = $("#notificationPanel");

        const profileButton = $("#profileButton");
        const notificationButton = $("#notificationButton");

        if (
            profilePanel?.classList.contains("active") &&
            !profilePanel.contains(event.target) &&
            !profileButton?.contains(event.target)
        ) {
            closeProfilePanel();
        }

        if (
            notificationPanel?.classList.contains("active") &&
            !notificationPanel.contains(event.target) &&
            !notificationButton?.contains(event.target)
        ) {
            closeNotificationPanel();
        }
    });
}

/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

async function initializeDashboard() {
    if (dashboardInitializing || dashboardReady) {
        return;
    }

    dashboardInitializing = true;

    console.log("🚀 Initializing Mwaniki Scholars dashboard...");

    try {
        startDashboardClock();

        setupNavigation();
        setupNotificationPanel();
        setupProfilePanel();
        setupProfileForm();
        setupProfilePhoto();
        setupChangePassword();
        setupLogout();
        setupRefreshButtons();
        setupSearch();
        setupOutsidePanelClosing();

        currentUser = await getAuthenticatedUser();

        if (!currentUser) {
            console.warn("⚠️ No authenticated user found.");
            window.location.href = "./index.html";
            return;
        }

        console.log("🔐 Authenticated user:", currentUser.email);

        const profileLoaded = await loadStudentProfile();

        if (!profileLoaded) {
            console.warn(
                "⚠️ Student profile was not loaded, but dashboard will continue."
            );
        }

        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        renderRecentCourse();
        renderRecommendations();
        updateDashboardStatistics();

        dashboardReady = true;

        console.log("✅ Mwaniki Scholars dashboard ready");
    } catch (error) {
        console.error(
            "❌ Dashboard initialization failed:",
            error
        );
    } finally {
        dashboardInitializing = false;
    }
}

/* =========================================================
   AUTH STATE LISTENER
========================================================= */

supabase.auth.onAuthStateChange((event, session) => {
    console.log("🔐 Auth state:", event);

    if (event === "SIGNED_OUT") {
        handleSignedOut();
        return;
    }

    if (
        event === "SIGNED_IN" &&
        session?.user &&
        !dashboardReady &&
        !dashboardInitializing
    ) {
        initializeDashboard();
    }
});

/* =========================================================
   START DASHBOARD
========================================================= */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        {
            once: true
        }
    );
} else {
    initializeDashboard();
}/* =========================================================
   FINAL FIX:
   NOTIFICATION BUTTON
   PROFILE BUTTON
   PROFILE IMAGE DISPLAY
========================================================= */

function forcePanelVisibility(panel, shouldOpen) {
    if (!panel) {
        return;
    }

    if (shouldOpen) {
        panel.classList.add("active");
        panel.classList.add("open");

        panel.removeAttribute("hidden");
        panel.setAttribute("aria-hidden", "false");

        panel.style.display = "flex";
        panel.style.visibility = "visible";
        panel.style.opacity = "1";
        panel.style.pointerEvents = "auto";
        panel.style.zIndex = "9999";
    } else {
        panel.classList.remove("active");
        panel.classList.remove("open");

        panel.setAttribute("aria-hidden", "true");

        panel.style.display = "none";
        panel.style.visibility = "hidden";
        panel.style.opacity = "0";
        panel.style.pointerEvents = "none";
    }
}

function finalSetupNotificationButton() {
    const button = document.getElementById("notificationButton");
    const panel = document.getElementById("notificationPanel");
    const closeButton = document.getElementById(
        "closeNotificationPanel"
    );

    if (!button) {
        console.error("❌ #notificationButton was not found.");
        return;
    }

    if (!panel) {
        console.error("❌ #notificationPanel was not found.");
        return;
    }

    console.log("✅ Notification button connected.");

    forcePanelVisibility(panel, false);

    button.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();

        const isOpen =
            panel.classList.contains("active") ||
            panel.classList.contains("open");

        forcePanelVisibility(panel, !isOpen);

        if (!isOpen && typeof renderNotifications === "function") {
            renderNotifications();
        }
    };

    if (closeButton) {
        closeButton.onclick = function (event) {
            event.preventDefault();
            event.stopPropagation();

            forcePanelVisibility(panel, false);
        };
    }
}

function finalSetupProfileButton() {
    const button = document.getElementById("profileButton");
    const panel = document.getElementById("profilePanel");
    const closeButton = document.getElementById(
        "closeProfilePanel"
    );

    if (!button) {
        console.error("❌ #profileButton was not found.");
        return;
    }

    if (!panel) {
        console.error("❌ #profilePanel was not found.");
        return;
    }

    console.log("✅ Profile button connected.");

    forcePanelVisibility(panel, false);

    button.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();

        const isOpen =
            panel.classList.contains("active") ||
            panel.classList.contains("open");

        forcePanelVisibility(panel, !isOpen);

        if (
            !isOpen &&
            typeof renderStudentProfile === "function"
        ) {
            renderStudentProfile();
        }
    };

    if (closeButton) {
        closeButton.onclick = function (event) {
            event.preventDefault();
            event.stopPropagation();

            forcePanelVisibility(panel, false);
        };
    }
}

/* =========================================================
   PROFILE IMAGE DISPLAY
========================================================= */

function getPossibleProfileImage() {
    if (!currentStudent) {
        return "";
    }

    return (
        currentStudent.photo_url ||
        currentStudent.photo ||
        currentStudent.avatar_url ||
        currentStudent.profile_image ||
        currentStudent.image ||
        currentUser?.user_metadata?.photo_url ||
        currentUser?.user_metadata?.avatar_url ||
        currentUser?.user_metadata?.picture ||
        ""
    );
}

function createInitialsAvatar(name) {
    const safeName = String(name || "Student").trim();

    const initials = safeName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="160"
            height="160"
            viewBox="0 0 160 160"
        >
            <rect width="160" height="160" rx="80" fill="#087f73"/>
            <text
                x="80"
                y="96"
                text-anchor="middle"
                font-size="54"
                font-family="Arial, sans-serif"
                font-weight="700"
                fill="#ffffff"
            >
                ${initials || "S"}
            </text>
        </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function displayProfileImage() {
    const displayName =
        typeof getStudentDisplayName === "function"
            ? getStudentDisplayName()
            : "Student";

    const imageURL = getPossibleProfileImage();

    const headerAvatar = document.getElementById(
        "headerProfileAvatar"
    );

    const largeAvatar = document.getElementById(
        "profileLargeAvatar"
    );

    const fallbackURL = createInitialsAvatar(displayName);

    [headerAvatar, largeAvatar].forEach(image => {
        if (!image) {
            return;
        }

        image.setAttribute("alt", `${displayName} profile photo`);

        image.onerror = function () {
            this.onerror = null;
            this.src = fallbackURL;
        };

        image.src = imageURL || fallbackURL;
        image.style.display = "block";
        image.style.visibility = "visible";
        image.style.opacity = "1";
    });

    console.log(
        imageURL
            ? "✅ Student profile image displayed."
            : "ℹ️ No saved profile image found. Initials avatar displayed."
    );
}

/* =========================================================
   REPAIR PROFILE INPUTS
========================================================= */

function repairProfileFields() {
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const profilePhone = document.getElementById("profilePhone");
    const profileCourse = document.getElementById("profileCourse");
    const profileLevel = document.getElementById("profileLevel");

    if (profileName && currentStudent) {
        profileName.value =
            currentStudent.full_name ||
            getStudentDisplayName();
    }

    if (profileEmail && currentStudent) {
        profileEmail.value =
            currentStudent.email ||
            currentUser?.email ||
            "";

        profileEmail.readOnly = true;
    }

    if (profilePhone && currentStudent) {
        profilePhone.value = currentStudent.phone || "";
    }

    if (profileCourse && currentStudent) {
        profileCourse.value = currentStudent.course || "";
    }

    if (profileLevel && currentStudent) {
        profileLevel.value = currentStudent.level || "";
    }
}

/* =========================================================
   INITIALIZE THE FINAL REPAIR
========================================================= */

function initializeFinalDashboardRepair() {
    finalSetupNotificationButton();
    finalSetupProfileButton();
    displayProfileImage();
    repairProfileFields();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeFinalDashboardRepair,
        { once: true }
    );
} else {
    initializeFinalDashboardRepair();
}
