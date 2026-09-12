import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// STUDENT DASHBOARD ENGINE
// =====================================================

console.log(
    "🚀 Mwaniki Scholars Student Dashboard starting..."
);


// =====================================================
// STATE
// =====================================================

let currentUser = null;

let currentStudent = null;

let dashboardCourses = [];

let dashboardNotes = [];

let dashboardQuizCount = 0;


// =====================================================
// DOM HELPER
// =====================================================

function $(id) {

    return document.getElementById(id);

}


// =====================================================
// SAFE HTML
// =====================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// =====================================================
// SET TEXT
// =====================================================

function setText(
    id,
    value
) {

    const element = $(id);


    if (!element) {

        return;

    }


    element.textContent =
        value ?? "";

}


// =====================================================
// DATE FORMAT
// =====================================================

function formatDate(
    dateValue
) {

    if (!dateValue) {

        return "";

    }


    const date =
        new Date(dateValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


// =====================================================
// AUTHENTICATION
// =====================================================

async function loadCurrentUser() {

    console.log(
        "🔐 Checking student authentication..."
    );


    const {
        data,
        error
    } =
        await supabase.auth.getUser();


    if (error) {

        console.error(
            "❌ Supabase authentication error:",
            error
        );


        return null;

    }


    if (
        !data ||
        !data.user
    ) {

        console.warn(
            "⚠️ No authenticated user found."
        );


        return null;

    }


    currentUser =
        data.user;


    console.log(
        "✅ Authenticated user:",
        currentUser.email
    );


    return currentUser;

}


// =====================================================
// LOAD STUDENT PROFILE
// =====================================================

async function loadStudentProfile() {

    if (!currentUser) {

        return;

    }


    console.log(
        "👤 Loading student profile..."
    );


    const {
        data,
        error
    } =
        await supabase
            .from("students")
            .select(
                "id, full_name, email, phone, course, level, photo_url, created_at"
            )
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        console.warn(
            "⚠️ Student profile lookup failed:",
            error
        );


        applyBasicUserProfile();


        return;

    }


    if (!data) {

        console.warn(
            "⚠️ No student profile row found."
        );


        applyBasicUserProfile();


        return;

    }


    currentStudent =
        data;


    const studentName =
        data.full_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split("@")[0] ||
        "Student";


    const studentEmail =
        data.email ||
        currentUser.email ||
        "Not available";


    const photoUrl =
        typeof data.photo_url === "string"
            ? data.photo_url.trim()
            : "";


    updateStudentIdentity(
        studentName,
        studentEmail,
        photoUrl
    );


    setText(
        "profilePanelPhone",
        data.phone ||
        "Not available"
    );


    setText(
        "profilePanelCourse",
        data.course ||
        "Not available"
    );


    setText(
        "profilePanelLevel",
        data.level ||
        "Not available"
    );


    console.log(
        "✅ Student profile loaded:",
        data
    );

}


// =====================================================
// BASIC USER PROFILE FALLBACK
// =====================================================

function applyBasicUserProfile() {

    if (!currentUser) {

        return;

    }


    const fallbackName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split("@")[0] ||
        "Student";


    const fallbackPhoto =
        currentUser.user_metadata?.avatar_url ||
        currentUser.user_metadata?.picture ||
        "";


    updateStudentIdentity(
        fallbackName,
        currentUser.email ||
        "Not available",
        fallbackPhoto
    );


    setText(
        "profilePanelPhone",
        "Not available"
    );


    setText(
        "profilePanelCourse",
        "Not available"
    );


    setText(
        "profilePanelLevel",
        "Not available"
    );

}


// =====================================================
// UPDATE STUDENT IDENTITY
// =====================================================

function updateStudentIdentity(
    name,
    email,
    photoUrl = ""
) {

    const cleanName =
        String(
            name ||
            "Student"
        ).trim() ||
        "Student";


    const firstLetter =
        cleanName
            .charAt(0)
            .toUpperCase() ||
        "S";


    setText(
        "welcomeMessage",
        `Welcome back, ${cleanName}`
    );


    setText(
        "profileName",
        cleanName
    );


    setText(
        "profileInitial",
        firstLetter
    );


    setText(
        "profilePhotoInitial",
        firstLetter
    );


    setText(
        "profilePanelName",
        cleanName
    );


    setText(
        "profilePanelEmail",
        email ||
        "Not available"
    );


    updateProfilePhoto(
        photoUrl
    );

}


// =====================================================
// UPDATE PROFILE PHOTO
// =====================================================

function updateProfilePhoto(
    photoUrl
) {

    const headerPhoto =
        $("headerProfilePhoto");


    const headerInitial =
        $("profileInitial");


    const panelPhoto =
        $("profilePhoto");


    const panelInitial =
        $("profilePhotoInitial");


    const cleanUrl =
        typeof photoUrl === "string"
            ? photoUrl.trim()
            : "";


    // -------------------------------------------------
    // NO PHOTO
    // -------------------------------------------------

    if (!cleanUrl) {

        if (headerPhoto) {

            headerPhoto.hidden =
                true;

            headerPhoto.removeAttribute(
                "src"
            );

        }


        if (headerInitial) {

            headerInitial.hidden =
                false;

        }


        if (panelPhoto) {

            panelPhoto.hidden =
                true;

            panelPhoto.removeAttribute(
                "src"
            );

        }


        if (panelInitial) {

            panelInitial.hidden =
                false;

        }


        return;

    }


    // -------------------------------------------------
    // HEADER PHOTO
    // -------------------------------------------------

    if (headerPhoto) {

        headerPhoto.hidden =
            true;


        headerPhoto.onload =
            function () {

                headerPhoto.hidden =
                    false;


                if (headerInitial) {

                    headerInitial.hidden =
                        true;

                }

            };


        headerPhoto.onerror =
            function () {

                console.warn(
                    "⚠️ Student header profile photo could not be loaded."
                );


                headerPhoto.hidden =
                    true;


                if (headerInitial) {

                    headerInitial.hidden =
                        false;

                }

            };


        headerPhoto.src =
            cleanUrl;

    }


    // -------------------------------------------------
    // PROFILE PANEL PHOTO
    // -------------------------------------------------

    if (panelPhoto) {

        panelPhoto.hidden =
            true;


        panelPhoto.onload =
            function () {

                panelPhoto.hidden =
                    false;


                if (panelInitial) {

                    panelInitial.hidden =
                        true;

                }

            };


        panelPhoto.onerror =
            function () {

                console.warn(
                    "⚠️ Student profile photo could not be loaded."
                );


                panelPhoto.hidden =
                    true;


                if (panelInitial) {

                    panelInitial.hidden =
                        false;

                }

            };


        panelPhoto.src =
            cleanUrl;

    }

}


// =====================================================
// COURSES
// =====================================================

async function loadCourses() {

    const loading =
        $("coursesLoading");


    const errorBox =
        $("coursesError");


    const container =
        $("coursesContainer");


    if (loading) {

        loading.hidden =
            false;

    }


    if (errorBox) {

        errorBox.hidden =
            true;

        errorBox.textContent =
            "";

    }


    if (container) {

        container.innerHTML =
            "";

    }


    console.log(
        "📚 Requesting courses from Supabase..."
    );


    const {
        data,
        error
    } =
        await supabase
            .from("courses")
            .select("*")
            .order(
                "id",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "❌ Courses error:",
            error
        );


        if (loading) {

            loading.hidden =
                true;

        }


        if (errorBox) {

            errorBox.hidden =
                false;

            errorBox.textContent =
                "Unable to load courses. Please refresh and try again.";

        }


        setText(
            "totalCourses",
            "0"
        );


        return;

    }


    dashboardCourses =
        Array.isArray(data)
            ? data
            : [];


    console.log(
        `✅ Courses returned from Supabase: ${dashboardCourses.length}`
    );


    if (loading) {

        loading.hidden =
            true;

    }


    setText(
        "totalCourses",
        dashboardCourses.length
    );


    renderCourses();

}


// =====================================================
// RENDER COURSES
// =====================================================

function renderCourses() {

    const container =
        $("coursesContainer");


    if (!container) {

        return;

    }


    if (
        !dashboardCourses.length
    ) {

        container.innerHTML = `
            <div class="empty-message">
                No courses are available yet.
            </div>
        `;


        return;

    }


    container.innerHTML =
        dashboardCourses
            .map(
                course => {

                    const courseId =
                        course.id;


                    const title =
                        course.title ||
                        "Medical Course";


                    const description =
                        course.description ||
                        "Explore this medical course and its learning units.";


                    const image =
                        course.image ||
                        "";


                    return `
                        <article class="course-card">

                            <div class="course-card-image">

                                ${
                                    image
                                        ? `
                                            <img
                                                src="${escapeHTML(image)}"
                                                alt="${escapeHTML(title)}"
                                                loading="lazy"
                                            >
                                          `
                                        : `
                                            <div
                                                class="course-card-placeholder"
                                                aria-hidden="true"
                                            >
                                                📚
                                            </div>
                                          `
                                }

                            </div>


                            <div class="course-card-content">

                                <h3>
                                    ${escapeHTML(title)}
                                </h3>


                                <p>
                                    ${escapeHTML(description)}
                                </p>


                                <button
                                    type="button"
                                    class="course-open-button"
                                    data-course-id="${escapeHTML(courseId)}"
                                    data-course-title="${escapeHTML(title)}"
                                >
                                    Open Course
                                </button>

                            </div>

                        </article>
                    `;

                }
            )
            .join("");


    container
        .querySelectorAll(
            ".course-open-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openCourse(
                            button.dataset.courseId,
                            button.dataset.courseTitle
                        );

                    }
                );

            }
        );

}


// =====================================================
// OPEN COURSE
// =====================================================

function openCourse(
    courseId,
    courseTitle
) {

    if (!courseId) {

        console.error(
            "❌ Cannot open course without course ID."
        );


        return;

    }


    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );


    localStorage.setItem(
        "selectedCourseName",
        courseTitle ||
        ""
    );


    window.location.href =
        `./course.html?course_id=${encodeURIComponent(courseId)}`;

}


// =====================================================
// NOTES
// =====================================================

async function loadNotes() {

    const loading =
        $("notesLoading");


    const errorBox =
        $("notesError");


    const emptyBox =
        $("notesEmpty");


    const container =
        $("notesContainer");


    if (loading) {

        loading.hidden =
            false;

    }


    if (errorBox) {

        errorBox.hidden =
            true;

        errorBox.textContent =
            "";

    }


    if (emptyBox) {

        emptyBox.hidden =
            true;

    }


    if (container) {

        container.innerHTML =
            "";

    }


    const {
        data,
        error
    } =
        await supabase
            .from("notes")
            .select("*")
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

        console.error(
            "❌ Notes error:",
            error
        );


        if (loading) {

            loading.hidden =
                true;

        }


        if (errorBox) {

            errorBox.hidden =
                false;

            errorBox.textContent =
                "Unable to load notes. Please refresh and try again.";

        }


        setText(
            "totalNotes",
            "0"
        );


        return;

    }


    dashboardNotes =
        Array.isArray(data)
            ? data
            : [];


    if (loading) {

        loading.hidden =
            true;

    }


    setText(
        "totalNotes",
        dashboardNotes.length
    );


    renderNotes();

}


// =====================================================
// RENDER NOTES
// =====================================================

function renderNotes() {

    const container =
        $("notesContainer");


    const emptyBox =
        $("notesEmpty");


    if (!container) {

        return;

    }


    if (
        !dashboardNotes.length
    ) {

        if (emptyBox) {

            emptyBox.hidden =
                false;

        }


        return;

    }


    if (emptyBox) {

        emptyBox.hidden =
            true;

    }


    container.innerHTML =
        dashboardNotes
            .map(
                note => {

                    const fileName =
                        note.file_name ||
                        note.title ||
                        "Study Note";


                    const course =
                        note.course ||
                        note.course_name ||
                        "Medical Course";


                    const unit =
                        note.unit ||
                        note.unit_name ||
                        "";


                    const fileUrl =
                        note.file_url ||
                        "#";


                    const date =
                        formatDate(
                            note.created_at
                        );


                    return `
                        <article class="note-card">

                            <div class="note-card-icon">
                                📝
                            </div>


                            <div class="note-card-content">

                                <h3>
                                    ${escapeHTML(fileName)}
                                </h3>


                                <p>
                                    ${escapeHTML(course)}
                                </p>


                                ${
                                    unit
                                        ? `
                                            <span class="note-unit">
                                                ${escapeHTML(unit)}
                                            </span>
                                          `
                                        : ""
                                }


                                ${
                                    fileUrl !== "#"
                                        ? `
                                            <a
                                                href="${escapeHTML(fileUrl)}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="note-open-button"
                                            >
                                                Open Note
                                            </a>
                                          `
                                        : ""
                                }


                                ${
                                    date
                                        ? `
                                            <small>
                                                ${escapeHTML(date)}
                                            </small>
                                          `
                                        : ""
                                }

                            </div>

                        </article>
                    `;

                }
            )
            .join("");

}


// =====================================================
// QUIZ COUNT
// =====================================================

async function loadQuizCount() {

    const {
        count,
        error
    } =
        await supabase
            .from("quizzes")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            );


    if (error) {

        console.error(
            "❌ Quiz count error:",
            error
        );


        dashboardQuizCount =
            0;


        setText(
            "totalQuizzes",
            "0"
        );


        return;

    }


    dashboardQuizCount =
        Number(
            count || 0
        );


    setText(
        "totalQuizzes",
        dashboardQuizCount
    );

}


// =====================================================
// LEARNING PROGRESS
// =====================================================

function loadLearningProgress() {

    let completed =
        0;


    const total =
        dashboardCourses.length;


    try {

        const stored =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );


        if (stored) {

            const parsed =
                JSON.parse(
                    stored
                );


            if (
                parsed &&
                typeof parsed === "object"
            ) {

                completed =
                    Object.values(
                        parsed
                    )
                    .filter(
                        value =>
                            value === true ||
                            value === "completed" ||
                            (
                                value &&
                                typeof value === "object" &&
                                value.completed === true
                            )
                    )
                    .length;

            }

        }

    } catch (error) {

        console.warn(
            "⚠️ Unable to read learning progress:",
            error
        );

    }


    if (!total) {

        setText(
            "learningProgress",
            "0%"
        );


        return;

    }


    const percentage =
        Math.min(
            100,
            Math.round(
                (
                    completed /
                    total
                ) *
                100
            )
        );


    setText(
        "learningProgress",
        `${percentage}%`
    );

}


// =====================================================
// REFRESH COURSES
// =====================================================

function setupCourseRefresh() {

    const button =
        $("refreshCoursesButton");


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;


            button.textContent =
                "Refreshing...";


            try {

                await loadCourses();

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Refresh";

            }

        }
    );

}


// =====================================================
// REFRESH NOTES
// =====================================================

function setupNotesRefresh() {

    const button =
        $("refreshNotesButton");


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;


            button.textContent =
                "Refreshing...";


            try {

                await loadNotes();

            } finally {

                button.disabled =
                    false;


                button.textContent =
                    "Refresh";

            }

        }
    );

}


// =====================================================
// NAVIGATION
// =====================================================

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".dashboard-nav-link"
        );


    links.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    links.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    link.classList.add(
                        "active"
                    );

                }
            );

        }
    );

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


    if (
        !button ||
        !panel
    ) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            panel.hidden =
                !panel.hidden;


            const profilePanel =
                $("profilePanel");


            if (profilePanel) {

                profilePanel.hidden =
                    true;

            }

        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                panel.hidden =
                    true;

            }
        );

    }

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


    if (
        !button ||
        !panel
    ) {

        return;

    }


    button.addEventListener(
        "click",
        () => {

            panel.hidden =
                !panel.hidden;


            const notificationPanel =
                $("notificationPanel");


            if (notificationPanel) {

                notificationPanel.hidden =
                    true;

            }

        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                panel.hidden =
                    true;

            }
        );

    }

}


// =====================================================
// PROFILE EDITING
// =====================================================

function setupProfileEditing() {

    const editButton =
        $("editProfileButton");


    const modal =
        $("profileEditModal");


    const form =
        $("profileEditForm");


    const closeButton =
        $("closeProfileEditModal");


    const cancelButton =
        $("cancelProfileEdit");


    if (
        !editButton ||
        !modal ||
        !form
    ) {

        return;

    }


    editButton.addEventListener(
        "click",
        () => {

            if (!currentStudent) {

                return;

            }


            const fullNameInput =
                $("editFullName");


            const phoneInput =
                $("editPhone");


            const courseInput =
                $("editCourse");


            const levelInput =
                $("editLevel");


            if (fullNameInput) {

                fullNameInput.value =
                    currentStudent.full_name ||
                    "";

            }


            if (phoneInput) {

                phoneInput.value =
                    currentStudent.phone ||
                    "";

            }


            if (courseInput) {

                courseInput.value =
                    currentStudent.course ||
                    "";

            }


            if (levelInput) {

                levelInput.value =
                    currentStudent.level ||
                    "";

            }


            const errorBox =
                $("profileEditError");


            const successBox =
                $("profileEditSuccess");


            if (errorBox) {

                errorBox.hidden =
                    true;

                errorBox.textContent =
                    "";

            }


            if (successBox) {

                successBox.hidden =
                    true;

                successBox.textContent =
                    "";

            }


            modal.hidden =
                false;

        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            () => {

                modal.hidden =
                    true;

            }
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            () => {

                modal.hidden =
                    true;

            }
        );

    }


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                modal.hidden =
                    true;

            }

        }
    );


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (!currentUser) {

                return;

            }


            const fullName =
                $("editFullName")
                    ?.value
                    .trim() ||
                "";


            const phone =
                $("editPhone")
                    ?.value
                    .trim() ||
                "";


            const course =
                $("editCourse")
                    ?.value
                    .trim() ||
                "";


            const level =
                $("editLevel")
                    ?.value
                    .trim() ||
                "";


            const errorBox =
                $("profileEditError");


            const successBox =
                $("profileEditSuccess");


            if (!fullName) {

                if (errorBox) {

                    errorBox.hidden =
                        false;

                    errorBox.textContent =
                        "Please enter your full name.";

                }


                return;

            }


            const saveButton =
                $("saveProfileButton");


            if (saveButton) {

                saveButton.disabled =
                    true;

                saveButton.textContent =
                    "Saving...";

            }


            if (errorBox) {

                errorBox.hidden =
                    true;

            }


            if (successBox) {

                successBox.hidden =
                    true;

            }


            try {

                const {
                    data,
                    error
                } =
                    await supabase
                        .from("students")
                        .update(
                            {
                                full_name:
                                    fullName,

                                phone:
                                    phone,

                                course:
                                    course,

                                level:
                                    level
                            }
                        )
                        .eq(
                            "id",
                            currentUser.id
                        )
                        .select()
                        .single();


                if (error) {

                    throw error;

                }


                currentStudent =
                    data ||
                    {
                        ...currentStudent,

                        full_name:
                            fullName,

                        phone:
                            phone,

                        course:
                            course,

                        level:
                            level
                    };


                updateStudentIdentity(
                    currentStudent.full_name,
                    currentStudent.email ||
                    currentUser.email ||
                    "Not available",
                    currentStudent.photo_url ||
                    ""
                );


                setText(
                    "profilePanelPhone",
                    currentStudent.phone ||
                    "Not available"
                );


                setText(
                    "profilePanelCourse",
                    currentStudent.course ||
                    "Not available"
                );


                setText(
                    "profilePanelLevel",
                    currentStudent.level ||
                    "Not available"
                );


                if (successBox) {

                    successBox.hidden =
                        false;

                    successBox.textContent =
                        "Profile updated successfully.";

                }


                console.log(
                    "✅ Student profile updated."
                );


                setTimeout(
                    () => {

                        modal.hidden =
                            true;

                    },
                    900
                );

            } catch (error) {

                console.error(
                    "❌ Profile update failed:",
                    error
                );


                if (errorBox) {

                    errorBox.hidden =
                        false;

                    errorBox.textContent =
                        error.message ||
                        "Unable to update your profile.";

                }

            } finally {

                if (saveButton) {

                    saveButton.disabled =
                        false;

                    saveButton.textContent =
                        "Save Changes";

                }

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

            button.disabled =
                true;


            button.textContent =
                "Logging out...";


            const {
                error
            } =
                await supabase.auth.signOut();


            if (error) {

                console.error(
                    "❌ Logout failed:",
                    error
                );


                button.disabled =
                    false;


                button.textContent =
                    "Log Out";


                return;

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


            window.location.href =
                "./index.html";

        }
    );

}


// =====================================================
// STUDENT TUTOR BOOKING
// =====================================================

function setupStudentTutorBooking() {

    const container =
        $("tutorBookingContainer");


    if (!container) {

        return;

    }


    const bookingLink =
        container.querySelector(
            'a[href="./studentTutor.html"]'
        );


    if (!bookingLink) {

        return;

    }


    bookingLink.addEventListener(
        "click",
        event => {

            if (currentUser) {

                return;

            }


            event.preventDefault();


            window.location.href =
                "./index.html";

        }
    );

}


// =====================================================
// GLOBAL UNIT TRACKING
// =====================================================

window.mwanikiTrackUnit =
    function (
        courseId,
        unitId,
        unitTitle
    ) {

        try {

            const activity = {

                courseId:
                    courseId,

                unitId:
                    unitId,

                unitTitle:
                    unitTitle,

                timestamp:
                    new Date().toISOString()

            };


            localStorage.setItem(
                "mwanikiLastUnit",
                JSON.stringify(
                    activity
                )
            );


        } catch (error) {

            console.warn(
                "⚠️ Unable to track unit:",
                error
            );

        }

    };


// =====================================================
// GLOBAL DASHBOARD API
// =====================================================

window.mwanikiDashboard = {

    refreshCourses:
        loadCourses,

    refreshNotes:
        loadNotes,

    refreshQuizCount:
        loadQuizCount,

    refreshProgress:
        loadLearningProgress

};


// =====================================================
// INITIALIZE DASHBOARD
// =====================================================

async function initializeDashboard() {

    console.log(
        "🚀 Initializing dashboard..."
    );


    const user =
        await loadCurrentUser();


    if (!user) {

        setText(
            "welcomeMessage",
            "Welcome to Mwaniki Scholars"
        );

    } else {

        await loadStudentProfile();

    }


    await Promise.all(
        [
            loadCourses(),
            loadNotes(),
            loadQuizCount()
        ]
    );


    loadLearningProgress();


    setupCourseRefresh();

    setupNotesRefresh();

    setupNavigation();

    setupNotifications();

    setupProfilePanel();

    setupProfileEditing();

    setupLogout();

    setupStudentTutorBooking();


    console.log(
        "✅ Mwaniki Scholars dashboard ready."
    );

}


// =====================================================
// START DASHBOARD
// =====================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );

} else {

    initializeDashboard();

}
