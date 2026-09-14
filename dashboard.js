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
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;

/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

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

function getInitials(name) {
    const cleanName =
        String(name || "Student")
            .trim()
            .replace(/\s+/g, " ");

    if (!cleanName) {
        return "S";
    }

    const parts = cleanName.split(" ");

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

function showMessage(
    message,
    type = "info"
) {
    let box = $("dashboardMessage");

    if (!box) {
        box = document.createElement("div");

        box.id = "dashboardMessage";

        box.style.position = "fixed";
        box.style.right = "20px";
        box.style.bottom = "20px";
        box.style.zIndex = "99999";
        box.style.maxWidth = "420px";
        box.style.padding = "14px 18px";
        box.style.borderRadius = "12px";
        box.style.background = "#062b49";
        box.style.color = "#ffffff";
        box.style.boxShadow =
            "0 10px 30px rgba(0,0,0,.2)";
        box.style.fontSize = "14px";
        box.style.lineHeight = "1.5";

        document.body.appendChild(box);
    }

    box.textContent = message;
    box.dataset.type = type;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        box.remove();
    }, 4000);
}

/* =========================================================
   COUNTER HELPERS
========================================================= */

function setCounterText(ids, value) {
    ids.forEach(id => {
        const element = $(id);

        if (element) {
            element.textContent = String(value);
        }
    });
}

function updateNotesCounters() {
    const count = allNotes.length;

    setCounterText(
        [
            "totalNotes",
            "notesCount",
            "notesAvailable"
        ],
        count
    );
}

function updateQuizCounters() {
    const count = allQuizzes.length;

    setCounterText(
        [
            "quizzesAttempted",
            "totalQuizzes",
            "quizCount",
            "quizzesCount"
        ],
        count
    );
}


/* =========================================================
MWANIKI SCHOLARS
LIVE DATE AND TIME
========================================================= */

function updateCurrentDate() {

    const element =
        $("currentDate") ||
        $("dashboardDate") ||
        document.querySelector(".dashboard-date");

    if (!element) {
        return;
    }

    const now = new Date();

    const datePart =
        now.toLocaleDateString(
            "en-KE",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    const timePart =
        now.toLocaleTimeString(
            "en-KE",
            {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }
        );

    element.textContent =
        `${datePart} • ${timePart}`;
}


/* =========================================================
START LIVE DASHBOARD CLOCK
========================================================= */

function startDashboardClock() {

    updateCurrentDate();

    if (window.mwanikiDashboardClock) {

        clearInterval(
            window.mwanikiDashboardClock
        );
    }

    window.mwanikiDashboardClock =
        setInterval(
            updateCurrentDate,
            1000
        );
}

/* =========================================================
   STUDENT IDENTITY
========================================================= */

function getStudentName() {
    return (
        currentStudent?.full_name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        currentUser?.email ||
        "Student"
    );
}

function updateStudentIdentity() {
    const studentName =
        getStudentName();

    const headerName =
        $("headerProfileName");

    if (headerName) {
        headerName.textContent =
            studentName;
    }

    const heroName =
        $("welcomeName");

    if (heroName) {
        heroName.textContent =
            studentName;
    }

    const studentNameInput =
        $("studentName");

    if (studentNameInput) {
        studentNameInput.value =
            studentName;
    }

    const studentEmailInput =
        $("studentEmail");

    if (studentEmailInput) {
        studentEmailInput.value =
            currentStudent?.email ||
            currentUser?.email ||
            "";
    }
}

/* =========================================================
   STUDENT PHOTO
========================================================= */

function renderProfileImage(
    imageElement,
    fallbackElement,
    photoURL,
    studentName
) {
    if (!imageElement) {
        return;
    }

    if (!photoURL) {
        imageElement.style.display =
            "none";

        if (fallbackElement) {
            fallbackElement.style.display =
                "flex";

            fallbackElement.textContent =
                getInitials(studentName);
        }

        return;
    }

    imageElement.src =
        photoURL;

    imageElement.alt =
        `${studentName} profile photo`;

    imageElement.style.display =
        "block";

    if (fallbackElement) {
        fallbackElement.style.display =
            "none";
    }

    imageElement.onerror =
        () => {
            imageElement.style.display =
                "none";

            if (fallbackElement) {
                fallbackElement.style.display =
                    "flex";

                fallbackElement.textContent =
                    getInitials(studentName);
            }
        };
}

function updateStudentPhoto() {
    const studentName =
        getStudentName();

    const photoURL =
        currentStudent?.photo_url ||
        "";

    renderProfileImage(
        $("dashboardProfilePhoto"),
        null,
        photoURL,
        studentName
    );

    renderProfileImage(
        $("dashboardHeroProfilePhoto"),
        $("dashboardHeroFallback"),
        photoURL,
        studentName
    );
}

/* =========================================================
   LOAD STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {
    try {
        const {
            data: authData,
            error: authError
        } =
            await supabase.auth.getUser();

        if (authError) {
            console.error(
                "Authentication error:",
                authError
            );
        }

        currentUser =
            authData?.user || null;

        if (!currentUser) {
            window.location.href =
                "./index.html";

            return false;
        }

        const {
            data,
            error
        } =
            await supabase
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
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();

        if (error) {
            console.error(
                "Student profile error:",
                error
            );

            currentStudent = null;
        } else {
            currentStudent =
                data || null;
        }

        updateStudentIdentity();
        updateStudentPhoto();

        return true;

    } catch (error) {
        console.error(
            "loadStudentProfile failed:",
            error
        );

        return false;
    }
}

/* =========================================================
   COURSE IMAGE
========================================================= */

function getCourseImage(course) {
    const image =
        course?.image || "";

    if (
        typeof image !== "string" ||
        !image.trim()
    ) {
        return "";
    }

    return image.trim();
}

/* =========================================================
   COURSE URL
========================================================= */

function getCourseURL(course) {
    if (
        !course ||
        course.id === null ||
        course.id === undefined
    ) {
        return "./course.html";
    }

    return (
        `./course.html?course_id=` +
        encodeURIComponent(course.id)
    );
}



/* =========================================================
   OPEN COURSE
========================================================= */

function openCourse(course) {
    if (!course) {
        return;
    }

    const cleanCourse = {
        id: course.id,
        title: course.title || "Untitled Course",
        description: course.description || "",
        image: course.image || "",
        created_at: course.created_at || null
    };

    localStorage.setItem(
        "selectedCourse",
        String(cleanCourse.id)
    );

    localStorage.setItem(
        "selectedCourseName",
        cleanCourse.title
    );

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify(cleanCourse)
    );

    /* Save the last five courses */
    let recentCourses = [];

    try {
        const saved =
            localStorage.getItem("mwanikiRecentCourses");

        recentCourses = saved
            ? JSON.parse(saved)
            : [];
    } catch {
        recentCourses = [];
    }

    if (!Array.isArray(recentCourses)) {
        recentCourses = [];
    }

    recentCourses = [
        cleanCourse,
        ...recentCourses.filter(course =>
            String(course.id) !== String(cleanCourse.id)
        )
    ].slice(0, 5);

    localStorage.setItem(
        "mwanikiRecentCourses",
        JSON.stringify(recentCourses)
    );

    window.location.href =
        getCourseURL(cleanCourse);
}

/* =========================================================
   COURSE CARD
========================================================= */

function createCourseCard(course) {
    const courseId =
        course?.id ?? "";

    const title =
        course?.title ||
        "Untitled Course";

    const description =
        course?.description ||
        "Explore units, notes and quizzes for this course.";

    const image =
        getCourseImage(course);

    const visual = image
        ? `
            <div class="course-card-image">
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(title)}"
                    loading="lazy"
                    onerror="this.style.display='none'; this.parentElement.classList.add('no-image');"
                >
            </div>
        `
        : `
            <div class="course-card-image no-image" aria-hidden="true">
                <div class="course-card-placeholder">
                    <span class="course-placeholder-label">
                        ${escapeHTML(title)}
                    </span>
                </div>
            </div>
        `;

    return `
        <article
            class="course-card"
            data-course-id="${escapeHTML(courseId)}"
        >
            ${visual}

            <div class="course-card-content">

                <h3>
                    ${escapeHTML(title)}
                </h3>

                <p>
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
   RENDER COURSES
========================================================= */

function renderCourses() {
    const area =
        $("courseGrid");

    if (!area) {
        return;
    }

    if (!allCourses.length) {
        area.innerHTML = `
            <div class="empty-state">
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
                                Number(item.id) ===
                                id
                        );

                    if (course) {
                        openCourse(course);
                    }
                }
            );

        });
}

/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCourses() {

    const area =
        $("courseGrid");

    if (area) {
        area.innerHTML = `
            <div class="loading-state">
                Loading courses...
            </div>
        `;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from("courses")
                .select(`
                    id,
                    title,
                    description,
                    image,
                    created_at
                `)
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.error(
                "Courses loading error:",
                error
            );

            allCourses = [];

            if (area) {
                area.innerHTML = `
                    <div class="empty-state">
                        Unable to load courses.
                        Please refresh and try again.
                    </div>
                `;
            }

            return;
        }

        allCourses =
            Array.isArray(data)
                ? data
                : [];

        const totalCourses =
            $("totalCourses");

        if (totalCourses) {
            totalCourses.textContent =
                allCourses.length;
        }

        renderCourses();
        renderRecommendedLesson();
        renderContinueLearning();
        renderCourseProgress();

    } catch (error) {

        console.error(
            "loadCourses failed:",
            error
        );

        allCourses = [];

        if (area) {
            area.innerHTML = `
                <div class="empty-state">
                    Unable to load courses.
                </div>
            `;
        }
    }
}
/* =========================================================
   CONTINUE LEARNING
========================================================= */

function getLastCourse() {
    try {
        const saved =
            localStorage.getItem(
                "mwanikiLastCourse"
            );

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);

    } catch (error) {
        console.warn(
            "Unable to read last course:",
            error
        );

        return null;
    }
}

function renderContinueLearning() {
    const container =
        $("continueLearning");

    if (!container) {
        return;
    }

    const course =
        getLastCourse();

    if (!course) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>
                    Start your learning journey
                </strong>

                <span>
                    Choose a course from the
                    Course Library below.
                </span>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="continue-course-card">

            <div class="continue-course-icon">
                ${
                    course.image
                        ? `
                            <img
                                src="${escapeHTML(course.image)}"
                                alt="${escapeHTML(course.title || "Course")}"
                            >
                        `
                        : `
                            <span>
                                📚
                            </span>
                        `
                }
            </div>

            <div class="continue-course-info">

                <span class="continue-label">
                    Continue Learning
                </span>

                <h3>
                    ${escapeHTML(
                        course.title ||
                        "Selected Course"
                    )}
                </h3>

                <p>
                    ${
                        escapeHTML(
                            course.description ||
                            "Continue studying this course."
                        )
                    }
                </p>

            </div>

            <button
                type="button"
                class="primary-button"
                id="continueCourseButton"
            >
                Continue
            </button>

        </div>
    `;

    const button =
        $("continueCourseButton");

    if (button) {
        button.addEventListener(
            "click",
            () => {
                openCourse(course);
            }
        );
    }
}

/* =========================================================
   RECOMMENDED LESSON
========================================================= */


/* =========================================================
MWANIKI SCHOLARS
RECOMMENDATION ENGINE
========================================================= */

function renderRecommendedLesson() {

    const container =
        $("recommendedLesson");

    if (!container) {
        return;
    }


    /* -----------------------------------------------------
       NO COURSES
    ----------------------------------------------------- */

    if (
        !Array.isArray(allCourses) ||
        !allCourses.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    🎓
                </div>

                <h3>
                    Recommendations will appear here
                </h3>

                <p>
                    Courses will be recommended once
                    your course library is available.
                </p>

            </div>

        `;

        return;
    }


    /* -----------------------------------------------------
       DETERMINE LAST COURSE
    ----------------------------------------------------- */

    const lastCourse =
        getLastCourse();


    /* -----------------------------------------------------
       FIND A DIFFERENT COURSE
    ----------------------------------------------------- */

    let recommendedCourse =
        allCourses.find(
            course =>
                !lastCourse ||
                String(course.id) !==
                String(lastCourse.id)
        );


    /* -----------------------------------------------------
       FALLBACK
    ----------------------------------------------------- */

    if (!recommendedCourse) {

        recommendedCourse =
            allCourses[0];
    }


    if (!recommendedCourse) {
        return;
    }


    /* -----------------------------------------------------
       RENDER RECOMMENDATION
    ----------------------------------------------------- */

    container.innerHTML = `

        <div class="recommended-card">

            <div class="recommended-icon">

                ${
                    recommendedCourse.image

                        ? `
                            <img
                                src="${escapeHTML(
                                    recommendedCourse.image
                                )}"
                                alt="${escapeHTML(
                                    recommendedCourse.title ||
                                    "Recommended Course"
                                )}"
                                loading="lazy"
                            >
                        `

                        : `
                            <span>
                                🎓
                            </span>
                        `
                }

            </div>


            <div class="recommended-content">

                <span class="recommended-label">
                    Recommended For You
                </span>

                <h3>
                    ${escapeHTML(
                        recommendedCourse.title ||
                        "Start Learning"
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        recommendedCourse.description ||
                        "Explore this medical course and continue building your knowledge."
                    )}
                </p>

            </div>


            <button
                type="button"
                class="primary-button"
                id="recommendedCourseButton"
            >
                Explore Course
            </button>

        </div>

    `;


    const button =
        $("recommendedCourseButton");


    if (button) {

        button.addEventListener(
            "click",
            () => {

                openCourse(
                    recommendedCourse
                );

            }
        );
    }
}

/* =========================================================
   COURSE SEARCH
========================================================= */

function filterCourses(searchTerm) {
    const term =
        String(searchTerm || "")
            .trim()
            .toLowerCase();

    const cards =
        document.querySelectorAll(
            ".course-card"
        );

    if (!cards.length) {
        return;
    }

    cards.forEach(card => {

        const courseId =
            Number(
                card.dataset.courseId
            );

        const course =
            allCourses.find(
                item =>
                    Number(item.id) ===
                    courseId
            );

        if (!course) {
            return;
        }

        const searchableText =
            [
                course.title,
                course.description
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

        const matches =
            !term ||
            searchableText.includes(term);

        card.style.display =
            matches
                ? ""
                : "none";
    });
}

function setupCourseSearch() {
    const inputs =
        document.querySelectorAll(
            "#courseSearch, #searchCourses, [data-course-search]"
        );

    inputs.forEach(input => {

        input.addEventListener(
            "input",
            event => {
                filterCourses(
                    event.target.value
                );
            }
        );

    });
}

/* =========================================================
   NOTES
========================================================= */

function getNoteTitle(note) {
    return (
        note?.file_name ||
        note?.title ||
        note?.unit ||
        "Study Note"
    );
}

function getNoteURL(note) {
    return (
        note?.file_url ||
        note?.url ||
        ""
    );
}

function createNoteCard(note) {
    const title =
        getNoteTitle(note);

    const course =
        note?.course ||
        "";

    const unit =
        note?.unit ||
        "";

    const url =
        getNoteURL(note);

    return `
        <article
            class="note-card"
            data-note-id="${escapeHTML(note?.id ?? "")}"
        >

            <div class="note-card-icon">
                📄
            </div>

            <div class="note-card-content">

                <h3>
                    ${escapeHTML(title)}
                </h3>

                ${
                    course
                        ? `
                            <span class="note-course">
                                ${escapeHTML(course)}
                            </span>
                        `
                        : ""
                }

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
                    url
                        ? `
                            <a
                                class="primary-button note-open-button"
                                href="${escapeHTML(url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View Note
                            </a>
                        `
                        : `
                            <button
                                type="button"
                                class="secondary-button"
                                disabled
                            >
                                Note Unavailable
                            </button>
                        `
                }

            </div>

        </article>
    `;
}

/* =========================================================
   RENDER NOTES
========================================================= */

function renderNotes() {
    const container =
        $("notesGrid") ||
        $("notesLibrary");

    if (!container) {
        return;
    }

    if (!allNotes.length) {
        container.innerHTML = `
            <div class="empty-state">

                <strong>
                    No notes available
                </strong>

                <span>
                    Published study notes will
                    appear here.
                </span>

            </div>
        `;

        return;
    }

    container.innerHTML =
        allNotes
            .map(createNoteCard)
            .join("");
}

/* =========================================================
   LOAD NOTES
========================================================= */

async function loadNotes() {

    const container =
        $("notesGrid") ||
        $("notesLibrary");

    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                Loading notes...
            </div>
        `;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
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
                "Notes loading error:",
                error
            );

            allNotes = [];

            updateNotesCounters();

            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        Unable to load notes.
                        Please refresh and try again.
                    </div>
                `;
            }

            return;
        }

        allNotes =
            Array.isArray(data)
                ? data
                : [];

        /* IMPORTANT:
           The old code loaded the notes but
           never updated the dashboard number.
        */
        updateNotesCounters();

        renderNotes();

        console.log(
            "📝 Notes loaded:",
            allNotes.length
        );

    } catch (error) {

        console.error(
            "loadNotes failed:",
            error
        );

        allNotes = [];

        updateNotesCounters();

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    Unable to load notes.
                </div>
            `;
        }
    }
}

/* =========================================================
   NOTE SEARCH
========================================================= */

function filterNotes(searchTerm) {
    const term =
        String(searchTerm || "")
            .trim()
            .toLowerCase();

    const cards =
        document.querySelectorAll(
            ".note-card"
        );

    cards.forEach(card => {

        const text =
            card.textContent
                .toLowerCase();

        card.style.display =
            !term ||
            text.includes(term)
                ? ""
                : "none";
    });
}

function setupNoteSearch() {
    const inputs =
        document.querySelectorAll(
            "#notesSearch, #searchNotes, [data-notes-search]"
        );

    inputs.forEach(input => {

        input.addEventListener(
            "input",
            event => {
                filterNotes(
                    event.target.value
                );
            }
        );

    });
}

/* =========================================================
   QUIZZES
========================================================= */

function getQuizQuestion(quiz) {
    return (
        quiz?.question ||
        "Quiz question"
    );
}

function createQuizSummaryCard(quiz) {
    return `
        <article
            class="quiz-summary-card"
            data-quiz-id="${escapeHTML(
                quiz?.id ?? ""
            )}"
        >

            <div class="quiz-summary-icon">
                ❓
            </div>

            <div class="quiz-summary-content">

                <h3>
                    ${escapeHTML(
                        getQuizQuestion(quiz)
                    )}
                </h3>

                ${
                    quiz?.course
                        ? `
                            <span>
                                ${escapeHTML(
                                    quiz.course
                                )}
                            </span>
                        `
                        : ""
                }

                ${
                    quiz?.unit
                        ? `
                            <span>
                                ${escapeHTML(
                                    quiz.unit
                                )}
                            </span>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}

/* =========================================================
   QUIZ SUMMARY
========================================================= */

function renderQuizSummary() {
    const container =
        $("quizSummary") ||
        $("quizLibrary");

    if (!container) {
        return;
    }

    if (!allQuizzes.length) {
        container.innerHTML = `
            <div class="empty-state">

                <strong>
                    No quizzes available
                </strong>

                <span>
                    Quiz questions will appear
                    when they are available.
                </span>

            </div>
        `;

        return;
    }

    const limited =
        allQuizzes.slice(0, 12);

    container.innerHTML =
        limited
            .map(createQuizSummaryCard)
            .join("");
}

/* =========================================================
   LOAD QUIZZES
========================================================= */

async function loadQuizzes() {

    const container =
        $("quizSummary") ||
        $("quizLibrary");

    if (container) {
        container.innerHTML = `
            <div class="loading-state">
                Loading quizzes...
            </div>
        `;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
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
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.error(
                "Quiz loading error:",
                error
            );

            allQuizzes = [];

            updateQuizCounters();

            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        Unable to load quizzes.
                        Please refresh and try again.
                    </div>
                `;
            }

            return;
        }

        allQuizzes =
            Array.isArray(data)
                ? data
                : [];

        /*
         * IMPORTANT FIX:
         * The previous dashboard loaded hundreds
         * of quiz questions but the visible counter
         * remained 0.
         *
         * The counter now reflects the actual
         * number returned from Supabase.
         */
        updateQuizCounters();

        updateQuizProgress();

        renderQuizSummary();

        console.log(
            "📝 Quiz questions loaded:",
            allQuizzes.length
        );

    } catch (error) {

        console.error(
            "loadQuizzes failed:",
            error
        );

        allQuizzes = [];

        updateQuizCounters();

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    Unable to load quizzes.
                </div>
            `;
        }
    }
}

/* =========================================================
   QUIZ SEARCH
========================================================= */

function filterQuizzes(searchTerm) {
    const term =
        String(searchTerm || "")
            .trim()
            .toLowerCase();

    const cards =
        document.querySelectorAll(
            ".quiz-summary-card"
        );

    cards.forEach(card => {

        const text =
            card.textContent
                .toLowerCase();

        card.style.display =
            !term ||
            text.includes(term)
                ? ""
                : "none";
    });
}

function setupQuizSearch() {
    const inputs =
        document.querySelectorAll(
            "#quizSearch, #searchQuizzes, [data-quiz-search]"
        );

    inputs.forEach(input => {

        input.addEventListener(
            "input",
            event => {
                filterQuizzes(
                    event.target.value
                );
            }
        );

    });
}

/* =========================================================
   QUIZ PROGRESS
========================================================= */

function getQuizProgress() {
    try {

        const raw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );

        if (!raw) {
            return {};
        }

        const parsed =
            JSON.parse(raw);

        return (
            parsed &&
            typeof parsed === "object"
        )
            ? parsed
            : {};

    } catch (error) {

        console.warn(
            "Unable to read quiz progress:",
            error
        );

        return {};
    }
}

function updateQuizProgress() {
    const progress =
        getQuizProgress();

    const values =
        Object.values(progress);

    let completed = 0;

    values.forEach(value => {

        if (
            typeof value === "number" &&
            value > 0
        ) {
            completed += 1;
        }

        else if (
            value &&
            typeof value === "object"
        ) {
            if (
                value.completed === true ||
                value.finished === true
            ) {
                completed += 1;
            }
        }

    });

    const percentage =
        allQuizzes.length
            ? Math.min(
                100,
                Math.round(
                    (
                        completed /
                        allQuizzes.length
                    ) * 100
                )
            )
            : 0;

    const progressElements =
        document.querySelectorAll(
            "#progressPercent, [data-progress-percent]"
        );

    progressElements.forEach(
        element => {
            element.textContent =
                `${percentage}%`;
        }
    );

    const progressBars =
        document.querySelectorAll(
            "#progressBar, [data-progress-bar]"
        );

    progressBars.forEach(
        bar => {
            bar.style.width =
                `${percentage}%`;

            bar.setAttribute(
                "aria-valuenow",
                String(percentage)
            );
        }
    );

    const progressText =
        $("progressText");

    if (progressText) {
        progressText.textContent =
            `${percentage}% complete`;
    }
}

/* =========================================================
   COURSE PROGRESS
========================================================= */

function getStoredCourseProgress() {
    try {

        const raw =
            localStorage.getItem(
                "mwanikiCourseProgress"
            );

        if (!raw) {
            return {};
        }

        const parsed =
            JSON.parse(raw);

        return (
            parsed &&
            typeof parsed === "object"
        )
            ? parsed
            : {};

    } catch (error) {

        return {};
    }
}

function renderCourseProgress() {
    const progress =
        getStoredCourseProgress();

    const progressItems =
        document.querySelectorAll(
            "[data-course-progress]"
        );

    progressItems.forEach(
        element => {

            const courseId =
                element.dataset.courseProgress;

            const value =
                Number(
                    progress[courseId] || 0
                );

            const safeValue =
                Math.max(
                    0,
                    Math.min(
                        100,
                        value
                    )
                );

            element.textContent =
                `${safeValue}%`;

            const bar =
                element
                    .closest(
                        ".course-progress"
                    )
                    ?.querySelector(
                        ".progress-fill"
                    );

            if (bar) {
                bar.style.width =
                    `${safeValue}%`;
            }
        }
    );
}


/* =========================================================
MWANIKI SCHOLARS
DASHBOARD STATISTICS ENGINE
========================================================= */


    const safeValue =
        value === null ||
        value === undefined
            ? 0
            : value;

    ids.forEach(id => {

        const element = $(id);

        if (!element) {
            return;
        }

        element.textContent =
            Number(safeValue).toLocaleString();
    });
}


/* =========================================================
UPDATE DASHBOARD STATISTICS
========================================================= */

function updateDashboardStatistics() {

    /* -----------------------------------------------------
       COURSES
    ----------------------------------------------------- */

    const totalCourses =
        Array.isArray(allCourses)
            ? allCourses.length
            : 0;

    setCounterText(
        [
            "totalCourses",
            "coursesCount"
        ],
        totalCourses
    );


    /* -----------------------------------------------------
       NOTES
    ----------------------------------------------------- */

    if (
        typeof updateNotesCounters ===
        "function"
    ) {

        updateNotesCounters();
    }


    /* -----------------------------------------------------
       QUIZZES
    ----------------------------------------------------- */

    if (
        typeof updateQuizCounters ===
        "function"
    ) {

        updateQuizCounters();
    }


    /* -----------------------------------------------------
       QUIZ PROGRESS
    ----------------------------------------------------- */

    if (
        typeof updateQuizProgress ===
        "function"
    ) {

        updateQuizProgress();
    }
}

/* =========================================================
   NAVIGATION
========================================================= */

function scrollToSection(id) {
    const element =
        $(id);

    if (!element) {
        return;
    }

    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-dashboard-section]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    const target =
                        button.dataset
                            .dashboardSection;

                    if (target) {
                        scrollToSection(
                            target
                        );
                    }
                }
            );

        });

    const courseLink =
        $("navCourses");

    if (courseLink) {
        courseLink.addEventListener(
            "click",
            event => {
                event.preventDefault();

                scrollToSection(
                    "coursesSection"
                );
            }
        );
    }

    const notesLink =
        $("navNotes");

    if (notesLink) {
        notesLink.addEventListener(
            "click",
            event => {
                event.preventDefault();

                scrollToSection(
                    "notesSection"
                );
            }
        );
    }

    const quizzesLink =
        $("navQuizzes");

    if (quizzesLink) {
        quizzesLink.addEventListener(
            "click",
            event => {
                event.preventDefault();

                scrollToSection(
                    "quizSection"
                );
            }
        );
    }
}

/* =========================================================
   PROFILE BUTTON
========================================================= */

function setupProfileButton() {

    const buttons =
        document.querySelectorAll(
            "#profileButton, #viewProfile, [data-profile-button]"
        );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                window.location.href =
                    "./studentProfile.html";
            }
        );

    });
}

/* =========================================================
   WHATSAPP CHANNEL
========================================================= */

function setupWhatsAppButton() {

    const whatsappURL =
        "https://whatsapp.com/channel/0029Vb89GsYHAdNehXiOP72l";

    const buttons =
        document.querySelectorAll(
            "#whatsappButton, [data-whatsapp]"
        );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                window.open(
                    whatsappURL,
                    "_blank",
                    "noopener,noreferrer"
                );
            }
        );

    });
}

/* =========================================================
   LOGOUT
========================================================= */

async function logoutStudent() {

    try {

        const {
            error
        } =
            await supabase.auth.signOut();

        if (error) {
            console.error(
                "Logout error:",
                error
            );

            showMessage(
                "Unable to log out. Please try again.",
                "error"
            );

            return;
        }

        localStorage.removeItem(
            "selectedCourse"
        );

        localStorage.removeItem(
            "selectedCourseName"
        );

        window.location.href =
            "./index.html";

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );

        showMessage(
            "Logout failed. Please try again.",
            "error"
        );
    }
}

function setupLogout() {

    const buttons =
        document.querySelectorAll(
            "#logoutButton, #logoutBtn, [data-logout]"
        );

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await logoutStudent();
            }
        );

    });
}

/* =========================================================
MWANIKI SCHOLARS
RECENT COURSE / CONTINUE LEARNING ENGINe
========================================================= */


/* =========================================================
GET LAST COURSE
========================================================= */

function getLastCourse() {

    try {

        const saved =
            localStorage.getItem(
                "mwanikiLastCourse"
            );

        if (!saved) {
            return null;
        }

        const course =
            JSON.parse(saved);

        if (
            !course ||
            course.id === undefined ||
            !course.title
        ) {

            return null;
        }

        return course;

    } catch (error) {

        console.warn(
            "Unable to read last course:",
            error
        );

        return null;
    }
}


/* =========================================================
SAVE LAST COURSE
========================================================= */

function saveLastCourse(course) {

    if (!course) {
        return;
    }

    const normalizedCourse = {

        id: course.id,

        title:
            course.title ||
            "Untitled Course",

        description:
            course.description ||
            "",

        image:
            course.image ||
            "",

        created_at:
            course.created_at ||
            null
    };


    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify(
            normalizedCourse
        )
    );
}


/* =========================================================
GET RECENT COURSES
========================================================= */

function getRecentCourses() {

    try {

        const saved =
            localStorage.getItem(
                "mwanikiRecentCourses"
            );

        if (!saved) {
            return [];
        }

        const courses =
            JSON.parse(saved);

        if (!Array.isArray(courses)) {
            return [];
        }

        return courses;

    } catch (error) {

        console.warn(
            "Unable to read recent courses:",
            error
        );

        return [];
    }
}


/* =========================================================
SAVE COURSE TO RECENT COURSES
========================================================= */

function saveRecentCourse(course) {

    if (!course) {
        return;
    }

    const normalizedCourse = {

        id: course.id,

        title:
            course.title ||
            "Untitled Course",

        description:
            course.description ||
            "",

        image:
            course.image ||
            "",

        created_at:
            course.created_at ||
            null
    };


    let recentCourses =
        getRecentCourses();


    recentCourses = [

        normalizedCourse,

        ...recentCourses.filter(
            item =>
                String(item.id) !==
                String(normalizedCourse.id)
        )

    ].slice(0, 5);


    localStorage.setItem(
        "mwanikiRecentCourses",
        JSON.stringify(
            recentCourses
        )
    );
}


/* =========================================================
OPEN COURSE
========================================================= */

function openCourse(course) {

    if (!course) {
        return;
    }

    const cleanCourse = {

        id: course.id,

        title:
            course.title ||
            "Untitled Course",

        description:
            course.description ||
            "",

        image:
            course.image ||
            "",

        created_at:
            course.created_at ||
            null
    };


    /* -----------------------------------------------------
       SELECTED COURSE
    ----------------------------------------------------- */

    localStorage.setItem(
        "selectedCourse",
        String(cleanCourse.id)
    );

    localStorage.setItem(
        "selectedCourseName",
        cleanCourse.title
    );


    /* -----------------------------------------------------
       LAST COURSE
    ----------------------------------------------------- */

    saveLastCourse(
        cleanCourse
    );


    /* -----------------------------------------------------
       RECENT COURSES
    ----------------------------------------------------- */

    saveRecentCourse(
        cleanCourse
    );


    /* -----------------------------------------------------
       OPEN COURSE PAGE
    ----------------------------------------------------- */

    window.location.href =
        getCourseURL(
            cleanCourse
        );
}


/* =========================================================
RENDER CONTINUE LEARNING
========================================================= */

function renderContinueLearning() {

    const container =
        $("continueLearning");

    if (!container) {
        return;
    }

    const course =
        getLastCourse();


    /* -----------------------------------------------------
       NO COURSE YET
    ----------------------------------------------------- */

    if (!course) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📚
                </div>

                <strong>
                    Start your learning journey
                </strong>

                <span>
                    Choose a course from the Course Library
                    to begin studying.
                </span>

            </div>

        `;

        return;
    }


    /* -----------------------------------------------------
       COURSE EXISTS
    ----------------------------------------------------- */

    container.innerHTML = `

        <div class="continue-course-card">

            <div class="continue-course-icon">

                ${
                    course.image

                        ? `
                            <img
                                src="${escapeHTML(course.image)}"
                                alt="${escapeHTML(
                                    course.title ||
                                    "Course"
                                )}"
                            >
                        `

                        : `
                            <span>
                                📚
                            </span>
                        `
                }

            </div>


            <div class="continue-course-info">

                <span class="continue-label">
                    Continue Learning
                </span>

                <h3>
                    ${escapeHTML(
                        course.title ||
                        "Selected Course"
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        course.description ||
                        "Continue studying this course."
                    )}
                </p>

            </div>


            <button
                type="button"
                class="primary-button"
                id="continueCourseButton"
            >
                Continue
            </button>

        </div>

    `;


    const button =
        $("continueCourseButton");


    if (button) {

        button.addEventListener(
            "click",
            () => {

                openCourse(
                    course
                );

            }
        );
    }
}


/* =========================================================
RENDER RECENT COURSES
========================================================= */

function renderRecentCourses() {

    const container =

        $("recentCourses") ||

        $("recentActivity") ||

        $("activityList") ||

        document.querySelector(
            ".recent-courses-list"
        ) ||

        document.querySelector(
            ".recent-activity-list"
        );


    if (!container) {
        return;
    }


    const recentCourses =
        getRecentCourses();


    /* -----------------------------------------------------
       NO RECENT COURSES
    ----------------------------------------------------- */

    if (
        !recentCourses.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📚
                </div>

                <h3>
                    No recent courses
                </h3>

                <p>
                    Open a course from the Course Library
                    and it will appear here.
                </p>

            </div>

        `;

        return;
    }


    /* -----------------------------------------------------
       RECENT COURSE CARDS
    ----------------------------------------------------- */

    container.innerHTML = `

        <div class="recent-courses-grid">

            ${recentCourses
                .slice(0, 5)
                .map(
                    course => `

                        <article
                            class="recent-course-card"
                            data-course-id="${escapeHTML(
                                course.id
                            )}"
                        >

                            <div class="recent-course-image">

                                ${
                                    course.image

                                        ? `
                                            <img
                                                src="${escapeHTML(
                                                    course.image
                                                )}"
                                                alt="${escapeHTML(
                                                    course.title ||
                                                    "Course"
                                                )}"
                                                loading="lazy"
                                            >
                                        `

                                        : `
                                            <span>
                                                📚
                                            </span>
                                        `
                                }

                            </div>


                            <div class="recent-course-content">

                                <span class="recent-course-label">
                                    Recently Studied
                                </span>

                                <h3>
                                    ${escapeHTML(
                                        course.title ||
                                        "Untitled Course"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        course.description ||
                                        "Continue studying this course."
                                    )}
                                </p>


                                <button
                                    type="button"
                                    class="secondary-button recent-course-button"
                                    data-course-id="${escapeHTML(
                                        course.id
                                    )}"
                                >
                                    Open Course
                                </button>

                            </div>

                        </article>

                    `
                )
                .join("")}

        </div>

    `;


    /* -----------------------------------------------------
       BUTTON EVENTS
    ----------------------------------------------------- */

    container
        .querySelectorAll(
            ".recent-course-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const courseId =
                        button.dataset.courseId;

                    const course =
                        recentCourses.find(
                            item =>
                                String(item.id) ===
                                String(courseId)
                        );

                    if (course) {

                        openCourse(
                            course
                        );
                    }
                }
            );

        });
}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

function renderAchievements() {
    const container =
        $("achievementsList") ||
        $("achievementsGrid") ||
        document.querySelector(".achievements-list");

    if (!container) return;

    const quizCount = Number(
        localStorage.getItem("mwanikiQuizAttempts") || 0
    );

    const coursesCompleted = Number(
        localStorage.getItem("mwanikiCoursesCompleted") || 0
    );

    const achievements = [
        {
            icon: "🎓",
            title: "Scholar",
            description: "Started your Mwaniki Scholars journey",
            unlocked: true
        },
        {
            icon: "📝",
            title: "Quiz Starter",
            description: "Complete your first quiz",
            unlocked: quizCount >= 1
        },
        {
            icon: "🏆",
            title: "Quiz Champion",
            description: "Complete 10 quizzes",
            unlocked: quizCount >= 10
        },
        {
            icon: "📚",
            title: "Course Finisher",
            description: "Complete your first course",
            unlocked: coursesCompleted >= 1
        }
    ];

    container.innerHTML = achievements
        .map(achievement => `
            <div class="achievement-card ${
                achievement.unlocked ? "unlocked" : "locked"
            }">

                <div class="achievement-icon">
                    ${achievement.icon}
                </div>

                <div class="achievement-info">
                    <strong>${escapeHTML(achievement.title)}</strong>
                    <span>${escapeHTML(achievement.description)}</span>
                </div>

                <div class="achievement-status">
                    ${achievement.unlocked ? "✓" : "🔒"}
                </div>

            </div>
        `)
        .join("");
}


/* =========================================================
   SCROLL NAVIGATION
========================================================= */

function setupScrollNavigation() {
    document.querySelectorAll("[data-scroll]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();

            const targetId =
                button.getAttribute("data-scroll");

            if (!targetId) return;

            const target = document.getElementById(targetId);

            if (!target) return;

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener("click", event => {
            const href = link.getAttribute("href");

            if (!href || href === "#") return;

            const target = document.querySelector(href);

            if (!target) return;

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    });
}


/* =========================================================
   NOTIFICATION BUTTON
========================================================= */

function setupNotificationButton() {
    const buttons = [
        $("notificationButton"),
        $("notificationsButton"),
        $("notificationBtn")
    ].filter(Boolean);

    buttons.forEach(button => {
        if (button.dataset.notificationReady === "true") {
            return;
        }

        button.dataset.notificationReady = "true";

        button.addEventListener("click", () => {
            const panel =
                $("notificationPanel") ||
                $("notificationsPanel");

            if (!panel) {
                showDashboardMessage(
                    "No new notifications.",
                    "info"
                );
                return;
            }

            panel.classList.toggle("active");
            panel.classList.toggle("open");
        });
    });
}


/* =========================================================
   DASHBOARD MESSAGE
========================================================= */

function showDashboardMessage(message, type = "info") {
    let toast = $("dashboardToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "dashboardToast";

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `dashboard-toast ${type}`;

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(window.mwanikiToastTimer);

    window.mwanikiToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* =========================================================
   AI TUTOR
========================================================= */

function setupAITutor() {
    const form =
        $("aiTutorForm") ||
        $("aiQuestionForm");

    const input =
        $("aiQuestion") ||
        $("aiTutorQuestion");

    const responseContainer =
        $("aiTutorResponse") ||
        $("aiResponse");

    if (!form || !input || !responseContainer) {
        return;
    }

    if (form.dataset.aiTutorReady === "true") {
        return;
    }

    form.dataset.aiTutorReady = "true";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const question = input.value.trim();

        if (!question) {
            showDashboardMessage(
                "Please enter a question.",
                "warning"
            );
            return;
        }

        responseContainer.innerHTML = `
            <div class="ai-loading">
                <span>🤖</span>
                <span>AI Tutor is thinking...</span>
            </div>
        `;

        try {
            const {
                data: {
                    session
                } = {},
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            const accessToken =
                session?.access_token;

            const { data, error } =
                await supabase.functions.invoke(
                    "mwaniki-ai",
                    {
                        body: {
                            question,
                            user_id:
                                currentUser?.id || null,
                            student_name:
                                getStudentName()
                        },
                        headers: accessToken
                            ? {
                                Authorization:
                                    `Bearer ${accessToken}`
                            }
                            : {}
                    }
                );

            if (error) {
                throw error;
            }

            const answer =
                data?.answer ||
                data?.response ||
                data?.message ||
                "The AI Tutor did not return an answer.";

            responseContainer.innerHTML = `
                <div class="ai-answer">
                    ${formatAIResponse(answer)}
                </div>
            `;

        } catch (error) {
            console.error(
                "AI Tutor error:",
                error
            );

            responseContainer.innerHTML = `
                <div class="ai-error">
                    <strong>AI Tutor unavailable</strong>
                    <p>
                        Please try again in a moment.
                    </p>
                </div>
            `;
        }
    });
}


/* =========================================================
   AI RESPONSE FORMATTER
========================================================= */

function formatAIResponse(text) {
    if (!text) return "";

    const safe = escapeHTML(String(text));

    return safe
        .replace(/\n\n+/g, "</p><p>")
        .replace(/\n/g, "<br>")
        .replace(
            /^### (.*?)$/gm,
            "<h3>$1</h3>"
        )
        .replace(
            /^## (.*?)$/gm,
            "<h2>$1</h2>"
        )
        .replace(
            /^# (.*?)$/gm,
            "<h2>$1</h2>"
        )
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );
}


/* =========================================================
   HUMAN TUTOR MESSAGING
========================================================= */

function setupTutorMessaging() {
    const form =
        $("tutorMessageForm") ||
        $("studentTutorMessageForm");

    const textarea =
        $("tutorMessage") ||
        $("studentTutorMessage");

    if (!form || !textarea) {
        return;
    }

    if (form.dataset.tutorMessagingReady === "true") {
        return;
    }

    form.dataset.tutorMessagingReady = "true";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const message = textarea.value.trim();

        if (!message) {
            showDashboardMessage(
                "Please enter a message.",
                "warning"
            );
            return;
        }

        if (!currentUser) {
            showDashboardMessage(
                "Please log in again.",
                "error"
            );
            return;
        }

        const studentName = getStudentName();

        const studentEmail =
            currentStudent?.email ||
            currentUser.email ||
            "";

        try {
            const { error } = await supabase
                .from("tutor_messages")
                .insert({
                    student_id: currentUser.id,
                    student_name: studentName,
                    student_email: studentEmail,
                    message,
                    status: "unread"
                });

            if (error) {
                throw error;
            }

            textarea.value = "";

            showDashboardMessage(
                "Your message has been sent to the tutor.",
                "success"
            );

        } catch (error) {
            console.error(
                "Tutor message error:",
                error
            );

            showDashboardMessage(
                "Unable to send the tutor message.",
                "error"
            );
        }
    });
}


/* =========================================================
   TUTOR STATUS
========================================================= */

function showTutorStatus(message, type = "info") {
    const elements = [
        $("tutorStatus"),
        $("tutorMessageStatus"),
        $("humanTutorStatus")
    ].filter(Boolean);

    elements.forEach(element => {
        element.textContent = message;
        element.className =
            `tutor-status ${type}`;
    });
}


/* =========================================================
   STUDENT INBOX
========================================================= */

async function setupStudentInbox() {
    const container =
        $("studentInbox") ||
        $("tutorInbox") ||
        $("inboxMessages");

    if (!container) return;

    await renderStudentInbox();
}


/* =========================================================
   RENDER STUDENT INBOX
========================================================= */

async function renderStudentInbox() {
    const container =
        $("studentInbox") ||
        $("tutorInbox") ||
        $("inboxMessages");

    if (!container || !currentUser) {
        return;
    }

    const email =
        currentStudent?.email ||
        currentUser.email ||
        "";

    if (!email) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No inbox available</h3>
            </div>
        `;

        return;
    }

    try {
        const { data, error } = await supabase
            .from("tutor_answers")
            .select("*")
            .eq("student_email", email)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        const messages =
            Array.isArray(data)
                ? data
                : [];

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>Your inbox is empty</h3>
                    <p>
                        Tutor replies will appear here.
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML = messages
            .map(message => {
                const answer =
                    message.answer ||
                    message.message ||
                    message.response ||
                    "";

                const created =
                    message.created_at
                        ? new Date(
                            message.created_at
                        ).toLocaleString()
                        : "";

                return `
                    <article class="inbox-message">

                        <div class="inbox-message-header">
                            <strong>
                                👨‍⚕️ Tutor
                            </strong>

                            <span>
                                ${escapeHTML(created)}
                            </span>
                        </div>

                        <div class="inbox-message-body">
                            ${formatAIResponse(answer)}
                        </div>

                    </article>
                `;
            })
            .join("");

    } catch (error) {
        console.error(
            "Student inbox error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Inbox unavailable</h3>
                <p>
                    We could not load tutor replies.
                </p>
            </div>
        `;
    }
}


/* =========================================================
   INITIAL HASH NAVIGATION
========================================================= */

function handleInitialHash() {
    const hash =
        window.location.hash;

    if (!hash) return;

    const targetId =
        hash.replace("#", "");

    if (!targetId) return;

    setTimeout(() => {
        const target =
            document.getElementById(targetId);

        if (!target) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }, 300);
}


/* =========================================================
   TRACK UNIT
========================================================= */

window.mwanikiTrackUnit = function (
    courseId,
    unitId,
    unitTitle,
    courseTitle
) {
    const activity = {
        courseId,
        unitId,
        unitTitle,
        courseTitle,
        title: unitTitle,
        type: "unit",
        timestamp:
            new Date().toISOString()
    };

    let activities = [];

    try {
        const stored =
            localStorage.getItem(
                "mwanikiRecentActivity"
            );

        activities =
            stored
                ? JSON.parse(stored)
                : [];

    } catch {
        activities = [];
    }

    if (!Array.isArray(activities)) {
        activities = [];
    }

    activities = [
        activity,
        ...activities.filter(item =>
            !(
                String(item.unitId) ===
                String(unitId)
            )
        )
    ].slice(0, 20);

    localStorage.setItem(
        "mwanikiRecentActivity",
        JSON.stringify(activities)
    );

    renderRecentlyStudied();

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            courseId,
            unitId,
            unitTitle,
            courseTitle
        })
    );

    renderContinueLearning();
};


/* =========================================================
   PUBLIC DASHBOARD API
========================================================= */

window.mwanikiDashboard = {

    refresh: async function () {
        await loadCourses();
        await loadNotes();
        await loadQuizzes();

        updateDashboardStats();
        renderContinueLearning();
        renderRecommendedLesson();
        renderCourseProgress();
        renderRecentlyStudied();
        renderAchievements();
    },

    refreshNotes: async function () {
        await loadNotes();
    },

    refreshQuizzes: async function () {
        await loadQuizzes();
    },

    refreshCourses: async function () {
        await loadCourses();
    },

    getCourses: function () {
        return allCourses;
    },

    getNotes: function () {
        return allNotes;
    },

    getQuizzes: function () {
        return allQuizzes;
    },

    getStudent: function () {
        return currentStudent;
    }
};


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

function setupAuthListener() {
    supabase.auth.onAuthStateChange(
        (event, session) => {

            console.log(
                "🔐 Auth state:",
                event
            );

            if (
                event === "SIGNED_OUT" ||
                !session?.user
            ) {
                window.location.href =
                    "./index.html";
            }

        }
    );
}


/* =========================================================
   INITIALIZE DASHBOARD
========================================================= */

async function initializeDashboard() {

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    try {

        setupScrollNavigation();

        setupNotificationButton();

        setupRecentActivity();

        setupAchievementsSafely();

        setupAITutor();

        setupTutorMessaging();

        setupAuthListener();

        handleInitialHash();

        const authenticated =
            await loadStudentProfile();

        if (!authenticated) {
            return;
        }

        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        updateDashboardStats();

        renderContinueLearning();

        renderRecommendedLesson();

        renderCourseProgress();

        renderRecentlyStudied();

        renderAchievements();

        await setupStudentInbox();

        console.log(
            "✅ Mwaniki Scholars dashboard ready"
        );

    } catch (error) {

        console.error(
            "❌ Dashboard initialization failed:",
            error
        );

        showDashboardMessage(
            "Some dashboard features could not be loaded.",
            "error"
        );
    }
}


/* =========================================================
   ACHIEVEMENTS SAFE INITIALIZER
========================================================= */

function setupAchievementsSafely() {
    try {
        renderAchievements();
    } catch (error) {
        console.warn(
            "Achievements could not be initialized:",
            error
        );
    }
}


/* =========================================================
   DOM READY
========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard
    );

} else {

    initializeDashboard();

}
/* =========================================================
   NOTE SEARCH
========================================================= */

function filterNotes(searchTerm) {

    const term =
        String(searchTerm || "")
            .trim()
            .toLowerCase();

    const cards =
        document.querySelectorAll(
            ".note-card"
        );

    cards.forEach(card => {

        const text =
            card.textContent
                .toLowerCase();

        card.style.display =
            !term ||
            text.includes(term)
                ? ""
                : "none";
    });
}

/* =========================================================
   SETUP NOTE SEARCH
========================================================= */

function setupNoteSearch() {

    const inputs =
        document.querySelectorAll(
            "#notesSearch, #searchNotes, [data-notes-search]"
        );

    inputs.forEach(input => {

        if (
            input.dataset.notesSearchReady ===
            "true"
        ) {
            return;
        }

        input.dataset.notesSearchReady =
            "true";

        input.addEventListener(
            "input",
            event => {

                filterNotes(
                    event.target.value
                );

            }
        );

    });
}

/* =========================================================
   QUIZ QUESTION
========================================================= */

function getQuizQuestion(quiz) {

    return (
        quiz?.question ||
        "Quiz question"
    );
}

/* =========================================================
   CREATE QUIZ SUMMARY CARD
========================================================= */

function createQuizSummaryCard(quiz) {

    return `
        <article
            class="quiz-summary-card"
            data-quiz-id="${escapeHTML(
                quiz?.id ?? ""
            )}"
        >

            <div class="quiz-summary-icon">
                ❓
            </div>

            <div class="quiz-summary-content">

                <h3>
                    ${escapeHTML(
                        getQuizQuestion(quiz)
                    )}
                </h3>

                ${
                    quiz?.course
                        ? `
                            <span>
                                ${escapeHTML(
                                    quiz.course
                                )}
                            </span>
                        `
                        : ""
                }

                ${
                    quiz?.unit
                        ? `
                            <span>
                                ${escapeHTML(
                                    quiz.unit
                                )}
                            </span>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}

/* =========================================================
   RENDER QUIZ SUMMARY
========================================================= */

function renderQuizSummary() {

    const container =
        $("quizSummary") ||
        $("quizLibrary");

    if (!container) {
        return;
    }

    if (!allQuizzes.length) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    No quizzes available
                </strong>

                <span>
                    Quiz questions will appear
                    when they are available.
                </span>

            </div>

        `;

        return;
    }

    const limited =
        allQuizzes.slice(0, 12);

    container.innerHTML =
        limited
            .map(createQuizSummaryCard)
            .join("");
}

/* =========================================================
   LOAD QUIZZES
========================================================= */

async function loadQuizzes() {

    const container =
        $("quizSummary") ||
        $("quizLibrary");

    if (container) {

        container.innerHTML = `
            <div class="loading-state">
                Loading quizzes...
            </div>
        `;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
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
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.error(
                "Quiz loading error:",
                error
            );

            allQuizzes = [];

            updateQuizCounters();

            if (container) {

                container.innerHTML = `
                    <div class="empty-state">
                        Unable to load quizzes.
                        Please refresh and try again.
                    </div>
                `;
            }

            return;
        }

        allQuizzes =
            Array.isArray(data)
                ? data
                : [];

        updateQuizCounters();

        updateQuizProgress();

        renderQuizSummary();

        console.log(
            "📝 Quiz questions loaded:",
            allQuizzes.length
        );

    } catch (error) {

        console.error(
            "loadQuizzes failed:",
            error
        );

        allQuizzes = [];

        updateQuizCounters();

        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    Unable to load quizzes.
                </div>
            `;
        }
    }
}

/* =========================================================
   QUIZ SEARCH
========================================================= */

function filterQuizzes(searchTerm) {

    const term =
        String(searchTerm || "")
            .trim()
            .toLowerCase();

    const cards =
        document.querySelectorAll(
            ".quiz-summary-card"
        );

    cards.forEach(card => {

        const text =
            card.textContent
                .toLowerCase();

        card.style.display =
            !term ||
            text.includes(term)
                ? ""
                : "none";
    });
}

/* =========================================================
   SETUP QUIZ SEARCH
========================================================= */

function setupQuizSearch() {

    const inputs =
        document.querySelectorAll(
            "#quizSearch, #searchQuizzes, [data-quiz-search]"
        );

    inputs.forEach(input => {

        if (
            input.dataset.quizSearchReady ===
            "true"
        ) {
            return;
        }

        input.dataset.quizSearchReady =
            "true";

        input.addEventListener(
            "input",
            event => {

                filterQuizzes(
                    event.target.value
                );

            }
        );

    });
}

/* =========================================================
   QUIZ PROGRESS STORAGE
========================================================= */

function getQuizProgress() {

    try {

        const raw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );

        if (!raw) {
            return {};
        }

        const parsed =
            JSON.parse(raw);

        return (
            parsed &&
            typeof parsed === "object"
        )
            ? parsed
            : {};

    } catch (error) {

        console.warn(
            "Unable to read quiz progress:",
            error
        );

        return {};
    }
}

/* =========================================================
   QUIZ PROGRESS
========================================================= */

function updateQuizProgress() {

    const progress =
        getQuizProgress();

    const values =
        Object.values(progress);

    let completed =
        0;

    values.forEach(value => {

        if (
            typeof value === "number" &&
            value > 0
        ) {

            completed += 1;

            return;
        }

        if (
            value &&
            typeof value === "object"
        ) {

            if (
                value.completed === true ||
                value.finished === true
            ) {

                completed += 1;
            }
        }

    });

    /*
     * The dashboard has the total number of
     * questions in allQuizzes.
     *
     * If the stored progress represents
     * completed quiz records, calculate from
     * those records. Otherwise keep the
     * percentage at zero rather than claiming
     * every question was completed.
     */

    const percentage =
        allQuizzes.length > 0 &&
        completed > 0

            ? Math.min(
                100,
                Math.round(
                    (
                        completed /
                        allQuizzes.length
                    ) * 100
                )
            )

            : 0;

    document
        .querySelectorAll(
            "#progressPercent, [data-progress-percent]"
        )
        .forEach(element => {

            element.textContent =
                `${percentage}%`;
        });

    document
        .querySelectorAll(
            "#progressBar, [data-progress-bar]"
        )
        .forEach(bar => {

            bar.style.width =
                `${percentage}%`;

            bar.setAttribute(
                "aria-valuenow",
                String(percentage)
            );
        });

    const progressText =
        $("progressText");

    if (progressText) {

        progressText.textContent =
            `${percentage}% complete`;
    }

    setCounterText(
        [
            "quizProgressPercent"
        ],
        percentage
    );
}

/* =========================================================
   COURSE PROGRESS STORAGE
========================================================= */

function getStoredCourseProgress() {

    try {

        const raw =
            localStorage.getItem(
                "mwanikiCourseProgress"
            );

        if (!raw) {
            return {};
        }

        const parsed =
            JSON.parse(raw);

        return (
            parsed &&
            typeof parsed === "object"
        )
            ? parsed
            : {};

    } catch (error) {

        console.warn(
            "Unable to read course progress:",
            error
        );

        return {};
    }
}

/* =========================================================
   COURSE PROGRESS
========================================================= */

function renderCourseProgress() {

    const progress =
        getStoredCourseProgress();

    const progressItems =
        document.querySelectorAll(
            "[data-course-progress]"
        );

    progressItems.forEach(
        element => {

            const courseId =
                element.dataset.courseProgress;

            const value =
                Number(
                    progress[courseId] || 0
                );

            const safeValue =
                Math.max(
                    0,
                    Math.min(
                        100,
                        value
                    )
                );

            element.textContent =
                `${safeValue}%`;

            const parent =
                element.closest(
                    ".course-progress"
                );

            const bar =
                parent?.querySelector(
                    ".progress-fill"
                );

            if (bar) {

                bar.style.width =
                    `${safeValue}%`;
            }
        }
    );
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function updateDashboardStatistics() {

    const totalCourses =
        Array.isArray(allCourses)
            ? allCourses.length
            : 0;

    setCounterText(
        [
            "totalCourses",
            "coursesCount"
        ],
        totalCourses
    );

    updateNotesCounters();

    updateQuizCounters();

    updateQuizProgress();
}

/*
 * Backwards-compatible alias.
 *
 * Older dashboard code and external HTML may still
 * call updateDashboardStats().
 */

function updateDashboardStats() {

    updateDashboardStatistics();
}

/* =========================================================
   NAVIGATION
========================================================= */

function scrollToSection(id) {

    const element =
        $(id);

    if (!element) {
        return;
    }

    element.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* =========================================================
   SETUP DASHBOARD NAVIGATION
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(
            "[data-dashboard-section]"
        )
        .forEach(button => {

            if (
                button.dataset.navigationReady ===
                "true"
            ) {
                return;
            }

            button.dataset.navigationReady =
                "true";

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    const target =
                        button.dataset
                            .dashboardSection;

                    if (target) {

                        scrollToSection(
                            target
                        );
                    }
                }
            );

        });

    const courseLink =
        $("navCourses");

    if (
        courseLink &&
        courseLink.dataset.navigationReady !==
        "true"
    ) {

        courseLink.dataset.navigationReady =
            "true";

        courseLink.addEventListener(
            "click",
            event => {

                event.preventDefault();

                scrollToSection(
                    "coursesSection"
                );
            }
        );
    }

    const notesLink =
        $("navNotes");

    if (
        notesLink &&
        notesLink.dataset.navigationReady !==
        "true"
    ) {

        notesLink.dataset.navigationReady =
            "true";

        notesLink.addEventListener(
            "click",
            event => {

                event.preventDefault();

                scrollToSection(
                    "notesSection"
                );
            }
        );
    }

    const quizzesLink =
        $("navQuizzes");

    if (
        quizzesLink &&
        quizzesLink.dataset.navigationReady !==
        "true"
    ) {

        quizzesLink.dataset.navigationReady =
            "true";

        quizzesLink.addEventListener(
            "click",
            event => {

                event.preventDefault();

                scrollToSection(
                    "quizSection"
                );
            }
        );
    }
}

/* =========================================================
   PROFILE BUTTON
========================================================= */

function setupProfileButton() {

    const buttons =
        document.querySelectorAll(
            "#profileButton, #viewProfile, [data-profile-button]"
        );

    buttons.forEach(button => {

        if (
            button.dataset.profileReady ===
            "true"
        ) {
            return;
        }

        button.dataset.profileReady =
            "true";

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                window.location.href =
                    "./studentProfile.html";
            }
        );

    });
}

/* =========================================================
   WHATSAPP CHANNEL
========================================================= */

function setupWhatsAppButton() {

    const whatsappURL =
        "https://whatsapp.com/channel/0029Vb89GsYHAdNehXiOP72l";

    const buttons =
        document.querySelectorAll(
            "#whatsappButton, [data-whatsapp]"
        );

    buttons.forEach(button => {

        if (
            button.dataset.whatsappReady ===
            "true"
        ) {
            return;
        }

        button.dataset.whatsappReady =
            "true";

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                window.open(
                    whatsappURL,
                    "_blank",
                    "noopener,noreferrer"
                );
            }
        );

    });
}

/* =========================================================
   LOGOUT
========================================================= */

async function logoutStudent() {

    try {

        const {
            error
        } =
            await supabase.auth.signOut();

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            showMessage(
                "Unable to log out. Please try again.",
                "error"
            );

            return;
        }

        localStorage.removeItem(
            "selectedCourse"
        );

        localStorage.removeItem(
            "selectedCourseName"
        );

        localStorage.removeItem(
            "mwanikiLastCourse"
        );

        localStorage.removeItem(
            "mwanikiRecentCourses"
        );

        window.location.href =
            "./index.html";

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );

        showMessage(
            "Logout failed. Please try again.",
            "error"
        );
    }
}

/* =========================================================
   SETUP LOGOUT
========================================================= */

function setupLogout() {

    const buttons =
        document.querySelectorAll(
            "#logoutButton, #logoutBtn, [data-logout]"
        );

    buttons.forEach(button => {

        if (
            button.dataset.logoutReady ===
            "true"
        ) {
            return;
        }

        button.dataset.logoutReady =
            "true";

        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await logoutStudent();
            }
        );

    });
}

/* =========================================================
   RENDER RECENT COURSES
========================================================= */

function renderRecentCourses() {

    /*
     * IMPORTANT:
     *
     * Do NOT use #recentActivity as a fallback here.
     * Recent Courses and Recent Activity are separate
     * dashboard systems.
     */

    const container =
        $("recentCourses") ||
        document.querySelector(
            ".recent-courses-list"
        );

    if (!container) {
        return;
    }

    const recentCourses =
        getRecentCourses();

    if (!recentCourses.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📚
                </div>

                <h3>
                    No recent courses
                </h3>

                <p>
                    Open a course from the Course Library
                    and it will appear here.
                </p>

            </div>

        `;

        return;
    }

    container.innerHTML = `

        <div class="recent-courses-grid">

            ${recentCourses
                .slice(0, 5)
                .map(
                    course => `

                        <article
                            class="recent-course-card"
                            data-course-id="${escapeHTML(
                                course.id
                            )}"
                        >

                            <div class="recent-course-image">

                                ${
                                    course.image

                                        ? `
                                            <img
                                                src="${escapeHTML(
                                                    course.image
                                                )}"
                                                alt="${escapeHTML(
                                                    course.title ||
                                                    "Course"
                                                )}"
                                                loading="lazy"
                                            >
                                        `

                                        : `
                                            <span>
                                                📚
                                            </span>
                                        `
                                }

                            </div>

                            <div class="recent-course-content">

                                <span class="recent-course-label">
                                    Recently Studied
                                </span>

                                <h3>
                                    ${escapeHTML(
                                        course.title ||
                                        "Untitled Course"
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        course.description ||
                                        "Continue studying this course."
                                    )}
                                </p>

                                <button
                                    type="button"
                                    class="secondary-button recent-course-button"
                                    data-course-id="${escapeHTML(
                                        course.id
                                    )}"
                                >
                                    Open Course
                                </button>

                            </div>

                        </article>

                    `
                )
                .join("")}

        </div>

    `;

    container
        .querySelectorAll(
            ".recent-course-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const courseId =
                        button.dataset.courseId;

                    const course =
                        recentCourses.find(
                            item =>
                                String(item.id) ===
                                String(courseId)
                        );

                    if (course) {

                        openCourse(
                            course
                        );
                    }
                }
            );

        });
}

/* =========================================================
   RECENT ACTIVITY STORAGE
========================================================= */

function getRecentActivity() {

    try {

        const raw =
            localStorage.getItem(
                "mwanikiRecentActivity"
            );

        if (!raw) {
            return [];
        }

        const parsed =
            JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.warn(
            "Unable to read recent activity:",
            error
        );

        return [];
    }
}

/* =========================================================
   RENDER RECENTLY STUDIED
========================================================= */

function renderRecentlyStudied() {

    const container =
        $("recentActivity") ||
        $("activityList") ||
        document.querySelector(
            ".recent-activity-list"
        );

    if (!container) {
        return;
    }

    const activities =
        getRecentActivity();

    if (!activities.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📚
                </div>

                <h3>
                    No recent activity
                </h3>

                <p>
                    Start studying a course to see
                    your recent activity here.
                </p>

            </div>

        `;

        return;
    }

    container.innerHTML =
        activities
            .slice(0, 8)
            .map(activity => {

                const title =
                    activity.title ||
                    activity.unitTitle ||
                    activity.courseTitle ||
                    "Study activity";

                const type =
                    activity.type ||
                    "Learning";

                const timestamp =
                    activity.timestamp
                        ? new Date(
                            activity.timestamp
                        ).toLocaleString(
                            "en-KE",
                            {
                                dateStyle:
                                    "medium",
                                timeStyle:
                                    "short"
                            }
                        )
                        : "";

                return `

                    <div class="activity-item">

                        <div class="activity-icon">

                            ${
                                String(type)
                                    .toLowerCase()
                                    .includes("quiz")
                                    ? "📝"
                                    : "📖"
                            }

                        </div>

                        <div class="activity-content">

                            <strong>
                                ${escapeHTML(title)}
                            </strong>

                            <span>
                                ${escapeHTML(type)}
                            </span>

                            ${
                                timestamp
                                    ? `
                                        <small>
                                            ${escapeHTML(
                                                timestamp
                                            )}
                                        </small>
                                    `
                                    : ""
                            }

                        </div>

                    </div>

                `;
            })
            .join("");
}

/* =========================================================
   SETUP RECENT ACTIVITY
========================================================= */

function setupRecentActivity() {

    const container =
        $("recentActivity") ||
        $("activityList") ||
        document.querySelector(
            ".recent-activity-list"
        );

    if (!container) {
        return;
    }

    renderRecentlyStudied();
}

/* =========================================================
   ACHIEVEMENTS
========================================================= */

function renderAchievements() {

    const container =
        $("achievementsList") ||
        $("achievementsGrid") ||
        document.querySelector(
            ".achievements-list"
        );

    if (!container) {
        return;
    }

    const quizCount =
        Number(
            localStorage.getItem(
                "mwanikiQuizAttempts"
            ) || 0
        );

    const coursesCompleted =
        Number(
            localStorage.getItem(
                "mwanikiCoursesCompleted"
            ) || 0
        );

    const achievements = [

        {
            icon: "🎓",
            title: "Scholar",
            description:
                "Started your Mwaniki Scholars journey",
            unlocked: true
        },

        {
            icon: "📝",
            title: "Quiz Starter",
            description:
                "Complete your first quiz",
            unlocked:
                quizCount >= 1
        },

        {
            icon: "🏆",
            title: "Quiz Champion",
            description:
                "Complete 10 quizzes",
            unlocked:
                quizCount >= 10
        },

        {
            icon: "📚",
            title: "Course Finisher",
            description:
                "Complete your first course",
            unlocked:
                coursesCompleted >= 1
        }

    ];

    container.innerHTML =
        achievements
            .map(
                achievement => `

                    <div
                        class="achievement-card ${
                            achievement.unlocked
                                ? "unlocked"
                                : "locked"
                        }"
                    >

                        <div class="achievement-icon">
                            ${achievement.icon}
                        </div>

                        <div class="achievement-info">

                            <strong>
                                ${escapeHTML(
                                    achievement.title
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    achievement.description
                                )}
                            </span>

                        </div>

                        <div class="achievement-status">
                            ${
                                achievement.unlocked
                                    ? "✓"
                                    : "🔒"
                            }
                        </div>

                    </div>

                `
            )
            .join("");
}

/* =========================================================
   ACHIEVEMENTS SAFE INITIALIZER
========================================================= */

function setupAchievementsSafely() {

    try {

        renderAchievements();

    } catch (error) {

        console.warn(
            "Achievements could not be initialized:",
            error
        );
    }
}

/* =========================================================
   SCROLL NAVIGATION
========================================================= */

function setupScrollNavigation() {

    document
        .querySelectorAll(
            "[data-scroll]"
        )
        .forEach(button => {

            if (
                button.dataset.scrollReady ===
                "true"
            ) {
                return;
            }

            button.dataset.scrollReady =
                "true";

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    const targetId =
                        button.getAttribute(
                            "data-scroll"
                        );

                    if (!targetId) {
                        return;
                    }

                    const target =
                        document.getElementById(
                            targetId
                        );

                    if (!target) {
                        return;
                    }

                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            );

        });

    document
        .querySelectorAll(
            'a[href^="#"]'
        )
        .forEach(link => {

            if (
                link.dataset.anchorReady ===
                "true"
            ) {
                return;
            }

            link.dataset.anchorReady =
                "true";

            link.addEventListener(
                "click",
                event => {

                    const href =
                        link.getAttribute(
                            "href"
                        );

                    if (
                        !href ||
                        href === "#"
                    ) {
                        return;
                    }

                    let target = null;

                    try {

                        target =
                            document.querySelector(
                                href
                            );

                    } catch {

                        return;
                    }

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

/* =========================================================
   NOTIFICATION BUTTON
========================================================= */

function setupNotificationButton() {

    const buttons = [

        $("notificationButton"),

        $("notificationsButton"),

        $("notificationBtn")

    ].filter(Boolean);

    buttons.forEach(button => {

        if (
            button.dataset.notificationReady ===
            "true"
        ) {
            return;
        }

        button.dataset.notificationReady =
            "true";

        button.addEventListener(
            "click",
            () => {

                const panel =
                    $("notificationPanel") ||
                    $("notificationsPanel");

                if (!panel) {

                    showDashboardMessage(
                        "No new notifications.",
                        "info"
                    );

                    return;
                }

                panel.classList.toggle(
                    "active"
                );

                panel.classList.toggle(
                    "open"
                );
            }
        );
    });
}
/* =========================================================
   AI TUTOR
========================================================= */

function setupAITutor() {

    const form =
        $("aiTutorForm") ||
        $("aiQuestionForm");

    const input =
        $("aiQuestion") ||
        $("aiTutorQuestion");

    const responseContainer =
        $("aiTutorResponse") ||
        $("aiResponse");

    if (
        !form ||
        !input ||
        !responseContainer
    ) {
        return;
    }

    if (
        form.dataset.aiTutorReady ===
        "true"
    ) {
        return;
    }

    form.dataset.aiTutorReady =
        "true";

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const question =
                input.value.trim();

            if (!question) {

                showDashboardMessage(
                    "Please enter a question.",
                    "warning"
                );

                return;
            }

            responseContainer.innerHTML = `

                <div class="ai-loading">

                    <span>
                        🤖
                    </span>

                    <span>
                        AI Tutor is thinking...
                    </span>

                </div>

            `;

            try {

                const {
                    data: sessionData,
                    error: sessionError
                } =
                    await supabase.auth.getSession();

                if (sessionError) {
                    throw sessionError;
                }

                const accessToken =
                    sessionData?.session
                        ?.access_token;

                const {
                    data,
                    error
                } =
                    await supabase.functions.invoke(
                        "mwaniki-ai",
                        {
                            body: {
                                question,

                                user_id:
                                    currentUser?.id ||
                                    null,

                                student_name:
                                    getStudentName()
                            },

                            headers:
                                accessToken
                                    ? {
                                        Authorization:
                                            `Bearer ${accessToken}`
                                    }
                                    : {}
                        }
                    );

                if (error) {
                    throw error;
                }

                const answer =
                    data?.answer ||
                    data?.response ||
                    data?.message ||
                    "The AI Tutor did not return an answer.";

                responseContainer.innerHTML = `

                    <div class="ai-answer">

                        ${formatAIResponse(
                            answer
                        )}

                    </div>

                `;

            } catch (error) {

                console.error(
                    "AI Tutor error:",
                    error
                );

                responseContainer.innerHTML = `

                    <div class="ai-error">

                        <strong>
                            AI Tutor unavailable
                        </strong>

                        <p>
                            Please try again in a moment.
                        </p>

                    </div>

                `;
            }
        }
    );
}

/* =========================================================
   AI RESPONSE FORMATTER
========================================================= */

function formatAIResponse(text) {

    if (!text) {
        return "";
    }

    const safe =
        escapeHTML(
            String(text)
        );

    return safe
        .replace(
            /^### (.*?)$/gm,
            "<h3>$1</h3>"
        )
        .replace(
            /^## (.*?)$/gm,
            "<h2>$1</h2>"
        )
        .replace(
            /^# (.*?)$/gm,
            "<h2>$1</h2>"
        )
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        )
        .replace(
            /\n\n+/g,
            "</p><p>"
        )
        .replace(
            /\n/g,
            "<br>"
        );
}

/* =========================================================
   HUMAN TUTOR MESSAGING
========================================================= */

function setupTutorMessaging() {

    const form =
        $("tutorMessageForm") ||
        $("studentTutorMessageForm");

    const textarea =
        $("tutorMessage") ||
        $("studentTutorMessage");

    if (
        !form ||
        !textarea
    ) {
        return;
    }

    if (
        form.dataset.tutorMessagingReady ===
        "true"
    ) {
        return;
    }

    form.dataset.tutorMessagingReady =
        "true";

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const message =
                textarea.value.trim();

            if (!message) {

                showDashboardMessage(
                    "Please enter a message.",
                    "warning"
                );

                return;
            }

            if (!currentUser) {

                showDashboardMessage(
                    "Please log in again.",
                    "error"
                );

                return;
            }

            const studentName =
                getStudentName();

            const studentEmail =
                currentStudent?.email ||
                currentUser.email ||
                "";

            try {

                const {
                    error
                } =
                    await supabase
                        .from("tutor_messages")
                        .insert({
                            student_id:
                                currentUser.id,

                            student_name:
                                studentName,

                            student_email:
                                studentEmail,

                            message,

                            status:
                                "unread"
                        });

                if (error) {
                    throw error;
                }

                textarea.value =
                    "";

                showDashboardMessage(
                    "Your message has been sent to the tutor.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "Tutor message error:",
                    error
                );

                showDashboardMessage(
                    "Unable to send the tutor message.",
                    "error"
                );
            }
        }
    );
}

/* =========================================================
   TUTOR STATUS
========================================================= */

function showTutorStatus(
    message,
    type = "info"
) {

    const elements = [

        $("tutorStatus"),

        $("tutorMessageStatus"),

        $("humanTutorStatus")

    ].filter(Boolean);

    elements.forEach(element => {

        element.textContent =
            message;

        element.className =
            `tutor-status ${type}`;
    });
}

/* =========================================================
   STUDENT INBOX
========================================================= */

async function setupStudentInbox() {

    const container =
        $("studentInbox") ||
        $("tutorInbox") ||
        $("inboxMessages");

    if (!container) {
        return;
    }

    await renderStudentInbox();
}

/* =========================================================
   RENDER STUDENT INBOX
========================================================= */

async function renderStudentInbox() {

    const container =
        $("studentInbox") ||
        $("tutorInbox") ||
        $("inboxMessages");

    if (
        !container ||
        !currentUser
    ) {
        return;
    }

    const email =
        currentStudent?.email ||
        currentUser.email ||
        "";

    if (!email) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📭
                </div>

                <h3>
                    No inbox available
                </h3>

            </div>

        `;

        return;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from("tutor_answers")
                .select("*")
                .eq(
                    "student_email",
                    email
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

        const messages =
            Array.isArray(data)
                ? data
                : [];

        if (!messages.length) {

            container.innerHTML = `

                <div class="empty-state">

                    <div class="empty-state-icon">
                        📭
                    </div>

                    <h3>
                        Your inbox is empty
                    </h3>

                    <p>
                        Tutor replies will appear here.
                    </p>

                </div>

            `;

            return;
        }

        container.innerHTML =
            messages
                .map(message => {

                    const answer =
                        message.answer ||
                        message.message ||
                        message.response ||
                        "";

                    const created =
                        message.created_at
                            ? new Date(
                                message.created_at
                            ).toLocaleString(
                                "en-KE"
                            )
                            : "";

                    return `

                        <article
                            class="inbox-message"
                        >

                            <div
                                class="inbox-message-header"
                            >

                                <strong>
                                    👨‍⚕️ Tutor
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        created
                                    )}
                                </span>

                            </div>

                            <div
                                class="inbox-message-body"
                            >

                                ${formatAIResponse(
                                    answer
                                )}

                            </div>

                        </article>

                    `;
                })
                .join("");

    } catch (error) {

        console.error(
            "Student inbox error:",
            error
        );

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ⚠️
                </div>

                <h3>
                    Inbox unavailable
                </h3>

                <p>
                    We could not load tutor replies.
                </p>

            </div>

        `;
    }
}

/* =========================================================
   INITIAL HASH NAVIGATION
========================================================= */

function handleInitialHash() {

    const hash =
        window.location.hash;

    if (!hash) {
        return;
    }

    const targetId =
        hash.replace(
            "#",
            ""
        );

    if (!targetId) {
        return;
    }

    setTimeout(() => {

        const target =
            document.getElementById(
                targetId
            );

        if (!target) {
            return;
        }

        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }, 300);
}

/* =========================================================
   TRACK UNIT
========================================================= */

window.mwanikiTrackUnit =
    function (
        courseId,
        unitId,
        unitTitle,
        courseTitle
    ) {

        const activity = {

            courseId,

            unitId,

            unitTitle,

            courseTitle,

            title:
                unitTitle ||
                "Study activity",

            type:
                "unit",

            timestamp:
                new Date().toISOString()
        };

        let activities =
            getRecentActivity();

        activities = [

            activity,

            ...activities.filter(
                item =>
                    !(
                        String(
                            item.unitId
                        ) ===
                        String(
                            unitId
                        )
                    )
            )

        ].slice(
            0,
            20
        );

        localStorage.setItem(
            "mwanikiRecentActivity",
            JSON.stringify(
                activities
            )
        );

        /*
         * IMPORTANT:
         *
         * Do not overwrite mwanikiLastCourse
         * with a unit-only object.
         *
         * Find the actual course first.
         */

        let course =
            allCourses.find(
                item =>
                    String(item.id) ===
                    String(courseId)
            );

        /*
         * If the course isn't currently in memory,
         * preserve enough information to create a
         * valid course object.
         */

        if (!course) {

            course = {

                id:
                    courseId,

                title:
                    courseTitle ||
                    "Selected Course",

                description:
                    "",

                image:
                    "",

                created_at:
                    null
            };
        }

        saveLastCourse(
            course
        );

        saveRecentCourse(
            course
        );

        renderRecentlyStudied();

        renderContinueLearning();

        renderRecentCourses();
    };

/* =========================================================
   PUBLIC DASHBOARD API
========================================================= */

window.mwanikiDashboard = {

    refresh:
        async function () {

            await loadCourses();

            await loadNotes();

            await loadQuizzes();

            updateDashboardStatistics();

            renderContinueLearning();

            renderRecommendedLesson();

            renderRecentCourses();

            renderCourseProgress();

            renderRecentlyStudied();

            renderAchievements();

            await setupStudentInbox();
        },

    refreshNotes:
        async function () {

            await loadNotes();
        },

    refreshQuizzes:
        async function () {

            await loadQuizzes();
        },

    refreshCourses:
        async function () {

            await loadCourses();
        },

    getCourses:
        function () {

            return allCourses;
        },

    getNotes:
        function () {

            return allNotes;
        },

    getQuizzes:
        function () {

            return allQuizzes;
        },

    getStudent:
        function () {

            return currentStudent;
        },

    getUser:
        function () {

            return currentUser;
        },

    getRecentCourses:
        function () {

            return getRecentCourses();
        },

    getRecentActivity:
        function () {

            return getRecentActivity();
        },

    openCourse:
        function (course) {

            openCourse(course);
        }
};

/* =========================================================
   AUTH STATE LISTENER
========================================================= */

function setupAuthListener() {

    if (authListenerReady) {
        return;
    }

    authListenerReady =
        true;

    supabase.auth.onAuthStateChange(
        (event, session) => {

            console.log(
                "🔐 Auth state:",
                event
            );

            /*
             * Only redirect on an actual SIGNED_OUT
             * event. This avoids accidental redirects
             * during INITIAL_SESSION while the dashboard
             * is loading.
             */

            if (
                event ===
                "SIGNED_OUT"
            ) {

                currentUser =
                    null;

                currentStudent =
                    null;

                window.location.href =
                    "./index.html";
            }

            if (
                session?.user &&
                !currentUser
            ) {

                currentUser =
                    session.user;
            }
        }
    );
}

/* =========================================================
   INITIALIZE DASHBOARD
========================================================= */

async function initializeDashboard() {

    if (dashboardReady) {
        return;
    }

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    try {

        /*
         * Start all UI systems first.
         */

        startDashboardClock();

        setupNavigation();

        setupScrollNavigation();

        setupCourseSearch();

        setupNoteSearch();

        setupQuizSearch();

        setupNotificationButton();

        setupProfileButton();

        setupWhatsAppButton();

        setupLogout();

        setupRecentActivity();

        setupAchievementsSafely();

        setupAITutor();

        setupTutorMessaging();

        setupAuthListener();

        handleInitialHash();

        /*
         * Authenticate the student.
         */

        const authenticated =
            await loadStudentProfile();

        if (!authenticated) {
            return;
        }

        /*
         * Load the three major dashboard
         * data sources together.
         */

        await Promise.all([

            loadCourses(),

            loadNotes(),

            loadQuizzes()

        ]);

        /*
         * Update all dashboard systems after
         * the database data has arrived.
         */

        updateDashboardStatistics();

        renderCourses();

        renderContinueLearning();

        renderRecommendedLesson();

        renderRecentCourses();

        renderCourseProgress();

        renderRecentlyStudied();

        renderAchievements();

        await setupStudentInbox();

        dashboardReady =
            true;

        console.log(
            "📊 Dashboard statistics:",
            {
                courses:
                    allCourses.length,

                notes:
                    allNotes.length,

                quizzes:
                    allQuizzes.length
            }
        );

        console.log(
            "✅ Mwaniki Scholars dashboard ready"
        );

    } catch (error) {

        console.error(
            "❌ Dashboard initialization failed:",
            error
        );

        showDashboardMessage(
            "Some dashboard features could not be loaded.",
            "error"
        );
    }
}

/* =========================================================
   DOM READY
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        {
            once: true
        }
    );

} else {

    initializeDashboard();
}
