import { supabase } from "./supabase.js";


/* =====================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
===================================================== */

console.log("🚀 Mwaniki Scholars dashboard starting...");


/* =====================================================
   GLOBAL STATE
===================================================== */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;


/* =====================================================
   DOM HELPER
===================================================== */

function $(id) {
    return document.getElementById(id);
}


/* =====================================================
   SAFE HTML
===================================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   INITIALS
===================================================== */

function getInitials(name) {

    const cleanName =
        String(name || "Student").trim();

    if (!cleanName) {
        return "S";
    }

    const parts =
        cleanName
            .split(/\s+/)
            .filter(Boolean);

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


/* =====================================================
   CURRENT DATE
===================================================== */

function updateCurrentDate() {

    const element =
        $("currentDate");

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


/* =====================================================
   STUDENT IDENTITY
===================================================== */

function updateStudentIdentity(name, email) {

    const safeName =
        String(name || "Student").trim() ||
        "Student";

    const initials =
        getInitials(safeName);

    const welcomeName =
        $("welcomeName");

    const profileInitial =
        $("profileInitial");

    const profileButtonName =
        $("profileButtonName");

    const profilePanelInitial =
        $("profilePanelInitial");

    const profilePanelName =
        $("profilePanelName");

    const profilePanelEmail =
        $("profilePanelEmail");


    if (welcomeName) {
        welcomeName.textContent =
            safeName;
    }


    if (profileInitial) {
        profileInitial.textContent =
            initials;
    }


    if (profileButtonName) {
        profileButtonName.textContent =
            safeName;
    }


    if (profilePanelInitial) {
        profilePanelInitial.textContent =
            initials;
    }


    if (profilePanelName) {
        profilePanelName.textContent =
            safeName;
    }


    if (profilePanelEmail) {
        profilePanelEmail.textContent =
            String(email || "").trim() ||
            "No email available";
    }
}


/* =====================================================
   STUDENT PHOTO
===================================================== */

function updateStudentPhoto(photoUrl, name) {

    const headerPhoto =
        $("profilePhoto");

    const headerInitial =
        $("profileInitial");

    const panelPhoto =
        $("profilePanelPhoto");

    const panelInitial =
        $("profilePanelInitial");

    const url =
        String(photoUrl || "").trim();


    if (!url) {

        if (headerPhoto) {
            headerPhoto.hidden = true;
            headerPhoto.removeAttribute("src");
        }

        if (headerInitial) {
            headerInitial.hidden = false;
        }

        if (panelPhoto) {
            panelPhoto.hidden = true;
            panelPhoto.removeAttribute("src");
        }

        if (panelInitial) {
            panelInitial.hidden = false;
        }

        return;
    }


    if (headerPhoto) {

        headerPhoto.src = url;

        headerPhoto.alt =
            `${name || "Student"} profile photo`;

        headerPhoto.hidden = false;


        headerPhoto.onerror = () => {

            headerPhoto.hidden = true;

            headerPhoto.removeAttribute(
                "src"
            );

            if (headerInitial) {
                headerInitial.hidden = false;
            }
        };
    }


    if (headerInitial) {
        headerInitial.hidden = true;
    }


    if (panelPhoto) {

        panelPhoto.src = url;

        panelPhoto.alt =
            `${name || "Student"} profile photo`;

        panelPhoto.hidden = false;


        panelPhoto.onerror = () => {

            panelPhoto.hidden = true;

            panelPhoto.removeAttribute(
                "src"
            );

            if (panelInitial) {
                panelInitial.hidden = false;
            }
        };
    }


    if (panelInitial) {
        panelInitial.hidden = true;
    }
}


/* =====================================================
   PROFILE DETAILS
===================================================== */

function updateProfileDetails(student) {

    const courseElement =
        $("profilePanelCourse");

    const levelElement =
        $("profilePanelLevel");


    if (courseElement) {

        courseElement.textContent =
            String(
                student?.course ||
                "Not specified"
            );
    }


    if (levelElement) {

        levelElement.textContent =
            String(
                student?.level ||
                "Not specified"
            );
    }
}


/* =====================================================
   LOAD AUTHENTICATED STUDENT
===================================================== */

async function loadStudentProfile() {

    try {

        const {
            data: authData,
            error: authError
        } = await supabase.auth.getUser();


        if (authError) {
            throw authError;
        }


        currentUser =
            authData?.user || null;


        if (!currentUser) {

            console.warn(
                "No authenticated student found. Redirecting..."
            );

            window.location.href =
                "./index.html";

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
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


        if (error) {
            throw error;
        }


        currentStudent =
            data || null;


        const studentName =
            currentStudent?.full_name ||
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            currentUser.email?.split("@")[0] ||
            "Student";


        const studentEmail =
            currentStudent?.email ||
            currentUser.email ||
            "";


        updateStudentIdentity(
            studentName,
            studentEmail
        );


        updateStudentPhoto(
            currentStudent?.photo_url,
            studentName
        );


        updateProfileDetails(
            currentStudent || {}
        );


        return true;


    } catch (error) {

        console.error(
            "❌ Failed to load student profile:",
            error
        );


        if (currentUser) {

            const fallbackName =
                currentUser.user_metadata?.full_name ||
                currentUser.user_metadata?.name ||
                currentUser.email?.split("@")[0] ||
                "Student";


            updateStudentIdentity(
                fallbackName,
                currentUser.email || ""
            );


            updateStudentPhoto(
                null,
                fallbackName
            );
        }


        return true;
    }
}


/* =====================================================
   COURSE IMAGE
===================================================== */

function getCourseImage(course) {

    return String(
        course?.image || ""
    ).trim();
}


/* =====================================================
   COURSE URL
===================================================== */

function getCourseURL(course) {

    const id =
        course?.id;


    if (
        id === null ||
        id === undefined ||
        id === ""
    ) {
        return "./course.html";
    }


    return (
        `./course.html?course=${encodeURIComponent(id)}`
    );
}


/* =====================================================
   OPEN COURSE
===================================================== */

function openCourse(course) {

    if (!course) {
        return;
    }


    const courseId =
        course.id;

    const courseTitle =
        course.title || "Course";


    localStorage.setItem(
        "selectedCourse",
        String(courseId)
    );


    localStorage.setItem(
        "selectedCourseName",
        String(courseTitle)
    );


    localStorage.setItem(
        "mwanikiLastCourse",
        JSON.stringify({
            id: courseId,
            title: courseTitle,
            description:
                course.description || "",
            image:
                course.image || ""
        })
    );


    window.location.href =
        getCourseURL(course);
}


/* =====================================================
   COURSE CARD
===================================================== */

function createCourseCard(course) {

    const title =
        escapeHTML(
            course?.title ||
            "Untitled Course"
        );


    const description =
        escapeHTML(
            course?.description ||
            "Explore this medical course and begin learning."
        );


    const image =
        getCourseImage(course);


    let visual = "";


    if (image) {

        visual = `
            <img
                class="course-card-image"
                src="${escapeHTML(image)}"
                alt="${title}"
                loading="lazy"
            >

            <div
                class="course-card-placeholder"
                aria-hidden="true"
                hidden
            >
                📚
            </div>
        `;

    } else {

        visual = `
            <div
                class="course-card-placeholder"
                aria-hidden="true"
            >
                📚
            </div>
        `;
    }


    return `
        <article class="course-card">

            <div class="course-card-visual">

                ${visual}

            </div>


            <div class="course-card-body">

                <span class="course-card-label">
                    MEDICAL COURSE
                </span>


                <h3>
                    ${title}
                </h3>


                <p>
                    ${description}
                </p>


                <button
                    type="button"
                    class="course-card-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    <span>
                        Open Course
                    </span>

                    <span>
                        →
                    </span>
                </button>

            </div>

        </article>
    `;
}


/* =====================================================
   RENDER COURSES
===================================================== */

function renderCourses() {

    const container =
        $("courseGrid");


    if (!container) {
        return;
    }


    if (!allCourses.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    📚
                </div>

                <h3>
                    No courses available
                </h3>

                <p>
                    Courses will appear here when they
                    are available.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        allCourses
            .map(createCourseCard)
            .join("");


    container
        .querySelectorAll(
            "[data-course-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.courseId;


                    const course =
                        allCourses.find(
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


    container
        .querySelectorAll(
            ".course-card-image"
        )
        .forEach(image => {

            image.addEventListener(
                "error",
                () => {

                    image.hidden = true;

                    const placeholder =
                        image.nextElementSibling;

                    if (placeholder) {
                        placeholder.hidden = false;
                    }
                },
                {
                    once: true
                }
            );
        });
}


/* =====================================================
   LOAD COURSES
===================================================== */

async function loadCourses() {

    const container =
        $("courseGrid");


    if (container) {

        container.innerHTML = `
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
            throw error;
        }


        allCourses =
            data || [];


        const totalCourses =
            $("totalCourses");


        if (totalCourses) {

            totalCourses.textContent =
                allCourses.length;
        }


        renderCourses();

        renderRecommendations();

        loadRecentCourse();


    } catch (error) {

        console.error(
            "❌ Failed to load courses:",
            error
        );


        if (container) {

            container.innerHTML = `
                <div class="error-state">

                    <div class="empty-state-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to load courses
                    </h3>

                    <p>
                        Please refresh the dashboard
                        and try again.
                    </p>

                </div>
            `;
        }
    }
}


/* =====================================================
   RECOMMENDATIONS
===================================================== */

function renderRecommendations() {

    const container =
        $("recommendationsGrid");


    if (!container) {
        return;
    }


    if (!allCourses.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    💡
                </div>

                <h3>
                    No recommendations yet
                </h3>

                <p>
                    Course recommendations will appear
                    when courses are available.
                </p>

            </div>
        `;

        return;
    }


    const recommendations =
        allCourses.slice(0, 3);


    container.innerHTML =
        recommendations
            .map(course => {

                const title =
                    escapeHTML(
                        course.title ||
                        "Medical Course"
                    );


                const description =
                    escapeHTML(
                        course.description ||
                        "Continue your medical learning."
                    );


                return `
                    <article class="recommendation-card">

                        <div class="recommendation-icon">
                            🎓
                        </div>


                        <div class="recommendation-content">

                            <span>
                                RECOMMENDED
                            </span>


                            <h3>
                                ${title}
                            </h3>


                            <p>
                                ${description}
                            </p>


                            <button
                                type="button"
                                class="recommendation-button"
                                data-recommendation-id="${escapeHTML(course.id)}"
                            >
                                Start Learning →
                            </button>

                        </div>

                    </article>
                `;

            })
            .join("");


    container
        .querySelectorAll(
            "[data-recommendation-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset
                            .recommendationId;


                    const course =
                        allCourses.find(
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


/* =====================================================
   RECENT COURSE
===================================================== */

function loadRecentCourse() {

    const titleElement =
        $("recentCourseTitle");

    const descriptionElement =
        $("recentCourseDescription");

    const imageElement =
        $("recentCourseImage");

    const placeholderElement =
        $("recentCourseImagePlaceholder");

    const continueButton =
        $("continueRecentCourse");


    if (!titleElement) {
        return;
    }


    let recentCourse = null;


    try {

        const stored =
            localStorage.getItem(
                "mwanikiLastCourse"
            );


        if (stored) {

            recentCourse =
                JSON.parse(stored);
        }


    } catch (error) {

        console.warn(
            "Could not read recent course:",
            error
        );
    }


    if (recentCourse?.id) {

        const matchingCourse =
            allCourses.find(
                course =>
                    String(course.id) ===
                    String(recentCourse.id)
            );


        if (matchingCourse) {

            recentCourse =
                matchingCourse;
        }
    }


    if (!recentCourse) {

        titleElement.textContent =
            "No recent course";


        if (descriptionElement) {

            descriptionElement.textContent =
                "Choose a course from your course library to begin learning.";
        }


        if (imageElement) {

            imageElement.hidden = true;

            imageElement.removeAttribute(
                "src"
            );
        }


        if (placeholderElement) {

            placeholderElement.hidden =
                false;
        }


        if (continueButton) {

            continueButton.disabled =
                true;

            continueButton.textContent =
                "Choose a Course";
        }


        return;
    }


    titleElement.textContent =
        recentCourse.title ||
        "Recent Course";


    if (descriptionElement) {

        descriptionElement.textContent =
            recentCourse.description ||
            "Continue your medical learning journey.";
    }


    const image =
        getCourseImage(recentCourse);


    if (
        imageElement &&
        image
    ) {

        imageElement.src =
            image;

        imageElement.alt =
            recentCourse.title ||
            "Recent course";

        imageElement.hidden =
            false;


        imageElement.onerror = () => {

            imageElement.hidden =
                true;

            imageElement.removeAttribute(
                "src"
            );


            if (placeholderElement) {
                placeholderElement.hidden =
                    false;
            }
        };


        if (placeholderElement) {

            placeholderElement.hidden =
                true;
        }

    } else {

        if (imageElement) {

            imageElement.hidden =
                true;

            imageElement.removeAttribute(
                "src"
            );
        }


        if (placeholderElement) {

            placeholderElement.hidden =
                false;
        }
    }


    if (continueButton) {

        continueButton.disabled =
            false;

        continueButton.textContent =
            "Continue Learning";


        continueButton.onclick =
            () => {

                openCourse(
                    recentCourse
                );
            };
    }
}


/* =====================================================
   NOTE CARD
===================================================== */

function createNoteCard(note) {

    const course =
        escapeHTML(
            note.course ||
            "Medical Course"
        );


    const unit =
        escapeHTML(
            note.unit ||
            "Study Note"
        );


    const fileName =
        escapeHTML(
            note.file_name ||
            "Learning Material"
        );


    const fileURL =
        String(
            note.file_url || ""
        ).trim();


    return `
        <article class="note-card">

            <div class="note-card-icon">
                📄
            </div>


            <div class="note-card-content">

                <span class="note-course">
                    ${course}
                </span>


                <h3>
                    ${unit}
                </h3>


                <p>
                    ${fileName}
                </p>


                ${
                    fileURL
                        ? `
                            <a
                                href="${escapeHTML(fileURL)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="note-button"
                            >
                                Open Notes →
                            </a>
                        `
                        : `
                            <span class="note-unavailable">
                                Notes unavailable
                            </span>
                        `
                }

            </div>

        </article>
    `;
}


/* =====================================================
   RENDER NOTES
===================================================== */

function renderNotes() {

    const container =
        $("notesGrid");


    if (!container) {
        return;
    }


    if (!allNotes.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-state-icon">
                    📖
                </div>

                <h3>
                    No published notes yet
                </h3>

                <p>
                    Published learning materials will
                    appear here.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        allNotes
            .map(createNoteCard)
            .join("");
}


/* =====================================================
   LOAD NOTES
===================================================== */

async function loadNotes() {

    const container =
        $("notesGrid");


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
            throw error;
        }


        allNotes =
            data || [];


        const totalNotes =
            $("totalNotes");


        if (totalNotes) {

            totalNotes.textContent =
                allNotes.length;
        }


        renderNotes();


    } catch (error) {

        console.error(
            "❌ Failed to load notes:",
            error
        );


        if (container) {

            container.innerHTML = `
                <div class="error-state">

                    <div class="empty-state-icon">
                        ⚠️
                    </div>

                    <h3>
                        Notes library could not load
                    </h3>

                    <p>
                        Please check your connection
                        and try refreshing.
                    </p>

                </div>
            `;
        }
    }
}


/* =====================================================
   LOAD QUIZZES
===================================================== */

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
            `);


        if (error) {
            throw error;
        }


        allQuizzes =
            data || [];


        const totalQuizzes =
            $("totalQuizzes");


        if (totalQuizzes) {

            totalQuizzes.textContent =
                allQuizzes.length;
        }


        updateQuizProgress();


    } catch (error) {

        console.error(
            "❌ Failed to load quizzes:",
            error
        );


        const totalQuizzes =
            $("totalQuizzes");


        if (totalQuizzes) {
            totalQuizzes.textContent =
                "0";
        }


        updateQuizProgress();
    }
}


/* =====================================================
   CALCULATE QUIZ PROGRESS
===================================================== */

function calculateQuizProgress() {

    let storedProgress = {};


    try {

        const saved =
            localStorage.getItem(
                "mwanikiQuizProgress"
            );


        if (saved) {

            storedProgress =
                JSON.parse(saved) || {};
        }


    } catch (error) {

        console.warn(
            "Could not read quiz progress:",
            error
        );

        storedProgress = {};
    }


    let completed = 0;


    if (
        storedProgress &&
        typeof storedProgress === "object"
    ) {

        Object.values(
            storedProgress
        ).forEach(value => {

            if (
                typeof value === "number"
            ) {

                if (value > 0) {
                    completed += 1;
                }

            } else if (
                Array.isArray(value)
            ) {

                completed +=
                    value.length;

            } else if (
                value &&
                typeof value === "object"
            ) {

                if (
                    value.completed === true ||
                    value.completed === 1
                ) {

                    completed += 1;

                } else if (
                    Array.isArray(value.answers)
                ) {

                    completed +=
                        value.answers.length;
                }
            }

        });
    }


    if (!allQuizzes.length) {
        return 0;
    }


    return Math.round(
        Math.min(
            100,
            (
                completed /
                allQuizzes.length
            ) * 100
        )
    );
}


/* =====================================================
   UPDATE QUIZ PROGRESS
===================================================== */

function updateQuizProgress() {

    const percentage =
        calculateQuizProgress();


    const percentElement =
        $("quizProgressPercent");

    const progressBar =
        $("quizProgressBar");

    const learningProgress =
        $("learningProgress");

    const learningProgressBar =
        $("learningProgressBar");


    if (percentElement) {

        percentElement.textContent =
            `${percentage}%`;
    }


    if (progressBar) {

        progressBar.style.width =
            `${percentage}%`;
    }


    if (learningProgress) {

        learningProgress.textContent =
            `${percentage}%`;
    }


    if (learningProgressBar) {

        learningProgressBar.style.width =
            `${percentage}%`;
    }
}


/* =====================================================
   INTERNAL SECTION NAVIGATION
===================================================== */

function setupNavigation() {

    const navLinks =
        document.querySelectorAll(
            ".dashboard-nav .nav-link"
        );


    document
        .querySelectorAll(
            'a[href^="#"]'
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                event => {

                    const targetID =
                        link.getAttribute(
                            "href"
                        );


                    if (
                        !targetID ||
                        targetID === "#"
                    ) {
                        return;
                    }


                    const target =
                        document.querySelector(
                            targetID
                        );


                    if (!target) {
                        return;
                    }


                    event.preventDefault();


                    navLinks.forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });


                    if (
                        link.classList.contains(
                            "nav-link"
                        )
                    ) {

                        link.classList.add(
                            "active"
                        );
                    }


                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            );
        });
}


/* =====================================================
   PROFILE PANEL
===================================================== */

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


    const openPanel = () => {

        panel.classList.add("open");

        panel.setAttribute(
            "aria-hidden",
            "false"
        );

        button.setAttribute(
            "aria-expanded",
            "true"
        );
    };


    const closePanel = () => {

        panel.classList.remove(
            "open"
        );

        panel.setAttribute(
            "aria-hidden",
            "true"
        );

        button.setAttribute(
            "aria-expanded",
            "false"
        );
    };


    button.addEventListener(
        "click",
        () => {

            if (
                panel.classList.contains(
                    "open"
                )
            ) {

                closePanel();

            } else {

                openPanel();
            }
        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closePanel
        );
    }


    document.addEventListener(
        "click",
        event => {

            if (
                !panel.classList.contains(
                    "open"
                )
            ) {
                return;
            }


            if (
                panel.contains(
                    event.target
                ) ||
                button.contains(
                    event.target
                )
            ) {
                return;
            }


            closePanel();
        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                panel.classList.contains(
                    "open"
                )
            ) {

                closePanel();
            }
        }
    );
}


/* =====================================================
   NOTIFICATION PANEL
===================================================== */

function setupNotificationPanel() {

    const button =
        $("notificationButton");

    const panel =
        $("notificationPanel");

    const closeButton =
        $("closeNotificationPanel");


    if (!button || !panel) {
        return;
    }


    const openPanel = () => {

        panel.classList.add(
            "open"
        );

        panel.setAttribute(
            "aria-hidden",
            "false"
        );

        button.setAttribute(
            "aria-expanded",
            "true"
        );
    };


    const closePanel = () => {

        panel.classList.remove(
            "open"
        );

        panel.setAttribute(
            "aria-hidden",
            "true"
        );

        button.setAttribute(
            "aria-expanded",
            "false"
        );
    };


    button.addEventListener(
        "click",
        () => {

            if (
                panel.classList.contains(
                    "open"
                )
            ) {

                closePanel();

            } else {

                openPanel();
            }
        }
    );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closePanel
        );
    }


    document.addEventListener(
        "click",
        event => {

            if (
                !panel.classList.contains(
                    "open"
                )
            ) {
                return;
            }


            if (
                panel.contains(
                    event.target
                ) ||
                button.contains(
                    event.target
                )
            ) {
                return;
            }


            closePanel();
        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                panel.classList.contains(
                    "open"
                )
            ) {

                closePanel();
            }
        }
    );
}


/* =====================================================
   LOGOUT
===================================================== */

function setupLogout() {

    const logoutButton =
        $("logoutButton");


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
        "click",
        async () => {

            logoutButton.disabled =
                true;

            logoutButton.textContent =
                "Logging out...";


            try {

                const {
                    error
                } =
                    await supabase.auth.signOut();


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


                logoutButton.disabled =
                    false;

                logoutButton.textContent =
                    "Log Out";


                alert(
                    "Unable to log out right now. Please try again."
                );
            }

        }
    );
}


/* =====================================================
   REFRESH BUTTONS
===================================================== */

function setupRefreshButtons() {

    const refreshCourses =
        $("refreshCoursesButton");

    const refreshNotes =
        $("refreshNotesButton");


    if (refreshCourses) {

        refreshCourses.addEventListener(
            "click",
            async () => {

                refreshCourses.disabled =
                    true;

                refreshCourses.textContent =
                    "↻ Loading...";


                await loadCourses();


                refreshCourses.disabled =
                    false;

                refreshCourses.textContent =
                    "↻ Refresh";
            }
        );
    }


    if (refreshNotes) {

        refreshNotes.addEventListener(
            "click",
            async () => {

                refreshNotes.disabled =
                    true;

                refreshNotes.textContent =
                    "↻ Loading...";


                await loadNotes();


                refreshNotes.disabled =
                    false;

                refreshNotes.textContent =
                    "↻ Refresh";
            }
        );
    }
}


/* =====================================================
   HASH NAVIGATION
===================================================== */

function handleInitialHash() {

    const hash =
        window.location.hash;


    if (!hash) {
        return;
    }


    const target =
        document.querySelector(
            hash
        );


    if (!target) {
        return;
    }


    setTimeout(
        () => {

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        },
        100
    );
}


/* =====================================================
   ACTIVE NAVIGATION ON SCROLL
===================================================== */

function setupScrollNavigation() {

    const sections = [
        "overview",
        "courses",
        "notes",
        "quizzes",
        "learning-support"
    ]
        .map(id => $(id))
        .filter(Boolean);


    const links =
        document.querySelectorAll(
            ".dashboard-nav .nav-link"
        );


    if (
        !sections.length ||
        !links.length
    ) {
        return;
    }


    const updateActiveLink = () => {

        const scrollPosition =
            window.scrollY + 180;


        let activeSection =
            "overview";


        sections.forEach(section => {

            if (
                section.offsetTop <=
                scrollPosition
            ) {

                activeSection =
                    section.id;
            }
        });


        links.forEach(link => {

            const href =
                link.getAttribute(
                    "href"
                );


            if (
                href &&
                href.startsWith("#")
            ) {

                link.classList.toggle(
                    "active",
                    href ===
                    `#${activeSection}`
                );
            }

        });
    };


    window.addEventListener(
        "scroll",
        updateActiveLink,
        {
            passive: true
        }
    );


    updateActiveLink();
}


/* =====================================================
   GLOBAL UNIT TRACKING
===================================================== */

window.mwanikiTrackUnit =
    function (
        courseId,
        unitId,
        unitTitle
    ) {

        try {

            localStorage.setItem(
                "selectedCourse",
                String(
                    courseId ?? ""
                )
            );


            localStorage.setItem(
                "selectedUnit",
                String(
                    unitId ?? ""
                )
            );


            localStorage.setItem(
                "selectedUnitTitle",
                String(
                    unitTitle ?? ""
                )
            );


        } catch (error) {

            console.warn(
                "Could not save unit progress:",
                error
            );
        }
    };


/* =====================================================
   GLOBAL DASHBOARD ACCESS
===================================================== */

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


    refresh() {

        return Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);
    }

};


/* =====================================================
   AUTH STATE LISTENER
===================================================== */

function setupAuthListener() {

    supabase.auth.onAuthStateChange(
        (event, session) => {

            console.log(
                "🔐 Auth event:",
                event
            );


            if (
                event === "SIGNED_OUT"
            ) {

                window.location.href =
                    "./index.html";

                return;
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
}


/* =====================================================
   INITIALIZE DASHBOARD
===================================================== */

async function initializeDashboard() {

    console.log(
        "📊 Initializing Mwaniki Scholars dashboard..."
    );


    updateCurrentDate();


    /* UI */

    setupNavigation();

    setupProfilePanel();

    setupNotificationPanel();

    setupLogout();

    setupRefreshButtons();

    setupScrollNavigation();

    setupAuthListener();


    /* AUTHENTICATED STUDENT */

    const authenticated =
        await loadStudentProfile();


    if (!authenticated) {
        return;
    }


    /* DASHBOARD DATA */

    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizzes()
    ]);


    dashboardReady =
        true;


    handleInitialHash();


    console.log(
        "✅ Mwaniki Scholars dashboard ready."
    );
}


/* =====================================================
   START
===================================================== */

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
