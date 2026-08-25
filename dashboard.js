```javascript
import { supabase } from "./supabase.js";

// ======================================================
// MWANIKI SCHOLARS STUDENT DASHBOARD
// STUDENT PROFILE + NOTES + PROGRESS
// COURSES ARE HANDLED BY courses.js
// ======================================================

console.log("🎓 Mwaniki Scholars Dashboard starting...");


// ======================================================
// GLOBAL STUDENT DATA
// ======================================================

let currentUser = null;
let currentStudent = null;


// ======================================================
// LOAD LOGGED-IN STUDENT PROFILE
// ======================================================

async function loadStudentProfile() {

    try {

        const {
            data: {
                session
            },
            error: sessionError
        } = await supabase.auth.getSession();


        if (sessionError) {

            console.error(
                "SESSION ERROR:",
                sessionError
            );

            return;

        }


        // --------------------------------------------------
        // NO ACTIVE SESSION
        // --------------------------------------------------

        if (!session || !session.user) {

            console.warn(
                "⚠️ No active student session."
            );

            return;

        }


        currentUser =
            session.user;


        console.log(
            "👤 Logged-in user:",
            currentUser.email
        );


        // --------------------------------------------------
        // LOAD STUDENT PROFILE
        // --------------------------------------------------

        const {
            data,
            error
        } = await supabase
            .from("students")
            .select(
                "id, full_name, email, phone, course, level, photo_url"
            )
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


        if (error) {

            console.error(
                "STUDENT PROFILE ERROR:",
                error
            );

            /*
             * We still show the authenticated email.
             * This prevents the entire dashboard from breaking
             * if the students table has a temporary RLS problem.
             */

            currentStudent = {

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


        renderStudentProfile();


    } catch (error) {

        console.error(
            "PROFILE INITIALIZATION ERROR:",
            error
        );

    }

}


// ======================================================
// CREATE / UPDATE DASHBOARD PROFILE DISPLAY
// ======================================================

function renderStudentProfile() {

    if (!currentStudent) {
        return;
    }


    const name =
        currentStudent.full_name ||
        currentUser?.email?.split("@")[0] ||
        "Student";


    const email =
        currentStudent.email ||
        currentUser?.email ||
        "";


    const course =
        currentStudent.course ||
        "Course not set";


    const level =
        currentStudent.level ||
        "Level not set";


    const photo =
        currentStudent.photo_url ||
        "";


    // --------------------------------------------------
    // FIND EXISTING PROFILE AREA
    // --------------------------------------------------

    let profileArea =
        document.querySelector(".profile");


    // --------------------------------------------------
    // IF NO PROFILE AREA EXISTS, CREATE ONE
    // --------------------------------------------------

    if (!profileArea) {

        const header =
            document.querySelector("header");


        if (header) {

            profileArea =
                document.createElement("div");

            profileArea.className =
                "profile";

            header.appendChild(
                profileArea
            );

        }

    }


    if (!profileArea) {
        return;
    }


    // --------------------------------------------------
    // PROFILE BUTTON / DISPLAY
    // --------------------------------------------------

    profileArea.innerHTML = `

        <button
            id="studentProfileButton"
            type="button"
            style="
                display:flex;
                align-items:center;
                gap:10px;
                border:none;
                background:white;
                color:#063970;
                padding:8px 15px;
                border-radius:30px;
                cursor:pointer;
                font-weight:600;
            "
        >

            ${
                photo

                ?

                `
                <img
                    src="${escapeHTML(photo)}"
                    alt="Profile"
                    style="
                        width:38px;
                        height:38px;
                        border-radius:50%;
                        object-fit:cover;
                        border:2px solid #0b7285;
                    "
                >
                `

                :

                `
                <span
                    style="
                        width:38px;
                        height:38px;
                        border-radius:50%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#e6f4f7;
                        font-size:20px;
                    "
                >
                    👤
                </span>
                `
            }

            <span>
                ${escapeHTML(name)}
            </span>

        </button>

    `;


    const profileButton =
        document.getElementById(
            "studentProfileButton"
        );


    if (profileButton) {

        profileButton.addEventListener(
            "click",
            function () {

                window.location.href =
                    "studentProfile.html";

            }
        );

    }


    // --------------------------------------------------
    // UPDATE DASHBOARD WELCOME TEXT
    // --------------------------------------------------

    updateWelcomeText(
        name,
        email,
        course,
        level
    );

}


// ======================================================
// UPDATE WELCOME SECTION
// ======================================================

function updateWelcomeText(
    name,
    email,
    course,
    level
) {

    /*
     * Look for an existing dashboard heading.
     * We deliberately do not replace the entire dashboard,
     * because courses.js and quiz.js use existing elements.
     */

    const headings =
        document.querySelectorAll(
            "h1, h2"
        );


    let welcomeHeading = null;


    headings.forEach(
        heading => {

            const text =
                heading.textContent
                    .toLowerCase();


            if (
                text.includes("student learning dashboard")
            ) {

                welcomeHeading =
                    heading;

            }

        }
    );


    if (welcomeHeading) {

        welcomeHeading.innerHTML = `
            🎓 Welcome, ${escapeHTML(name)}
        `;

    }


    // --------------------------------------------------
    // CREATE SMALL PERSONAL INFO CARD
    // --------------------------------------------------

    let existingCard =
        document.getElementById(
            "studentPersonalCard"
        );


    if (existingCard) {
        return;
    }


    const container =
        document.querySelector(
            ".container"
        );


    if (!container) {
        return;
    }


    existingCard =
        document.createElement("div");

    existingCard.id =
        "studentPersonalCard";

    existingCard.className =
        "card";


    existingCard.style.cssText = `

        background:
            linear-gradient(
                135deg,
                #063970,
                #0b7285
            );

        color:white;
        border-radius:20px;
        padding:22px;
        margin-bottom:25px;
        box-shadow:
            0 10px 30px
            rgba(0,0,0,.12);

    `;


    existingCard.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:18px;
                flex-wrap:wrap;
            "
        >

            ${
                currentStudent.photo_url

                ?

                `
                <img
                    src="${escapeHTML(
                        currentStudent.photo_url
                    )}"
                    alt="Student profile"
                    style="
                        width:75px;
                        height:75px;
                        border-radius:50%;
                        object-fit:cover;
                        border:3px solid white;
                    "
                >
                `

                :

                `
                <div
                    style="
                        width:75px;
                        height:75px;
                        border-radius:50%;
                        background:
                            rgba(255,255,255,.18);
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:38px;
                    "
                >
                    👤
                </div>
                `
            }


            <div>

                <div
                    style="
                        font-size:23px;
                        font-weight:bold;
                        margin-bottom:5px;
                    "
                >
                    ${escapeHTML(name)}
                </div>


                <div
                    style="
                        opacity:.9;
                        font-size:14px;
                    "
                >
                    📧 ${escapeHTML(email)}
                </div>


                <div
                    style="
                        margin-top:6px;
                        font-size:14px;
                    "
                >
                    🎓 ${escapeHTML(course)}
                    &nbsp; • &nbsp;
                    📚 ${escapeHTML(level)}
                </div>

            </div>


            <div
                style="
                    margin-left:auto;
                "
            >

                <button
                    id="openProfileButton"
                    type="button"
                    style="
                        background:white;
                        color:#063970;
                        border:none;
                        padding:11px 17px;
                        border-radius:10px;
                        cursor:pointer;
                        font-weight:bold;
                    "
                >
                    👤 My Profile
                </button>

            </div>

        </div>

    `;


    /*
     * Insert personal card immediately after the header
     * and before the course library.
     */

    const firstCard =
        container.querySelector(
            ".card"
        );


    if (firstCard) {

        container.insertBefore(
            existingCard,
            firstCard
        );

    } else {

        container.prepend(
            existingCard
        );

    }


    const openProfileButton =
        document.getElementById(
            "openProfileButton"
        );


    if (openProfileButton) {

        openProfileButton.addEventListener(
            "click",
            function () {

                window.location.href =
                    "studentProfile.html";

            }
        );

    }

}


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {

        return "";

    }


    return String(value)

        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ======================================================
// LOAD NOTES
// ======================================================

async function loadNotes() {

    const notesBox =
        document.getElementById(
            "notesArea"
        );


    if (!notesBox) {

        console.warn(
            "notesArea not found"
        );

        return;

    }


    notesBox.innerHTML =
        "⏳ Loading notes...";


    const {
        data,
        error
    } =
        await supabase
            .from("notes")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "NOTES ERROR:",
            error
        );


        notesBox.innerHTML =
            "❌ " +
            error.message;

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        notesBox.innerHTML =
            "📄 No notes uploaded yet.";

        return;

    }


    notesBox.innerHTML = "";


    data.forEach(
        note => {

            const course =
                note.course ||
                "Course";


            const unit =
                note.unit ||
                "Unit";


            /*
             * Your table uses file_name,
             * not filename.
             *
             * We support both so old records
             * do not break.
             */

            const filename =
                note.file_name ||
                note.filename ||
                "";


            if (!filename) {
                return;
            }


            let noteURL =
                note.file_url ||
                "";


            /*
             * If file_url exists, use it directly.
             * Otherwise fall back to the GitHub notes folder.
             */

            if (!noteURL) {

                noteURL =
                    "https://github.com/mwaniki-cyber/mwaniki-scholars./blob/main/notes/"
                    +
                    encodeURIComponent(
                        filename
                    );

            }


            notesBox.innerHTML += `

                <div
                    class="note-card"
                    style="
                        background:white;
                        padding:18px;
                        margin:12px 0;
                        border-radius:14px;
                        box-shadow:
                            0 5px 15px
                            rgba(0,0,0,.06);
                    "
                >

                    <h3>
                        📚 ${escapeHTML(course)}
                    </h3>


                    <p>
                        📝 ${escapeHTML(unit)}
                    </p>


                    <p>
                        📄 ${escapeHTML(filename)}
                    </p>


                    <a
                        href="${escapeHTML(noteURL)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >

                        <button
                            type="button"
                        >
                            📄 Open Notes
                        </button>

                    </a>

                </div>

            `;

        }
    );

}


// ======================================================
// SEARCH NOTES
// ======================================================

const notesSearch =
    document.getElementById(
        "notesSearch"
    );


if (notesSearch) {

    notesSearch.addEventListener(
        "input",
        function () {

            const search =
                this.value
                    .toLowerCase()
                    .trim();


            document
                .querySelectorAll(
                    ".note-card"
                )
                .forEach(
                    card => {

                        const text =
                            card.textContent
                                .toLowerCase();


                        card.style.display =
                            text.includes(search)
                                ? ""
                                : "none";

                    }
                );

        }
    );

}


// ======================================================
// QUIZ PROGRESS
// ======================================================

function updateProgressDisplay() {

    const progressBox =
        document.getElementById(
            "progress"
        );


    if (!progressBox) {
        return;
    }


    let progress = [];


    try {

        progress =
            JSON.parse(
                localStorage.getItem(
                    "mwanikiQuizProgress"
                )
            ) || [];

    } catch (error) {

        console.warn(
            "Could not read quiz progress:",
            error
        );

        progress = [];

    }


    if (
        progress.length === 0
    ) {

        progressBox.innerHTML =
            "0%";

        return;

    }


    let totalScore = 0;
    let totalQuestions = 0;


    progress.forEach(
        item => {

            totalScore +=
                Number(
                    item.score
                ) || 0;


            totalQuestions +=
                Number(
                    item.total
                ) || 0;

        }
    );


    const percentage =
        totalQuestions > 0

            ?

            Math.round(
                (
                    totalScore /
                    totalQuestions
                ) * 100
            )

            :

            0;


    progressBox.innerHTML =
        percentage + "%";

}


// ======================================================
// LOGOUT
// ======================================================

async function logoutStudent() {

    try {

        const {
            error
        } =
            await supabase.auth.signOut();


        if (error) {

            console.error(
                "LOGOUT ERROR:",
                error
            );

            alert(
                "Unable to log out: " +
                error.message
            );

            return;

        }


        window.location.href =
            "studentLogin.html";


    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }

}


// Make logout available to HTML if needed.

window.logoutStudent =
    logoutStudent;


// ======================================================
// INITIALIZE DASHBOARD
// ======================================================

async function initializeDashboard() {

    /*
     * Load the profile first so the dashboard identifies
     * the actual logged-in student.
     */

    await loadStudentProfile();


    /*
     * Existing notes functionality.
     */

    await loadNotes();


    /*
     * Existing quiz progress functionality.
     */

    updateProgressDisplay();


    console.log(
        "✅ Student profile loaded"
    );

    console.log(
        "✅ Notes loaded"
    );

    console.log(
        "✅ Dashboard initialization complete"
    );

}


initializeDashboard();


// ======================================================
// FINAL LOG
// ======================================================

console.log(
    "🎓 Mwaniki Scholars Dashboard loaded"
);
```
