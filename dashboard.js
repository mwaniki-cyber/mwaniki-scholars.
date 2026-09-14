import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
========================================================= */

console.log("🚀 Mwaniki Scholars dashboard engine loaded");


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let currentProfile = null;


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   HTML ESCAPE
========================================================= */

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


/* =========================================================
   SAFE TEXT
========================================================= */

function cleanText(value, fallback = "") {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        return fallback;
    }

    return String(value).trim();
}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeDashboard();

});


async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    try {

        setCurrentDate();

        await loadCurrentUser();

        await loadProfile();

        setupNavigation();

        setupPanels();

        setupProfileActions();

        setupRefreshButtons();

        setupRecentCourseButton();

        await loadDashboardData();

        updateProgress();

        loadRecommendations();

        loadRecentCourse();

        console.log(
            "✅ Mwaniki Scholars dashboard ready"
        );

    } catch (error) {

        console.error(
            "❌ Dashboard initialization failed:",
            error
        );

    }

}


/* =========================================================
   CURRENT DATE
========================================================= */

function setCurrentDate() {

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
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );
}


/* =========================================================
   LOAD CURRENT USER
========================================================= */

async function loadCurrentUser() {

    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            throw error;
        }

        currentUser = data?.user || null;

        if (!currentUser) {

            console.warn(
                "⚠️ No authenticated Supabase user found."
            );

            return;
        }

        console.log(
            "👤 Current student:",
            currentUser.email
        );

    } catch (error) {

        console.error(
            "❌ Failed to load current user:",
            error
        );

        currentUser = null;
    }
}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

    if (!currentUser) {
        setDefaultStudentName();
        return;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (error) {

            console.warn(
                "⚠️ Profile table could not be read:",
                error.message
            );

            setDefaultStudentName();

            return;
        }

        currentProfile = data || {};

        populateProfile(currentProfile);

    } catch (error) {

        console.error(
            "❌ Profile loading error:",
            error
        );

        setDefaultStudentName();

    }
}


/* =========================================================
   DEFAULT STUDENT NAME
========================================================= */

function setDefaultStudentName() {

    const name =
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        currentUser?.email?.split("@")[0] ||
        "Student";

    setStudentName(name);
}


/* =========================================================
   SET STUDENT NAME
========================================================= */

function setStudentName(name) {

    const safeName =
        cleanText(name, "Student");

    const welcomeName =
        $("welcomeName");

    const headerName =
        $("headerProfileName");

    if (welcomeName) {
        welcomeName.textContent = safeName;
    }

    if (headerName) {
        headerName.textContent = safeName;
    }

    const avatar =
        $("headerProfileAvatar");

    const largeAvatar =
        $("profileLargeAvatar");

    const initial =
        safeName
            .charAt(0)
            .toUpperCase() || "S";

    if (
        avatar &&
        !avatar.querySelector("img")
    ) {
        avatar.textContent = initial;
    }

    if (
        largeAvatar &&
        !largeAvatar.querySelector("img")
    ) {
        largeAvatar.textContent = initial;
    }
}


/* =========================================================
   POPULATE PROFILE
========================================================= */

function populateProfile(profile) {

    const metadata =
        currentUser?.user_metadata || {};

    const name =
        profile?.full_name ||
        profile?.name ||
        metadata?.full_name ||
        metadata?.name ||
        currentUser?.email?.split("@")[0] ||
        "Student";

    const email =
        currentUser?.email ||
        profile?.email ||
        "";

    setStudentName(name);

    const profileName =
        $("profileName");

    const profileEmail =
        $("profileEmail");

    const profilePhone =
        $("profilePhone");

    const profileCourse =
        $("profileCourse");

    const profileLevel =
        $("profileLevel");

    if (profileName) {
        profileName.value = name;
    }

    if (profileEmail) {
        profileEmail.value = email;
    }

    if (profilePhone) {
        profilePhone.value =
            profile?.phone ||
            profile?.phone_number ||
            "";
    }

    if (profileCourse) {
        profileCourse.value =
            profile?.course ||
            "";
    }

    if (profileLevel) {
        profileLevel.value =
            profile?.level ||
            profile?.year ||
            "";
    }

    const photo =
        profile?.avatar_url ||
        profile?.photo_url ||
        metadata?.avatar_url ||
        metadata?.picture ||
        "";

    if (photo) {
        setProfilePhoto(photo);
    }
}


/* =========================================================
   SET PROFILE PHOTO
========================================================= */

function setProfilePhoto(url) {

    if (!url) {
        return;
    }

    const headerAvatar =
        $("headerProfileAvatar");

    const largeAvatar =
        $("profileLargeAvatar");

    if (headerAvatar) {

        headerAvatar.innerHTML = `
            <img
                src="${escapeHTML(url)}"
                alt="Student profile photo"
            >
        `;

    }

    if (largeAvatar) {

        largeAvatar.innerHTML = `
            <img
                src="${escapeHTML(url)}"
                alt="Student profile photo"
            >
        `;

    }
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );

    links.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                links.forEach(item => {
                    item.classList.remove("active");
                });

                link.classList.add("active");

            }
        );

    });

}


/* =========================================================
   SIDE PANELS
========================================================= */

function setupPanels() {

    const notificationButton =
        $("notificationButton");

    const profileButton =
        $("profileButton");

    const closeNotificationPanel =
        $("closeNotificationPanel");

    const closeProfilePanel =
        $("closeProfilePanel");

    const notificationPanel =
        $("notificationPanel");

    const profilePanel =
        $("profilePanel");

    if (
        notificationButton &&
        notificationPanel
    ) {

        notificationButton.addEventListener(
            "click",
            () => {

                closePanel(profilePanel);

                openPanel(notificationPanel);

            }
        );

    }

    if (
        profileButton &&
        profilePanel
    ) {

        profileButton.addEventListener(
            "click",
            () => {

                closePanel(notificationPanel);

                openPanel(profilePanel);

            }
        );

    }

    if (
        closeNotificationPanel &&
        notificationPanel
    ) {

        closeNotificationPanel.addEventListener(
            "click",
            () => {
                closePanel(notificationPanel);
            }
        );

    }

    if (
        closeProfilePanel &&
        profilePanel
    ) {

        closeProfilePanel.addEventListener(
            "click",
            () => {
                closePanel(profilePanel);
            }
        );

    }

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closePanel(notificationPanel);
                closePanel(profilePanel);

            }

        }
    );

}


function openPanel(panel) {

    if (!panel) {
        return;
    }

    panel.classList.add("open");

    document.body.classList.add("panel-open");

}


function closePanel(panel) {

    if (!panel) {
        return;
    }

    panel.classList.remove("open");

    const openPanels =
        document.querySelectorAll(
            ".side-panel.open"
        );

    if (!openPanels.length) {
        document.body.classList.remove(
            "panel-open"
        );
    }

}


/* =========================================================
   PROFILE ACTIONS
========================================================= */

function setupProfileActions() {

    const saveButton =
        $("saveProfileButton");

    const logoutButton =
        $("logoutButton");

    const changePasswordButton =
        $("changePasswordButton");

    const photoInput =
        $("profilePhotoInput");

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveProfile
        );

    }

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            signOut
        );

    }

    if (changePasswordButton) {

        changePasswordButton.addEventListener(
            "click",
            changePassword
        );

    }

    if (photoInput) {

        photoInput.addEventListener(
            "change",
            handleProfilePhoto
        );

    }

}


/* =========================================================
   SAVE PROFILE
========================================================= */

async function saveProfile() {

    const status =
        $("profileSaveStatus");

    if (!currentUser) {

        showProfileStatus(
            "No signed-in student account was found.",
            "error"
        );

        return;
    }

    const name =
        $("profileName")?.value?.trim() || "";

    const phone =
        $("profilePhone")?.value?.trim() || "";

    const course =
        $("profileCourse")?.value?.trim() || "";

    const level =
        $("profileLevel")?.value?.trim() || "";

    showProfileStatus(
        "Saving profile...",
        ""
    );

    try {

        const payload = {
            id: currentUser.id,
            full_name: name,
            phone,
            course,
            level,
            updated_at: new Date().toISOString()
        };

        const {
            error
        } = await supabase
            .from("profiles")
            .upsert(
                payload,
                {
                    onConflict: "id"
                }
            );

        if (error) {
            throw error;
        }

        currentProfile = {
            ...currentProfile,
            ...payload
        };

        setStudentName(
            name || "Student"
        );

        showProfileStatus(
            "Profile saved successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "❌ Profile save failed:",
            error
        );

        showProfileStatus(
            "Could not save the profile. Check your Supabase profile policy/table.",
            "error"
        );

    }

}


/* =========================================================
   PROFILE STATUS
========================================================= */

function showProfileStatus(
    message,
    type = ""
) {

    const status =
        $("profileSaveStatus");

    if (!status) {
        return;
    }

    status.textContent = message;

    status.className =
        "profile-save-status";

    if (type) {
        status.classList.add(type);
    }

}


/* =========================================================
   CHANGE PASSWORD
========================================================= */

async function changePassword() {

    if (!currentUser?.email) {
        return;
    }

    const {
        error
    } = await supabase.auth.resetPasswordForEmail(
        currentUser.email
    );

    if (error) {

        showProfileStatus(
            "Could not send the password reset email.",
            "error"
        );

        console.error(error);

        return;
    }

    showProfileStatus(
        "A password reset email has been sent to your email address.",
        "success"
    );

}


/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {

    try {

        const {
            error
        } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href =
            "./index.html";

    } catch (error) {

        console.error(
            "❌ Sign out failed:",
            error
        );

        alert(
            "Unable to sign out right now."
        );

    }

}


/* =========================================================
   PROFILE PHOTO
========================================================= */

async function handleProfilePhoto(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (
        !file.type.startsWith("image/")
    ) {

        showProfileStatus(
            "Please select an image file.",
            "error"
        );

        return;
    }

    if (
        file.size >
        5 * 1024 * 1024
    ) {

        showProfileStatus(
            "The image must be 5 MB or smaller.",
            "error"
        );

        return;
    }

    const reader =
        new FileReader();

    reader.onload = () => {

        setProfilePhoto(
            reader.result
        );

    };

    reader.readAsDataURL(file);

    showProfileStatus(
        "Photo preview updated. Save the profile to persist other profile changes.",
        "success"
    );

}


/* =========================================================
   REFRESH BUTTONS
========================================================= */

function setupRefreshButtons() {

    const refreshCoursesButton =
        $("refreshCoursesButton");

    const refreshNotesButton =
        $("refreshNotesButton");

    if (refreshCoursesButton) {

        refreshCoursesButton.addEventListener(
            "click",
            async () => {

                refreshCoursesButton.disabled =
                    true;

                refreshCoursesButton.textContent =
                    "Refreshing...";

                await loadCourses();

                refreshCoursesButton.disabled =
                    false;

                refreshCoursesButton.textContent =
                    "Refresh";

            }
        );

    }

    if (refreshNotesButton) {

        refreshNotesButton.addEventListener(
            "click",
            async () => {

                refreshNotesButton.disabled =
                    true;

                refreshNotesButton.textContent =
                    "Refreshing...";

                await loadNotes();

                refreshNotesButton.disabled =
                    false;

                refreshNotesButton.textContent =
                    "Refresh";

            }
        );

    }

}


/* =========================================================
   RECENT COURSE BUTTON
========================================================= */

function setupRecentCourseButton() {

    const button =
        $("recentCourseButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            const recentCourse =
                getRecentCourse();

            if (recentCourse) {

                openCourse(recentCourse);

            } else {

                document
                    .getElementById("courses")
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });

            }

        }
    );

}


/* =========================================================
   LOAD ALL DASHBOARD DATA
========================================================= */

async function loadDashboardData() {

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizzes()
    ]);

}


/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCourses() {

    const area =
        $("courseGrid");

    if (!area) {

        console.error(
            "❌ #courseGrid was not found."
        );

        return;
    }

    area.innerHTML = `
        <div class="loading-state">
            Loading courses...
        </div>
    `;

    try {

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select(
                "id,title,description,image,created_at"
            )
            .order(
                "id",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        allCourses =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            "📚 Courses loaded:",
            allCourses.length
        );

        renderCourses();

        updateCourseCount();

    } catch (error) {

        console.error(
            "❌ Failed to load courses:",
            error
        );

        allCourses = [];

        area.innerHTML = `
            <div class="loading-state">

                <strong>
                    Unable to load courses.
                </strong>

                <span>
                    Please try the Refresh button.
                </span>

            </div>
        `;

    }

}


/* =========================================================
   RENDER COURSES
========================================================= */

function renderCourses() {

    const area =
        $("courseGrid");

    if (!area) {

        console.error(
            "❌ courseGrid was not found."
        );

        return;
    }

    if (!allCourses.length) {

        area.innerHTML = `
            <div class="loading-state">

                <strong>
                    No courses available.
                </strong>

                <span>
                    Courses will appear here when
                    they are available.
                </span>

            </div>
        `;

        return;
    }

    /*
     * IMPORTANT:
     *
     * #courseGrid is already the CSS grid.
     * Cards are inserted directly into it.
     *
     * DO NOT create another .course-grid here.
     */

    area.innerHTML =
        allCourses
            .map(createCourseCard)
            .join("");

    area
        .querySelectorAll(
            ".course-card-button[data-course-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        Number(
                            button.dataset.courseId
                        );

                    const course =
                        allCourses.find(
                            item =>
                                Number(item.id) === id
                        );

                    if (course) {
                        openCourse(course);
                    }

                }
            );

        });

}


/* =========================================================
   COURSE IMAGE
========================================================= */

function getCourseImage(course) {

    const image =
        cleanText(
            course?.image,
            ""
        );

    if (!image) {
        return "";
    }

    return image;
}


/* =========================================================
   CREATE COURSE CARD
   NO EMOJIS IN COURSE DISPLAY
========================================================= */

function createCourseCard(course) {

    const courseId =
        course?.id ?? "";

    const title =
        cleanText(
            course?.title,
            "Untitled Course"
        );

    const description =
        cleanText(
            course?.description,
            "Explore units, notes and quizzes for this course."
        );

    const image =
        getCourseImage(course);

    return `
        <article
            class="course-card"
            data-course-id="${escapeHTML(courseId)}"
        >

            <div class="course-card-image">

                ${
                    image
                        ? `
                            <img
                                src="${escapeHTML(image)}"
                                alt="${escapeHTML(title)}"
                                loading="lazy"
                                onerror="
                                    this.style.display='none';
                                    this.parentElement.classList.add('no-image');
                                "
                            >
                        `
                        : `
                            <div
                                class="course-card-placeholder"
                                aria-hidden="true"
                            ></div>
                        `
                }

            </div>

            <div
                class="course-card-content"
            >

                <h3 class="course-card-title">
                    ${escapeHTML(title)}
                </h3>

                <p class="course-card-description">
                    ${escapeHTML(description)}
                </p>

                <button
                    type="button"
                    class="primary-button course-card-button"
                    data-course-id="${escapeHTML(courseId)}"
                >
                    View Course
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   OPEN COURSE
========================================================= */

function openCourse(course) {

    if (!course?.id) {
        return;
    }

    const courseId =
        Number(course.id);

    const courseTitle =
        cleanText(
            course.title,
            "Course"
        );

    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );

    localStorage.setItem(
        "selectedCourseName",
        courseTitle
    );

    localStorage.setItem(
        "recentCourse",
        JSON.stringify(course)
    );

    console.log(
        "📖 Opening course:",
        courseId,
        courseTitle
    );

    window.location.href =
        `./course.html?id=${encodeURIComponent(courseId)}`;

}


/* =========================================================
   LOAD NOTES
========================================================= */

async function loadNotes() {

    const area =
        $("notesGrid");

    if (!area) {

        console.error(
            "❌ #notesGrid was not found."
        );

        return;
    }

    area.innerHTML = `
        <div class="loading-state">
            Loading notes...
        </div>
    `;

    try {

        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select(
                "id,course,unit,file_name,file_url,created_at,course_id,unit_id,published"
            )
            .eq(
                "published",
                true
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        allNotes =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            "📚 Notes loaded:",
            allNotes.length
        );

        renderNotes();

        updateNotesCount();

    } catch (error) {

        console.error(
            "❌ Failed to load notes:",
            error
        );

        allNotes = [];

        area.innerHTML = `
            <div class="loading-state">

                <strong>
                    Unable to load notes.
                </strong>

                <span>
                    Please try the Refresh button.
                </span>

            </div>
        `;

    }

}


/* =========================================================
   RENDER NOTES
========================================================= */

function renderNotes() {

    const area =
        $("notesGrid");

    if (!area) {

        console.error(
            "❌ notesGrid was not found."
        );

        return;
    }

    if (!allNotes.length) {

        area.innerHTML = `
            <div class="loading-state">

                <strong>
                    No published notes yet.
                </strong>

                <span>
                    Published Mwaniki Scholars
                    study materials will appear here.
                </span>

            </div>
        `;

        return;
    }

    area.innerHTML =
        allNotes
            .map(createNoteCard)
            .join("");

}


/* =========================================================
   CREATE NOTE CARD
========================================================= */

function createNoteCard(note) {

    const course =
        cleanText(
            note?.course,
            "Medical Studies"
        );

    const unit =
        cleanText(
            note?.unit,
            "Study Note"
        );

    const fileName =
        cleanText(
            note?.file_name,
            `${unit} Notes`
        );

    const fileUrl =
        cleanText(
            note?.file_url,
            ""
        );

    return `
        <article class="note-card">

            <h3>
                ${escapeHTML(fileName)}
            </h3>

            <p>
                ${escapeHTML(course)}
                ${
                    unit
                        ? ` • ${escapeHTML(unit)}`
                        : ""
                }
            </p>

            ${
                fileUrl
                    ? `
                        <div
                            style="
                                margin-top:14px;
                            "
                        >

                            <a
                                href="${escapeHTML(fileUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="secondary-button"
                            >
                                Open Notes
                            </a>

                        </div>
                    `
                    : `
                        <div
                            style="
                                margin-top:14px;
                                color:var(--muted);
                                font-size:11px;
                            "
                        >
                            Notes file unavailable.
                        </div>
                    `
            }

        </article>
    `;
}


/* =========================================================
   LOAD QUIZZES
========================================================= */

async function loadQuizzes() {

    try {

        const {
            data,
            error
        } = await supabase
            .from("quizzes")
            .select(
                "id,course_id,question,option_a,option_b,option_c,option_d,correct_answer,created_at,course,unit"
            )
            .order(
                "id",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        allQuizzes =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            "📝 Quiz questions loaded:",
            allQuizzes.length
        );

        updateQuizCount();

    } catch (error) {

        console.error(
            "❌ Failed to load quizzes:",
            error
        );

        allQuizzes = [];

        updateQuizCount();

    }

}


/* =========================================================
   UPDATE COURSE COUNT
========================================================= */

function updateCourseCount() {

    const element =
        $("totalCourses");

    if (element) {
        element.textContent =
            allCourses.length;
    }

}


/* =========================================================
   UPDATE NOTES COUNT
========================================================= */

function updateNotesCount() {

    const element =
        $("totalNotes");

    if (element) {
        element.textContent =
            allNotes.length;
    }

}


/* =========================================================
   UPDATE QUIZ COUNT
========================================================= */

function updateQuizCount() {

    const element =
        $("totalQuizzes");

    if (element) {
        element.textContent =
            allQuizzes.length;
    }

}


/* =========================================================
   UPDATE PROGRESS
========================================================= */

function updateProgress() {

    const progressElement =
        $("learningProgress");

    const progressBar =
        $("learningProgressBar");

    let progress = 0;

    try {

        const raw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );

        if (raw) {

            const saved =
                JSON.parse(raw);

            if (
                typeof saved === "number"
            ) {

                progress =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            saved
                        )
                    );

            }

        }

    } catch (error) {

        console.warn(
            "⚠️ Could not read quiz progress.",
            error
        );

    }

    if (progressElement) {

        progressElement.textContent =
            `${Math.round(progress)}%`;

    }

    if (progressBar) {

        progressBar.style.width =
            `${progress}%`;

    }

}


/* =========================================================
   RECOMMENDATIONS
   NO EMOJIS IN COURSE DISPLAY
========================================================= */

function loadRecommendations() {

    const area =
        $("recommendationsGrid");

    if (!area) {
        return;
    }

    if (!allCourses.length) {

        area.innerHTML = `
            <div class="loading-state">
                No recommendations available yet.
            </div>
        `;

        return;
    }

    const recommendations =
        allCourses.slice(0, 3);

    area.innerHTML =
        recommendations
            .map(course => {

                const image =
                    getCourseImage(course);

                const title =
                    cleanText(
                        course?.title,
                        "Untitled Course"
                    );

                const description =
                    cleanText(
                        course?.description,
                        "Explore this medical course."
                    );

                return `
                    <article
                        class="course-card"
                        data-course-id="${escapeHTML(course.id)}"
                    >

                        <div class="course-card-image">

                            ${
                                image
                                    ? `
                                        <img
                                            src="${escapeHTML(image)}"
                                            alt="${escapeHTML(title)}"
                                            loading="lazy"
                                            onerror="
                                                this.style.display='none';
                                                this.parentElement.classList.add('no-image');
                                            "
                                        >
                                    `
                                    : `
                                        <div
                                            class="course-card-placeholder"
                                            aria-hidden="true"
                                        ></div>
                                    `
                            }

                        </div>

                        <div
                            class="course-card-content"
                        >

                            <h3 class="course-card-title">
                                ${escapeHTML(title)}
                            </h3>

                            <p class="course-card-description">
                                ${escapeHTML(description)}
                            </p>

                            <button
                                type="button"
                                class="primary-button course-card-button"
                                data-recommended-course-id="${escapeHTML(course.id)}"
                            >
                                Start Learning
                            </button>

                        </div>

                    </article>
                `;

            })
            .join("");

    area
        .querySelectorAll(
            "[data-recommended-course-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        Number(
                            button.dataset
                                .recommendedCourseId
                        );

                    const course =
                        allCourses.find(
                            item =>
                                Number(item.id) === id
                        );

                    if (course) {
                        openCourse(course);
                    }

                }
            );

        });

}


/* =========================================================
   RECENT COURSE
========================================================= */

function getRecentCourse() {

    try {

        const raw =
            localStorage.getItem(
                "recentCourse"
            );

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);

    } catch (error) {

        console.warn(
            "⚠️ Invalid recent course data.",
            error
        );

        return null;

    }

}


function loadRecentCourse() {

    const title =
        $("recentCourseTitle");

    const description =
        $("recentCourseDescription");

    const image =
        $("recentCourseImage");

    const placeholder =
        $("recentCourseImagePlaceholder");

    const button =
        $("recentCourseButton");

    const recentCourse =
        getRecentCourse();

    if (!recentCourse) {

        if (title) {
            title.textContent =
                "No recent course";
        }

        if (description) {

            description.textContent =
                "Choose a course from the library to begin learning.";

        }

        if (button) {

            button.textContent =
                "Explore Courses";

        }

        if (image) {
            image.hidden = true;
        }

        if (placeholder) {

            placeholder.style.width =
                "100%";

            placeholder.style.height =
                "100%";

            placeholder.style.minHeight =
                "220px";

        }

        return;
    }

    if (title) {

        title.textContent =
            cleanText(
                recentCourse.title,
                "Recent Course"
            );

    }

    if (description) {

        description.textContent =
            cleanText(
                recentCourse.description,
                "Continue studying this course."
            );

    }

    if (button) {

        button.textContent =
            "Continue Course";

    }

    const courseImage =
        getCourseImage(
            recentCourse
        );

    if (
        courseImage &&
        image
    ) {

        image.src =
            courseImage;

        image.alt =
            cleanText(
                recentCourse.title,
                "Recent course"
            );

        image.hidden =
            false;

        if (placeholder) {
            placeholder.style.display =
                "none";
        }

    } else {

        if (image) {
            image.hidden = true;
        }

        if (placeholder) {

            placeholder.style.display =
                "block";

            placeholder.style.width =
                "100%";

            placeholder.style.height =
                "100%";

            placeholder.style.minHeight =
                "220px";

        }

    }

}


/* =========================================================
   AUTH STATE
========================================================= */

supabase.auth.onAuthStateChange(
    (event, session) => {

        console.log(
            "🔐 Auth state:",
            event
        );

        if (
            event === "SIGNED_OUT"
        ) {

            currentUser = null;

        }

        if (
            event === "SIGNED_IN" &&
            session?.user
        ) {

            currentUser =
                session.user;

        }

    }
);


/* =========================================================
   PROFILE PHOTO INPUT
========================================================= */

const profilePhotoInput =
    $("profilePhotoInput");

if (profilePhotoInput) {

    profilePhotoInput.addEventListener(
        "change",
        handleProfilePhoto
    );

}


/* =========================================================
   GLOBAL ERROR LOGGING
========================================================= */

window.addEventListener(
    "error",
    event => {

        console.error(
            "❌ Dashboard JavaScript error:",
            event.error || event.message
        );

    }
);


window.addEventListener(
    "unhandledrejection",
    event => {

        console.error(
            "❌ Dashboard promise error:",
            event.reason
        );

    }
);


console.log(
    "✅ Mwaniki Scholars dashboard script loaded successfully"
);
