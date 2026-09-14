import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
========================================================= */

console.log("🚀 Mwaniki Scholars dashboard engine loaded");

/* =========================================================
   STATE
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

function getInitials(name) {
    const cleanName = String(name || "Student")
        .trim()
        .replace(/\s+/g, " ");

    if (!cleanName) {
        return "S";
    }

    const parts = cleanName.split(" ");

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

function showMessage(message, type = "info") {
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
        box.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";
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
   CURRENT DATE
========================================================= */

function updateCurrentDate() {
    const element = $("currentDate");

    if (!element) {
        return;
    }

    element.textContent = new Date().toLocaleDateString(
        "en-KE",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
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
    const studentName = getStudentName();

    const headerName = $("headerProfileName");

    if (headerName) {
        headerName.textContent = studentName;
    }

    const heroName = $("welcomeName");

    if (heroName) {
        heroName.textContent = studentName;
    }

    const studentNameInput = $("studentName");

    if (studentNameInput) {
        studentNameInput.value = studentName;
    }

    const studentEmailInput = $("studentEmail");

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
        imageElement.style.display = "none";

        if (fallbackElement) {
            fallbackElement.style.display = "flex";
            fallbackElement.textContent = getInitials(studentName);
        }

        return;
    }

    imageElement.src = photoURL;
    imageElement.alt = `${studentName} profile photo`;
    imageElement.style.display = "block";

    if (fallbackElement) {
        fallbackElement.style.display = "none";
    }

    imageElement.onerror = () => {
        imageElement.style.display = "none";

        if (fallbackElement) {
            fallbackElement.style.display = "flex";
            fallbackElement.textContent = getInitials(studentName);
        }
    };
}

function updateStudentPhoto() {
    const studentName = getStudentName();

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
        } = await supabase.auth.getUser();

        if (authError) {
            console.error(
                "Authentication error:",
                authError
            );
        }

        currentUser = authData?.user || null;

        if (!currentUser) {
            window.location.href = "./index.html";
            return false;
        }

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
            console.error(
                "Student profile error:",
                error
            );

            currentStudent = null;
        } else {
            currentStudent = data || null;
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
    const image = course?.image || "";

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

    localStorage.setItem(
        "selectedCourse",
        String(course.id)
    );

    localStorage.setItem(
        "selectedCourseName",
        course.title || ""
    );

    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: course.id,
            title: course.title || "",
            description: course.description || "",
            image: course.image || ""
        })
    );

    window.location.href = getCourseURL(course);
}

/* =========================================================
   COURSE CARD
========================================================= */

function createCourseCard(course) {
    const courseId = course?.id ?? "";

    const title =
        course?.title ||
        "Untitled Course";

    const description =
        course?.description ||
        "Explore units, notes and quizzes for this course.";

    const image = getCourseImage(course);

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
    const area = $("courseGrid");

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

    area.innerHTML = allCourses
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
   LOAD COURSES
========================================================= */

async function loadCourses() {
    const area = $("courseGrid");

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
        } = await supabase
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

function renderContinueLearning() {
    const area =
        $("continueLearningContent");

    if (!area) {
        return;
    }

    let savedCourse = null;

    try {
        const raw =
            localStorage.getItem(
                "mwanikiLastCourse"
            );

        if (raw) {
            savedCourse = JSON.parse(raw);
        }

    } catch (error) {
        console.warn(
            "Could not read recent course:",
            error
        );
    }

    if (!savedCourse) {
        area.innerHTML = `
            <div class="empty-state">
                Choose a course from the library
                to begin learning.
            </div>
        `;

        return;
    }

    const course =
        allCourses.find(
            item =>
                Number(item.id) ===
                Number(savedCourse.id)
        ) ||
        savedCourse;

    area.innerHTML = `
        <div class="continue-learning-card">

            <div>

                <span class="section-kicker">
                    RECENT COURSE
                </span>

                <h3>
                    ${escapeHTML(
                        course.title ||
                        "Continue Learning"
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        course.description ||
                        "Continue your medical learning journey."
                    )}
                </p>

            </div>

            <button
                type="button"
                class="primary-button"
                id="continueLearningButton"
            >
                Continue Course
            </button>

        </div>
    `;

    $("continueLearningButton")
        ?.addEventListener(
            "click",
            () => openCourse(course)
        );
}

/* =========================================================
   RECOMMENDED LESSON
========================================================= */

function renderRecommendedLesson() {
    const area =
        $("recommendedLesson");

    if (!area) {
        return;
    }

    if (!allCourses.length) {
        area.innerHTML = `
            <div class="empty-state">
                Recommendations will appear here.
            </div>
        `;

        return;
    }

    const course =
        allCourses[0];

    area.innerHTML = `
        <div class="recommended-card">

            <div>

                <span class="section-kicker">
                    RECOMMENDED
                </span>

                <h3>
                    ${escapeHTML(
                        course.title
                    )}
                </h3>

                <p>
                    ${escapeHTML(
                        course.description ||
                        "Explore this medical course."
                    )}
                </p>

            </div>

            <button
                type="button"
                class="primary-button"
                id="recommendedLessonButton"
            >
                Start Learning
            </button>

        </div>
    `;

    $("recommendedLessonButton")
        ?.addEventListener(
            "click",
            () => openCourse(course)
        );
}

/* =========================================================
   RECENTLY STUDIED
========================================================= */

function renderRecentlyStudied() {
    const area =
        $("recentlyStudied");

    if (!area) {
        return;
    }

    let savedCourse = null;

    try {
        const raw =
            localStorage.getItem(
                "mwanikiLastCourse"
            );

        if (raw) {
            savedCourse = JSON.parse(raw);
        }

    } catch {
        savedCourse = null;
    }

    if (!savedCourse) {
        area.innerHTML = `
            <div class="empty-state">
                No recent activity yet.
            </div>
        `;

        return;
    }

    area.innerHTML = `
        <div class="activity-item">

            <div>

                <strong>
                    ${escapeHTML(
                        savedCourse.title ||
                        "Recent Course"
                    )}
                </strong>

                <span>
                    Recently studied
                </span>

            </div>

            <button
                type="button"
                class="secondary-button"
                id="recentCourseOpenButton"
            >
                Continue
            </button>

        </div>
    `;

    $("recentCourseOpenButton")
        ?.addEventListener(
            "click",
            () => {

                const course =
                    allCourses.find(
                        item =>
                            Number(item.id) ===
                            Number(savedCourse.id)
                    ) ||
                    savedCourse;

                openCourse(course);
            }
        );
}

/* =========================================================
   CLEAR RECENT ACTIVITY
========================================================= */

function setupRecentActivity() {
    const button =
        $("clearRecentActivity");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                "mwanikiLastCourse"
            );

            renderRecentlyStudied();

            showMessage(
                "Recent activity cleared."
            );
        }
    );
}

/* =========================================================
   NOTES CARD
========================================================= */

function createNoteCard(note) {
    const noteId =
        note?.id !== undefined &&
        note?.id !== null
            ? String(note.id)
            : "";

    const course =
        String(
            note?.course ||
            "Medical Studies"
        ).trim();

    const unit =
        String(
            note?.unit ||
            "Study Material"
        ).trim();

    const fileName =
        String(
            note?.file_name ||
            `${unit} Notes`
        ).trim();

    const fileURL =
        String(
            note?.file_url ||
            ""
        ).trim();

    return `
        <article
            class="note-card"
            data-note-id="${escapeHTML(noteId)}"
        >

            <div class="note-card-content">

                <div class="note-card-label">
                    STUDY MATERIAL
                </div>

                <h3 class="note-card-title">
                    ${escapeHTML(fileName)}
                </h3>

                <p class="note-card-course">

                    <span class="note-course-name">
                        ${escapeHTML(course)}
                    </span>

                    <span class="note-separator">
                        •
                    </span>

                    <span class="note-unit-name">
                        ${escapeHTML(unit)}
                    </span>

                </p>

                ${
                    fileURL
                        ? `
                            <a
                                class="secondary-button note-card-button"
                                href="${escapeHTML(fileURL)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open Notes
                            </a>
                        `
                        : `
                            <span class="note-card-unavailable">
                                Notes file unavailable.
                            </span>
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
    const area =
        $("notesGrid");

    if (!area) {
        return;
    }

    if (!allNotes.length) {
        area.innerHTML = `
            <div class="empty-state">

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

    area.innerHTML = allNotes
        .map(createNoteCard)
        .join("");
}

/* =========================================================
   LOAD NOTES
========================================================= */

async function loadNotes() {
    const area =
        $("notesGrid");

    if (area) {
        area.innerHTML = `
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

            if (area) {
                area.innerHTML = `
                    <div class="empty-state">
                        Unable to load notes.
                    </div>
                `;
            }

            return;
        }

        allNotes =
            Array.isArray(data)
                ? data
                : [];

        renderNotes();

    } catch (error) {
        console.error(
            "loadNotes failed:",
            error
        );

        allNotes = [];

        if (area) {
            area.innerHTML = `
                <div class="empty-state">
                    Unable to load notes.
                </div>
            `;
        }
    }
}

/* =========================================================
   QUIZZES
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

            return;
        }

        allQuizzes =
            Array.isArray(data)
                ? data
                : [];

        const totalQuizzes =
            $("quizzesAttempted");

        if (
            totalQuizzes &&
            !totalQuizzes.textContent
        ) {
            totalQuizzes.textContent = "0";
        }

        updateQuizProgress();
        renderQuizSummary();

    } catch (error) {
        console.error(
            "loadQuizzes failed:",
            error
        );

        allQuizzes = [];
    }
}

/* =========================================================
   QUIZ SUMMARY
========================================================= */

function renderQuizSummary() {
    const recent =
        $("recentQuizPerformance");

    const best =
        $("bestQuizScore");

    const weak =
        $("weakQuizAreas");

    const progress =
        calculateQuizProgress();

    if (recent) {
        recent.innerHTML = `
            <div class="quiz-summary-number">
                ${escapeHTML(
                    String(allQuizzes.length)
                )}
            </div>

            <span>
                Quiz questions available
            </span>
        `;
    }

    if (best) {
        best.textContent =
            `${progress}%`;
    }

    if (weak) {
        weak.textContent =
            progress < 60
                ? "Keep reviewing your recent topics and practise more quizzes."
                : "Keep practising to strengthen your knowledge.";
    }
}

/* =========================================================
   QUIZ PROGRESS
========================================================= */

function calculateQuizProgress() {
    try {
        const raw =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );

        if (!raw) {
            return 0;
        }

        const progress =
            JSON.parse(raw);

        if (
            typeof progress === "number" &&
            Number.isFinite(progress)
        ) {
            return Math.max(
                0,
                Math.min(
                    100,
                    progress
                )
            );
        }

        if (
            progress &&
            typeof progress === "object"
        ) {
            const values =
                Object.values(progress);

            if (!values.length) {
                return 0;
            }

            let total = 0;

            values.forEach(value => {

                if (
                    typeof value === "number"
                ) {
                    total += Math.max(
                        0,
                        Math.min(
                            100,
                            value
                        )
                    );

                } else if (
                    value &&
                    typeof value === "object"
                ) {
                    const score =
                        Number(
                            value.score ??
                            value.progress ??
                            0
                        );

                    total += Math.max(
                        0,
                        Math.min(
                            100,
                            score
                        )
                    );
                }
            });

            return Math.round(
                total /
                values.length
            );
        }

    } catch (error) {
        console.warn(
            "Quiz progress error:",
            error
        );
    }

    return 0;
}

function updateQuizProgress() {
    const progress =
        calculateQuizProgress();

    const progressText =
        $("overallProgressText");

    const progressBar =
        $("overallProgressBar");

    if (progressText) {
        progressText.textContent =
            `${progress}%`;
    }

    if (progressBar) {
        progressBar.style.width =
            `${progress}%`;
    }

    const score =
        $("averageScore");

    if (score) {
        score.textContent =
            `${progress}%`;
    }

    const streak =
        $("learningStreak");

    if (streak) {
        const saved =
            localStorage.getItem(
                "mwanikiLearningStreak"
            );

        streak.textContent =
            saved
                ? `${saved} days`
                : "0 days";
    }
}

/* =========================================================
   COURSE PROGRESS
========================================================= */

function renderCourseProgress() {
    const area =
        $("courseProgressArea");

    if (!area) {
        return;
    }

    if (!allCourses.length) {
        area.innerHTML = `
            <div class="empty-state">
                Course progress will appear here.
            </div>
        `;

        return;
    }

    area.innerHTML =
        allCourses
            .slice(0, 6)
            .map(course => {

                return `
                    <div class="course-progress-item">

                        <div class="course-progress-header">

                            <strong>
                                ${escapeHTML(
                                    course.title
                                )}
                            </strong>

                            <span>
                                0%
                            </span>

                        </div>

                        <div class="progress-track">

                            <div
                                class="progress-fill"
                                style="width:0%;"
                            ></div>

                        </div>

                    </div>
                `;
            })
            .join("");
}

/* =========================================================
   ACHIEVEMENT INDICATORS
========================================================= */

function renderAchievements() {
    const area =
        $("achievementIndicators");

    if (!area) {
        return;
    }

    area.innerHTML = `
        <div class="achievement-indicators">

            <span>
                📚 ${allCourses.length} courses available
            </span>

            <span>
                📄 ${allNotes.length} notes available
            </span>

            <span>
                📝 ${allQuizzes.length} quiz questions
            </span>

        </div>
    `;
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
            event => {

                const targetID =
                    link.dataset.section;

                const target =
                    document.getElementById(
                        targetID
                    );

                if (!target) {
                    return;
                }

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                links.forEach(item => {
                    item.classList.remove(
                        "active"
                    );
                });

                link.classList.add(
                    "active"
                );

                if (history.replaceState) {
                    history.replaceState(
                        null,
                        "",
                        `#${targetID}`
                    );
                }
            }
        );
    });

    const mobileLinks =
        document.querySelectorAll(
            ".mobile-bottom-nav a"
        );

    mobileLinks.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                const href =
                    link.getAttribute("href");

                if (
                    !href ||
                    !href.startsWith("#")
                ) {
                    return;
                }

                const target =
                    document.getElementById(
                        href.slice(1)
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

/* =========================================================
   SCROLL NAVIGATION
========================================================= */

function setupScrollNavigation() {
    const sections =
        [
            "dashboardHome",
            "courseLibrary",
            "notesLibrary",
            "quizCenter",
            "aiTutor",
            "humanTutor",
            "studentInboxSection"
        ]
            .map(id =>
                document.getElementById(id)
            )
            .filter(Boolean);

    const links =
        document.querySelectorAll(
            ".nav-link[data-section]"
        );

    if (
        !sections.length ||
        !("IntersectionObserver" in window)
    ) {
        return;
    }

    const observer =
        new IntersectionObserver(
            entries => {

                const visible =
                    entries
                        .filter(
                            entry =>
                                entry.isIntersecting
                        )
                        .sort(
                            (a, b) =>
                                b.intersectionRatio -
                                a.intersectionRatio
                        )[0];

                if (!visible) {
                    return;
                }

                links.forEach(link => {

                    link.classList.toggle(
                        "active",
                        link.dataset.section ===
                        visible.target.id
                    );

                });
            },
            {
                rootMargin:
                    "-120px 0px -55% 0px",

                threshold: [
                    0.1,
                    0.25,
                    0.5
                ]
            }
        );

    sections.forEach(
        section =>
            observer.observe(section)
    );
}

/* =========================================================
   PROFILE BUTTON
========================================================= */

function setupStudentProfileButton() {
    const button =
        $("studentProfileButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {
            window.location.href =
                "./studentProfile.html";
        }
    );
}

/* =========================================================
   NOTIFICATION BUTTON
========================================================= */

function setupNotificationButton() {
    const button =
        $("notificationButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {
            showMessage(
                "Your latest notifications will appear here.",
                "info"
            );
        }
    );
}

/* =========================================================
   AI TUTOR
========================================================= */

function setupAITutor() {
    const textarea =
        $("aiQuestion");

    const askButton =
        $("askAIButton");

    const answerBox =
        $("aiAnswer");

    if (
        !textarea ||
        !askButton
    ) {
        return;
    }

    document
        .querySelectorAll(
            ".suggestion-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    textarea.value =
                        button.textContent.trim();

                    textarea.focus();
                }
            );
        });

    askButton.addEventListener(
        "click",
        async () => {

            const question =
                textarea.value.trim();

            if (!question) {
                showMessage(
                    "Please enter a medical question first."
                );

                textarea.focus();

                return;
            }

            askButton.disabled = true;
            askButton.textContent =
                "Thinking...";

            if (answerBox) {
                answerBox.textContent =
                    "Mwaniki AI is preparing your answer...";
            }

            try {
                const {
                    data: sessionData
                } =
                    await supabase.auth.getSession();

                const token =
                    sessionData?.session?.access_token;

                if (!token) {
                    throw new Error(
                        "Your session has expired. Please sign in again."
                    );
                }

                const {
                    data,
                    error
                } =
                    await supabase.functions.invoke(
                        "mwaniki-ai",
                        {
                            body: {
                                question,
                                searchMwaniki: true,
                                searchWeb: true,
                                searchImages: true
                            }
                        }
                    );

                if (error) {
                    throw error;
                }

                const answer =
                    data?.finalAnswer ||
                    data?.answer ||
                    data?.webAnswer ||
                    "No answer was returned.";

                if (answerBox) {
                    answerBox.textContent =
                        answer;
                }

                const recent =
                    $("aiRecentQuestions");

                if (recent) {

                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "ai-recent-question";

                    item.textContent =
                        question;

                    recent.prepend(item);
                }

            } catch (error) {

                console.error(
                    "AI Tutor error:",
                    error
                );

                if (answerBox) {
                    answerBox.textContent =
                        "The AI Tutor could not respond right now. Please try again.";
                }

                showMessage(
                    error.message ||
                    "AI Tutor request failed.",
                    "error"
                );

            } finally {

                askButton.disabled = false;

                askButton.textContent =
                    "🤖 Ask AI Tutor";
            }
        }
    );
}

/* =========================================================
   HUMAN TUTOR
========================================================= */

function setupTutorMessaging() {
    const button =
        $("sendTutorMessageButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            const studentName =
                $("studentName")?.value.trim() ||
                getStudentName();

            const studentEmail =
                $("studentEmail")?.value.trim() ||
                currentUser?.email ||
                "";

            const topic =
                $("topic")?.value.trim() ||
                "";

            const message =
                $("studentMessage")?.value.trim() ||
                "";

            if (!topic) {

                showTutorStatus(
                    "Please enter the topic.",
                    "error"
                );

                $("topic")?.focus();

                return;
            }

            if (!message) {

                showTutorStatus(
                    "Please write your question.",
                    "error"
                );

                $("studentMessage")?.focus();

                return;
            }

            button.disabled = true;
            button.textContent =
                "Sending...";

            try {

                const {
                    error
                } =
                    await supabase
                        .from("tutor_messages")
                        .insert({
                            student_id:
                                currentUser?.id ||
                                null,

                            student_name:
                                studentName,

                            student_email:
                                studentEmail,

                            topic,

                            message
                        });

                if (error) {
                    throw error;
                }

                showTutorStatus(
                    "Message sent successfully. A tutor can now respond from the tutor portal.",
                    "success"
                );

                const topicInput =
                    $("topic");

                const messageInput =
                    $("studentMessage");

                if (topicInput) {
                    topicInput.value = "";
                }

                if (messageInput) {
                    messageInput.value = "";
                }

            } catch (error) {

                console.error(
                    "Tutor message error:",
                    error
                );

                showTutorStatus(
                    error.message ||
                    "Unable to send your message.",
                    "error"
                );

            } finally {

                button.disabled = false;

                button.textContent =
                    "📨 Send Message";
            }
        }
    );
}

function showTutorStatus(
    message,
    type = ""
) {
    const status =
        $("messageStatus");

    if (!status) {
        showMessage(
            message,
            type
        );

        return;
    }

    status.textContent =
        message;

    status.classList.remove(
        "success",
        "error"
    );

    if (type) {
        status.classList.add(
            type
        );
    }
}

/* =========================================================
   STUDENT INBOX
========================================================= */

function setupStudentInbox() {
    const button =
        $("loadAnswersButton");

    const emailInput =
        $("checkEmail");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            const email =
                emailInput?.value.trim() ||
                currentUser?.email ||
                "";

            if (!email) {

                showMessage(
                    "Please enter your email address."
                );

                emailInput?.focus();

                return;
            }

            button.disabled = true;

            button.textContent =
                "Loading...";

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

                renderStudentInbox(
                    Array.isArray(data)
                        ? data
                        : []
                );

            } catch (error) {

                console.error(
                    "Inbox error:",
                    error
                );

                const inbox =
                    $("studentInbox");

                if (inbox) {

                    inbox.innerHTML = `
                        <div class="empty-state">
                            Unable to load tutor replies.
                            Please try again.
                        </div>
                    `;
                }

            } finally {

                button.disabled = false;

                button.textContent =
                    "📬 Load Answers";
            }
        }
    );
}

function renderStudentInbox(answers) {
    const inbox =
        $("studentInbox");

    if (!inbox) {
        return;
    }

    if (!answers.length) {

        inbox.innerHTML = `
            <div class="empty-state">
                No tutor replies found yet.
            </div>
        `;

        return;
    }

    inbox.innerHTML =
        answers
            .map(answer => {

                return `
                    <article class="inbox-message">

                        <h3>
                            ${escapeHTML(
                                answer.topic ||
                                "Tutor Reply"
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                answer.answer ||
                                answer.message ||
                                answer.reply ||
                                ""
                            )}
                        </p>

                        <small>
                            ${
                                answer.created_at
                                    ? escapeHTML(
                                        new Date(
                                            answer.created_at
                                        ).toLocaleString(
                                            "en-KE"
                                        )
                                    )
                                    : ""
                            }
                        </small>

                    </article>
                `;
            })
            .join("");
}

/* =========================================================
   COURSE SEARCH
========================================================= */

function setupCourseSearch() {
    const input =
        $("courseSearch");

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            if (!query) {
                renderCourses();
                return;
            }

            const filtered =
                allCourses.filter(
                    course => {

                        const title =
                            String(
                                course.title ||
                                ""
                            ).toLowerCase();

                        const description =
                            String(
                                course.description ||
                                ""
                            ).toLowerCase();

                        return (
                            title.includes(query) ||
                            description.includes(query)
                        );
                    }
                );

            const original =
                allCourses;

            allCourses =
                filtered;

            renderCourses();

            allCourses =
                original;
        }
    );
}

/* =========================================================
   NOTES SEARCH
========================================================= */

function setupNotesSearch() {
    const input =
        $("notesSearch");

    if (!input) {
        return;
    }

    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            const area =
                $("notesGrid");

            if (!area) {
                return;
            }

            if (!query) {
                renderNotes();
                return;
            }

            const filtered =
                allNotes.filter(
                    note => {

                        const text =
                            [
                                note.file_name,
                                note.course,
                                note.unit
                            ]
                                .filter(Boolean)
                                .join(" ")
                                .toLowerCase();

                        return text.includes(
                            query
                        );
                    }
                );

            if (!filtered.length) {

                area.innerHTML = `
                    <div class="empty-state">
                        No notes match your search.
                    </div>
                `;

                return;
            }

            area.innerHTML =
                filtered
                    .map(createNoteCard)
                    .join("");
        }
    );
}

/* =========================================================
   HASH NAVIGATION
========================================================= */

function handleInitialHash() {
    const hash =
        window.location.hash;

    if (!hash) {
        return;
    }

    const id =
        hash.replace(
            "#",
            ""
        );

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    setTimeout(
        () => {

            element.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        },
        300
    );
}

/* =========================================================
   WHATSAPP
========================================================= */

function setupWhatsAppButton() {
    const links =
        document.querySelectorAll(
            ".whatsapp-float"
        );

    links.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                console.log(
                    "Opening Mwaniki Scholars WhatsApp Channel"
                );

            }
        );
    });
}

/* =========================================================
   TRACK COURSE / UNIT
========================================================= */

window.mwanikiTrackUnit =
    function (
        courseId,
        unitId,
        unitTitle
    ) {

        if (
            courseId !== undefined &&
            courseId !== null
        ) {

            localStorage.setItem(
                "selectedCourse",
                String(courseId)
            );
        }

        if (
            unitId !== undefined &&
            unitId !== null
        ) {

            localStorage.setItem(
                "selectedUnit",
                String(unitId)
            );
        }

        if (unitTitle) {

            localStorage.setItem(
                "selectedUnitTitle",
                String(unitTitle)
            );
        }
    };

/* =========================================================
   PUBLIC DASHBOARD API
========================================================= */

window.mwanikiDashboard = {

    getCurrentUser() {
        return currentUser;
    },

    getCurrentStudent() {
        return currentStudent;
    },

    getCourses() {
        return allCourses;
    },

    getNotes() {
        return allNotes;
    },

    getQuizzes() {
        return allQuizzes;
    },

    async refresh() {

        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        renderRecentlyStudied();
        renderAchievements();
    }
};

/* =========================================================
   AUTH LISTENER
========================================================= */

function setupAuthListener() {

    supabase.auth.onAuthStateChange(
        (event, session) => {

            if (
                event === "SIGNED_OUT"
            ) {

                window.location.href =
                    "./index.html";

                return;
            }

            if (
                (
                    event === "SIGNED_IN" ||
                    event === "TOKEN_REFRESHED"
                ) &&
                session?.user
            ) {

                currentUser =
                    session.user;

                updateStudentIdentity();
                updateStudentPhoto();
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

    updateCurrentDate();

    /*
       Attach ALL click handlers before
       waiting for Supabase requests.
    */

    setupNavigation();

    setupScrollNavigation();

    setupStudentProfileButton();

    setupNotificationButton();

    setupAITutor();

    setupTutorMessaging();

    setupStudentInbox();

    setupCourseSearch();

    setupNotesSearch();

    setupRecentActivity();

    setupWhatsAppButton();

    setupAuthListener();

    /*
       Load authenticated student.
    */

    const authenticated =
        await loadStudentProfile();

    if (!authenticated) {
        return;
    }

    /*
       Load dashboard data.
    */

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizzes()
    ]);

    updateQuizProgress();

    renderRecentlyStudied();

    renderAchievements();

    handleInitialHash();

    dashboardReady =
        true;

    console.log(
        "✅ Mwaniki Scholars dashboard ready"
    );
}

/* =========================================================
   START
========================================================= */

if (
    document.readyState === "loading"
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
