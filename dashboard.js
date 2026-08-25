```javascript
import { supabase } from "./supabase.js";

console.log("🎓 Mwaniki Scholars Dashboard starting...");


// ======================================================
// STUDENT PROFILE
// ======================================================

async function loadStudentProfile() {

    try {

        const {
            data: sessionData,
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
            console.error("Session error:", sessionError);
            return;
        }

        const session = sessionData.session;

        if (!session || !session.user) {

            console.warn("No logged-in student.");

            return;
        }

        const user = session.user;

        console.log("👤 Logged-in user:", user.email);


        // ==================================================
        // GET STUDENT PROFILE
        // ==================================================

        const {
            data: student,
            error: studentError
        } = await supabase
            .from("students")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();


        if (studentError) {

            console.error(
                "Student profile error:",
                studentError
            );

            showStudentProfile({

                full_name:
                    user.user_metadata?.full_name ||
                    user.email?.split("@")[0] ||
                    "Student",

                email:
                    user.email || "",

                course: "",
                level: "",
                photo_url: ""

            });

            return;
        }


        if (student) {

            console.log(
                "✅ Student profile found:",
                student
            );

            showStudentProfile(student);

        } else {

            console.warn(
                "⚠️ No student profile found."
            );

            showStudentProfile({

                full_name:
                    user.user_metadata?.full_name ||
                    user.email?.split("@")[0] ||
                    "Student",

                email:
                    user.email || "",

                course: "",
                level: "",
                photo_url: ""

            });

        }

    } catch (error) {

        console.error(
            "Profile loading failed:",
            error
        );

    }

}


// ======================================================
// SHOW STUDENT PROFILE
// ======================================================

function showStudentProfile(student) {

    const name =
        student.full_name ||
        "Student";

    const email =
        student.email ||
        "";

    const course =
        student.course ||
        "Course not set";

    const level =
        student.level ||
        "Level not set";

    const photo =
        student.photo_url ||
        "";


    // ==================================================
    // CHANGE HEADER PROFILE
    // ==================================================

    const profile =
        document.querySelector(".profile");

    if (profile) {

        profile.innerHTML = `

            <div
                id="profileMenu"
                style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                    cursor:pointer;
                    background:white;
                    color:#063970;
                    padding:7px 14px;
                    border-radius:30px;
                    font-weight:600;
                "
            >

                ${
                    photo

                    ?

                    `<img
                        src="${photo}"
                        alt="Profile"
                        style="
                            width:40px;
                            height:40px;
                            object-fit:cover;
                            border-radius:50%;
                        "
                    >`

                    :

                    `<div
                        style="
                            width:40px;
                            height:40px;
                            border-radius:50%;
                            background:#e6f4f7;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:21px;
                        "
                    >
                        👤
                    </div>`
                }

                <span>
                    ${name}
                </span>

            </div>

        `;


        const profileMenu =
            document.getElementById(
                "profileMenu"
            );


        if (profileMenu) {

            profileMenu.onclick =
                function () {

                    window.location.href =
                        "studentProfile.html";

                };

        }

    }


    // ==================================================
    // CREATE PERSONAL PROFILE CARD
    // ==================================================

    const container =
        document.querySelector(".container");


    if (!container) {

        console.warn(
            "Dashboard .container not found."
        );

        return;
    }


    // Remove an old card if one exists.

    const oldCard =
        document.getElementById(
            "studentPersonalCard"
        );

    if (oldCard) {
        oldCard.remove();
    }


    const card =
        document.createElement("div");


    card.id =
        "studentPersonalCard";


    card.style.cssText = `

        background:
            linear-gradient(
                135deg,
                #063970,
                #0b7285
            );

        color:white;
        padding:25px;
        border-radius:20px;
        margin-bottom:25px;

        box-shadow:
            0 10px 30px
            rgba(0,0,0,.12);

    `;


    card.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:20px;
                flex-wrap:wrap;
            "
        >

            ${
                photo

                ?

                `<img
                    src="${photo}"
                    alt="Student profile"
                    style="
                        width:80px;
                        height:80px;
                        border-radius:50%;
                        object-fit:cover;
                        border:3px solid white;
                    "
                >`

                :

                `<div
                    style="
                        width:80px;
                        height:80px;
                        border-radius:50%;
                        background:
                            rgba(255,255,255,.18);
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:40px;
                    "
                >
                    👤
                </div>`
            }


            <div>

                <div
                    style="
                        font-size:25px;
                        font-weight:bold;
                    "
                >
                    Welcome, ${name}
                </div>


                <div
                    style="
                        margin-top:6px;
                        opacity:.9;
                    "
                >
                    📧 ${email}
                </div>


                <div
                    style="
                        margin-top:7px;
                    "
                >
                    🎓 ${course}
                    &nbsp; • &nbsp;
                    📚 ${level}
                </div>

            </div>


            <button
                id="openStudentProfile"
                type="button"
                style="
                    margin-left:auto;
                    background:white;
                    color:#063970;
                    border:none;
                    padding:12px 18px;
                    border-radius:10px;
                    cursor:pointer;
                    font-weight:bold;
                "
            >
                👤 My Profile
            </button>

        </div>

    `;


    // Put profile card before dashboard cards.

    const firstCard =
        container.querySelector(".card");


    if (firstCard) {

        container.insertBefore(
            card,
            firstCard
        );

    } else {

        container.prepend(card);

    }


    const profileButton =
        document.getElementById(
            "openStudentProfile"
        );


    if (profileButton) {

        profileButton.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };

    }

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

            const filename =
                note.file_name ||
                note.filename ||
                "";

            if (!filename) {
                return;
            }


            const url =
                note.file_url ||
                (
                    "https://github.com/mwaniki-cyber/mwaniki-scholars./blob/main/notes/" +
                    encodeURIComponent(filename)
                );


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
                        📚 ${course}
                    </h3>

                    <p>
                        📝 ${unit}
                    </p>

                    <p>
                        📄 ${filename}
                    </p>

                    <a
                        href="${url}"
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
// NOTES SEARCH
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

        progress = [];

    }


    if (progress.length === 0) {

        progressBox.innerHTML =
            "0%";

        return;
    }


    let totalScore = 0;
    let totalQuestions = 0;


    progress.forEach(
        item => {

            totalScore +=
                Number(item.score) || 0;

            totalQuestions +=
                Number(item.total) || 0;

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

window.logoutStudent =
    async function () {

        const {
            error
        } =
            await supabase.auth.signOut();


        if (error) {

            alert(
                "Logout failed: " +
                error.message
            );

            return;
        }


        window.location.href =
            "studentLogin.html";

    };


// ======================================================
// INITIALIZE
// ======================================================

async function initializeDashboard() {

    await loadStudentProfile();

    await loadNotes();

    updateProgressDisplay();

    console.log(
        "✅ Dashboard initialization complete"
    );

}


initializeDashboard();


console.log(
    "🎓 Mwaniki Scholars Dashboard loaded"
);
```
