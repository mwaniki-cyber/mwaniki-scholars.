import { supabase } from "./supabase.js";

/* =====================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
===================================================== */

console.log("Mwaniki Scholars dashboard loading...");


/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;


/* =====================================================
   HELPERS
===================================================== */

function $(selector) {
    return document.querySelector(selector);
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


function getInitials(name) {

    if (!name) {
        return "M";
    }

    const words = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 1) {
        return words[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


function updateCurrentDate() {

    const element = $("#currentDate");

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


/* =====================================================
   STUDENT IDENTITY
===================================================== */

function updateStudentIdentity() {

    const name =
        currentStudent?.full_name ||
        currentUser?.user_metadata?.full_name ||
        "Student";

    const initials =
        getInitials(name);


    const welcomeName =
        $("#welcomeName");

    if (welcomeName) {
        welcomeName.textContent = name;
    }


    const headerName =
        $("#headerProfileName");

    if (headerName) {
        headerName.textContent = name;
    }


    const headerInitial =
        $("#headerProfileInitial");

    if (headerInitial) {
        headerInitial.textContent = initials;
    }


    const profileInitial =
        $("#profilePanelInitial");

    if (profileInitial) {
        profileInitial.textContent = initials;
    }


    const profileName =
        $("#profilePanelName");

    if (profileName) {
        profileName.textContent = name;
    }
}


/* =====================================================
   STUDENT PHOTO
===================================================== */

function updateStudentPhoto() {

    const photoURL =
        currentStudent?.photo_url;

    const headerPhoto =
        $("#headerProfilePhoto");

    const headerInitial =
        $("#headerProfileInitial");

    const profilePhoto =
        $("#profilePanelPhoto");

    const profileInitial =
        $("#profilePanelInitial");


    if (photoURL) {

        if (headerPhoto) {
            headerPhoto.src = photoURL;
            headerPhoto.style.display = "block";
        }

        if (headerInitial) {
            headerInitial.style.display = "none";
        }


        if (profilePhoto) {
            profilePhoto.src = photoURL;
            profilePhoto.style.display = "block";
        }

        if (profileInitial) {
            profileInitial.style.display = "none";
        }

    } else {

        if (headerPhoto) {
            headerPhoto.removeAttribute("src");
            headerPhoto.style.display = "none";
        }

        if (headerInitial) {
            headerInitial.style.display = "grid";
        }


        if (profilePhoto) {
            profilePhoto.removeAttribute("src");
            profilePhoto.style.display = "none";
        }

        if (profileInitial) {
            profileInitial.style.display = "grid";
        }
    }
}


/* =====================================================
   PROFILE DETAILS
===================================================== */

function updateProfileDetails() {

    const email =
        currentStudent?.email ||
        currentUser?.email ||
        "—";

    const course =
        currentStudent?.course ||
        "—";

    const level =
        currentStudent?.level ||
        "—";


    const emailElement =
        $("#profilePanelEmail");

    if (emailElement) {
        emailElement.textContent = email;
    }


    const courseElement =
        $("#profilePanelCourse");

    if (courseElement) {
        courseElement.textContent = course;
    }


    const levelElement =
        $("#profilePanelLevel");

    if (levelElement) {
        levelElement.textContent = level;
    }
}


/* =====================================================
   LOAD STUDENT
===================================================== */

async function loadStudentProfile() {

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

        return false;
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
            .eq("id", currentUser.id)
            .maybeSingle();


    if (error) {

        console.error(
            "Student profile error:",
            error
        );

        /*
         * Do not destroy the dashboard if the
         * profile row is temporarily unavailable.
         */
        currentStudent = {
            id: currentUser.id,
            full_name:
                currentUser.user_metadata?.full_name ||
                currentUser.email?.split("@")[0] ||
                "Student",
            email:
                currentUser.email || "",
            course: "",
            level: "",
            photo_url: ""
        };

    } else {

        currentStudent =
            data || {
                id: currentUser.id,
                full_name:
                    currentUser.user_metadata?.full_name ||
                    currentUser.email?.split("@")[0] ||
                    "Student",
                email:
                    currentUser.email || "",
                course: "",
                level: "",
                photo_url: ""
            };
    }


    updateStudentIdentity();
    updateStudentPhoto();
    updateProfileDetails();

    return true;
}


/* =====================================================
   COURSE IMAGE
===================================================== */

function getCourseImage(course) {

    if (!course) {
        return "";
    }

    const image =
        course.image;

    if (
        typeof image !== "string" ||
        !image.trim()
    ) {
        return "";
    }

    return image.trim();
}


/* =====================================================
   COURSE URL
===================================================== */

function getCourseURL(course) {

    if (!course) {
        return "./course.html";
    }

    const params =
        new URLSearchParams();

    params.set(
        "course_id",
        String(course.id)
    );

    return (
        "./course.html?" +
        params.toString()
    );
}


/* =====================================================
   OPEN COURSE
===================================================== */

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


    window.location.href =
        getCourseURL(course);
}


/* =====================================================
   COURSE CARD
===================================================== */

function createCourseCard(course) {

    const card =
        document.createElement("article");

    card.className =
        "course-card";


    const title =
        escapeHTML(
            course?.title ||
            "Untitled Course"
        );


    const description =
        escapeHTML(
            course?.description ||
            "Explore this medical course and begin studying."
        );


    const image =
        getCourseImage(course);


    let visual = "";


    if (image) {

        visual = `
            <div class="course-card-visual">

                <img
                    src="${escapeHTML(image)}"
                    alt="${title}"
                    class="course-card-image"
                    loading="lazy"
                    onerror="
                        this.style.display='none';
                        this.nextElementSibling.style.display='block';
                    "
                >

                <div
                    class="course-card-placeholder"
                    aria-hidden="true"
                    style="display:none;"
                ></div>

            </div>
        `;

    } else {

        /*
         * No 📚 icon here.
         * The course card now uses a clean
         * medical-academic visual background.
         */

        visual = `
            <div class="course-card-visual">

                <div
                    class="course-card-placeholder"
                    aria-hidden="true"
                ></div>

            </div>
        `;
    }


    card.innerHTML = `
        ${visual}

        <div class="course-card-body">

            <h3>
                ${title}
            </h3>

            <p>
                ${description}
            </p>

            <button
                type="button"
                class="primary-button course-card-button"
            >
                Open course
            </button>

        </div>
    `;


    const button =
        card.querySelector(
            ".course-card-button"
        );


    if (button) {

        button.addEventListener(
            "click",
            () => openCourse(course)
        );
    }


    return card;
}


/* =====================================================
   RENDER COURSES
===================================================== */

function renderCourses() {

    const grid =
        $("#courseGrid");


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    if (!allCourses.length) {

        grid.innerHTML = `
            <div class="loading-state">
                No courses are currently available.
            </div>
        `;

        return;
    }


    const fragment =
        document.createDocumentFragment();


    allCourses.forEach(
        course => {

            fragment.appendChild(
                createCourseCard(course)
            );
        }
    );


    grid.appendChild(fragment);
}


/* =====================================================
   LOAD COURSES
===================================================== */

async function loadCourses() {

    const grid =
        $("#courseGrid");


    if (grid) {

        grid.innerHTML = `
            <div class="loading-state">
                Loading courses...
            </div>
        `;
    }


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


        if (grid) {

            grid.innerHTML = `
                <div class="loading-state">
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
        $("#totalCourses");

    if (totalCourses) {
        totalCourses.textContent =
            allCourses.length;
    }


    renderCourses();
    renderRecommendations();
    loadRecentCourse();
}


/* =====================================================
   RECOMMENDATIONS
===================================================== */

function renderRecommendations() {

    const grid =
        $("#recommendationsGrid");


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    if (!allCourses.length) {

        grid.innerHTML = `
            <div class="loading-state">
                No course recommendations are available.
            </div>
        `;

        return;
    }


    const recommendations =
        allCourses.slice(0, 3);


    const fragment =
        document.createDocumentFragment();


    recommendations.forEach(
        course => {

            fragment.appendChild(
                createCourseCard(course)
            );
        }
    );


    grid.appendChild(fragment);
}


/* =====================================================
   RECENT COURSE
===================================================== */

function loadRecentCourse() {

    const titleElement =
        $("#recentCourseTitle");

    const descriptionElement =
        $("#recentCourseDescription");

    const button =
        $("#recentCourseButton");

    const imageElement =
        $("#recentCourseImage");

    const placeholderElement =
        $("#recentCourseImagePlaceholder");


    let recentCourse = null;


    try {

        const saved =
            localStorage.getItem(
                "mwanikiLastCourse"
            );


        if (saved) {

            const parsed =
                JSON.parse(saved);


            recentCourse =
                allCourses.find(
                    course =>
                        String(course.id) ===
                        String(parsed.id)
                ) || null;
        }

    } catch (error) {

        console.warn(
            "Recent course data could not be read:",
            error
        );
    }


    if (!recentCourse) {

        if (titleElement) {
            titleElement.textContent =
                "No recent course";
        }

        if (descriptionElement) {
            descriptionElement.textContent =
                "Select a course from your library to begin.";
        }

        if (button) {

            button.textContent =
                "Browse courses";

            button.onclick = () => {

                document
                    .getElementById("courses")
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });
            };
        }


        if (imageElement) {
            imageElement.style.display =
                "none";
        }

        if (placeholderElement) {
            placeholderElement.style.display =
                "block";
        }

        return;
    }


    if (titleElement) {

        titleElement.textContent =
            recentCourse.title ||
            "Recent course";
    }


    if (descriptionElement) {

        descriptionElement.textContent =
            recentCourse.description ||
            "Continue studying this course.";
    }


    if (button) {

        button.textContent =
            "Continue course";

        button.onclick = () =>
            openCourse(recentCourse);
    }


    const image =
        getCourseImage(recentCourse);


    if (image) {

        if (imageElement) {

            imageElement.src =
                image;

            imageElement.alt =
                recentCourse.title ||
                "Recent course";

            imageElement.style.display =
                "block";


            imageElement.onerror = () => {

                imageElement.style.display =
                    "none";

                if (placeholderElement) {
                    placeholderElement.style.display =
                        "block";
                }
            };
        }


        if (placeholderElement) {

            placeholderElement.style.display =
                "none";
        }

    } else {

        if (imageElement) {

            imageElement.removeAttribute(
                "src"
            );

            imageElement.style.display =
                "none";
        }

        if (placeholderElement) {

            placeholderElement.style.display =
                "block";
        }
    }
}


/* =====================================================
   NOTE CARD
===================================================== */

function createNoteCard(note) {

    const card =
        document.createElement("article");

    card.className =
        "note-card";


    const courseName =
        escapeHTML(
            note.course ||
            "Medical Learning"
        );


    const unitName =
        escapeHTML(
            note.unit ||
            "Study material"
        );


    const fileName =
        escapeHTML(
            note.file_name ||
            "Learning notes"
        );


    let dateText =
        "";


    if (note.created_at) {

        const date =
            new Date(note.created_at);


        if (!Number.isNaN(date.getTime())) {

            dateText =
                date.toLocaleDateString(
                    undefined,
                    {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                    }
                );
        }
    }


    card.innerHTML = `
        <div class="note-card-meta">

            <span class="note-card-course">
                ${courseName}
            </span>

            <span class="note-card-date">
                ${escapeHTML(dateText)}
            </span>

        </div>

        <h3>
            ${fileName}
        </h3>

        <p class="note-card-unit">
            ${unitName}
        </p>

        <a
            href="${escapeHTML(note.file_url || "#")}"
            target="_blank"
            rel="noopener noreferrer"
            class="primary-button note-card-button"
        >
            Open notes
        </a>
    `;


    return card;
}


/* =====================================================
   RENDER NOTES
===================================================== */

function renderNotes() {

    const grid =
        $("#notesGrid");


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    if (!allNotes.length) {

        grid.innerHTML = `
            <div class="loading-state">
                No published notes are available yet.
            </div>
        `;

        return;
    }


    const fragment =
        document.createDocumentFragment();


    allNotes.forEach(
        note => {

            fragment.appendChild(
                createNoteCard(note)
            );
        }
    );


    grid.appendChild(fragment);
}


/* =====================================================
   LOAD NOTES
===================================================== */

async function loadNotes() {

    const grid =
        $("#notesGrid");


    if (grid) {

        grid.innerHTML = `
            <div class="loading-state">
                Loading notes...
            </div>
        `;
    }


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


        if (grid) {

            grid.innerHTML = `
                <div class="loading-state">
                    Unable to load notes.
                    Please check your notes access policy
                    and refresh the dashboard.
                </div>
            `;
        }

        return;
    }


    allNotes =
        Array.isArray(data)
            ? data
            : [];


    const totalNotes =
        $("#totalNotes");

    if (totalNotes) {

        totalNotes.textContent =
            allNotes.length;
    }


    renderNotes();
}


/* =====================================================
   LOAD QUIZZES
===================================================== */

async function loadQuizzes() {

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

        updateQuizProgress();

        return;
    }


    allQuizzes =
        Array.isArray(data)
            ? data
            : [];


    const totalQuizzes =
        $("#totalQuizzes");

    if (totalQuizzes) {

        totalQuizzes.textContent =
            allQuizzes.length;
    }


    updateQuizProgress();
}


/* =====================================================
   QUIZ PROGRESS
===================================================== */

function calculateQuizProgress() {

    const raw =
        localStorage.getItem(
            "mwanikiQuizProgress"
        );


    if (!raw) {
        return 0;
    }


    try {

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
                    Math.round(progress)
                )
            );
        }


        if (
            progress &&
            typeof progress === "object"
        ) {

            const values =
                Object.values(progress)
                    .filter(
                        value =>
                            typeof value === "number" &&
                            Number.isFinite(value)
                    );


            if (values.length) {

                const average =
                    values.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) / values.length;


                return Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(average)
                    )
                );
            }
        }

    } catch (error) {

        console.warn(
            "Quiz progress could not be read:",
            error
        );
    }


    return 0;
}


/* =====================================================
   UPDATE QUIZ PROGRESS
===================================================== */

function updateQuizProgress() {

    const progress =
        calculateQuizProgress();


    const progressText =
        $("#learningProgress");


    const progressBar =
        $("#learningProgressBar");


    if (progressText) {

        progressText.textContent =
            `${progress}%`;
    }


    if (progressBar) {

        progressBar.style.width =
            `${progress}%`;
    }
}


/* =====================================================
   NAVIGATION
===================================================== */

function setupNavigation() {

    const links =
        document.querySelectorAll(
            ".nav-link"
        );


    links.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    links.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    if (
                        link.getAttribute("href")
                            ?.startsWith("#")
                    ) {

                        link.classList.add(
                            "active"
                        );
                    }
                }
            );
        }
    );
}


/* =====================================================
   PROFILE PANEL
===================================================== */

function setupProfilePanel() {

    const openButton =
        $("#profileButton");

    const panel =
        $("#profilePanel");

    const closeButton =
        $("#closeProfilePanel");


    if (!openButton || !panel) {
        return;
    }


    openButton.addEventListener(
        "click",
        () => {

            panel.classList.add(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    );


    closeButton?.addEventListener(
        "click",
        () => {

            panel.classList.remove(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    );
}


/* =====================================================
   NOTIFICATION PANEL
===================================================== */

function setupNotificationPanel() {

    const openButton =
        $("#notificationButton");

    const panel =
        $("#notificationPanel");

    const closeButton =
        $("#closeNotificationPanel");


    if (!openButton || !panel) {
        return;
    }


    openButton.addEventListener(
        "click",
        () => {

            panel.classList.add(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    );


    closeButton?.addEventListener(
        "click",
        () => {

            panel.classList.remove(
                "open"
            );

            panel.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    );
}


/* =====================================================
   LOGOUT
===================================================== */

function setupLogout() {

    const button =
        $("#logoutButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "Logging out...";


            const {
                error
            } =
                await supabase.auth.signOut();


            if (error) {

                console.error(
                    "Logout error:",
                    error
                );


                button.disabled = false;

                button.textContent =
                    "Log out";

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

            localStorage.removeItem(
                "mwanikiLastCourse"
            );


            window.location.href =
                "./index.html";
        }
    );
}


/* =====================================================
   REFRESH BUTTONS
===================================================== */

function setupRefreshButtons() {

    const coursesButton =
        $("#refreshCoursesButton");

    const notesButton =
        $("#refreshNotesButton");


    coursesButton?.addEventListener(
        "click",
        async () => {

            coursesButton.disabled = true;

            coursesButton.textContent =
                "Refreshing...";


            await loadCourses();


            coursesButton.disabled = false;

            coursesButton.textContent =
                "Refresh courses";
        }
    );


    notesButton?.addEventListener(
        "click",
        async () => {

            notesButton.disabled = true;

            notesButton.textContent =
                "Refreshing...";


            await loadNotes();


            notesButton.disabled = false;

            notesButton.textContent =
                "Refresh notes";
        }
    );
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


    if (target) {

        setTimeout(
            () => {

                target.scrollIntoView({
                    behavior: "smooth"
                });

            },
            300
        );
    }
}


/* =====================================================
   SCROLL NAVIGATION
===================================================== */

function setupScrollNavigation() {

    const sections = [
        "overviewSection",
        "courses",
        "notes",
        "quiz-centre",
        "learning-support"
    ];


    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (!entry.isIntersecting) {
                            return;
                        }


                        let targetHash =
                            "";


                        if (
                            entry.target.id ===
                            "overviewSection"
                        ) {

                            targetHash =
                                "#overview";

                        } else if (
                            entry.target.id ===
                            "courses"
                        ) {

                            targetHash =
                                "#courses";

                        } else if (
                            entry.target.id ===
                            "notes"
                        ) {

                            targetHash =
                                "#notes";

                        } else if (
                            entry.target.id ===
                            "quiz-centre"
                        ) {

                            targetHash =
                                "#quizzes";
                        }


                        if (!targetHash) {
                            return;
                        }


                        document
                            .querySelectorAll(
                                ".nav-link"
                            )
                            .forEach(
                                link =>
                                    link.classList.remove(
                                        "active"
                                    )
                            );


                        const activeLink =
                            document.querySelector(
                                `.nav-link[href="${targetHash}"]`
                            );


                        activeLink?.classList.add(
                            "active"
                        );
                    }
                );

            },
            {
                threshold: 0.35
            }
        );


    sections.forEach(
        id => {

            const section =
                document.getElementById(
                    id
                );


            if (section) {
                observer.observe(
                    section
                );
            }
        }
    );
}


/* =====================================================
   UNIT TRACKING
===================================================== */

window.mwanikiTrackUnit =
    function (
        courseId,
        unitId,
        unitTitle
    ) {

        localStorage.setItem(
            "selectedCourse",
            String(courseId)
        );

        localStorage.setItem(
            "selectedUnit",
            String(unitId)
        );

        localStorage.setItem(
            "selectedUnitTitle",
            unitTitle || ""
        );
    };


/* =====================================================
   GLOBAL DASHBOARD API
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

    async refresh() {

        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);
    }
};


/* =====================================================
   AUTH LISTENER
===================================================== */

function setupAuthListener() {

    supabase.auth.onAuthStateChange(
        (event, session) => {

            if (
                event === "SIGNED_OUT" ||
                !session
            ) {

                window.location.href =
                    "./index.html";
            }
        }
    );
}


/* =====================================================
   INITIALIZE
===================================================== */

async function initializeDashboard() {

    if (dashboardReady) {
        return;
    }


    dashboardReady = true;


    updateCurrentDate();


    const authenticated =
        await loadStudentProfile();


    if (!authenticated) {
        return;
    }


    setupNavigation();
    setupProfilePanel();
    setupNotificationPanel();
    setupLogout();
    setupRefreshButtons();


    await Promise.all([
        loadCourses(),
        loadNotes(),
        loadQuizzes()
    ]);


    setupScrollNavigation();
    handleInitialHash();


    console.log(
        "Mwaniki Scholars dashboard ready."
    );
}


/* =====================================================
   START
===================================================== */

setupAuthListener();

initializeDashboard();
