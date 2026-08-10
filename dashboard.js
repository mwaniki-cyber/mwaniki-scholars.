import { supabase } from "./supabase.js";


// ======================================================
// MWANIKI SCHOLARS STUDENT DASHBOARD
// NOTES + PROGRESS
// COURSES ARE HANDLED BY courses.js
// ======================================================


// ======================================================
// LOAD NOTES
// ======================================================

async function loadNotes() {

    const notesBox =
        document.getElementById("notesArea");


    if (!notesBox) {

        console.warn(
            "notesArea not found"
        );

        return;
    }


    notesBox.innerHTML =
        "⏳ Loading notes...";


    const { data, error } =
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
            "❌ " + error.message;

        return;
    }


    if (!data || data.length === 0) {

        notesBox.innerHTML =
            "📄 No notes uploaded yet.";

        return;
    }


    notesBox.innerHTML = "";


    data.forEach(note => {

        const course =
            note.course ||
            "Course";


        const unit =
            note.unit ||
            "Unit";


        const filename =
            note.filename;


        if (!filename) {
            return;
        }


        const githubUrl =
            "https://github.com/mwaniki-cyber/mwaniki-scholars/blob/main/notes/"
            +
            encodeURIComponent(filename);


        notesBox.innerHTML += `

            <div class="note-card">

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
                    href="${githubUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                >

                    <button>
                        📄 Open Notes
                    </button>

                </a>

            </div>

        `;

    });

}



// ======================================================
// SEARCH NOTES
// ======================================================

const notesSearch =
    document.getElementById("notesSearch");


if (notesSearch) {

    notesSearch.addEventListener(
        "input",
        function () {

            const search =
                this.value
                    .toLowerCase()
                    .trim();


            document
                .querySelectorAll(".note-card")
                .forEach(card => {

                    const text =
                        card.textContent
                            .toLowerCase();


                    card.style.display =
                        text.includes(search)
                            ? ""
                            : "none";

                });

        }
    );

}



// ======================================================
// QUIZ PROGRESS
// ======================================================

function updateProgressDisplay() {

    const progressBox =
        document.getElementById("progress");


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


    progress.forEach(item => {

        totalScore +=
            Number(item.score) || 0;

        totalQuestions +=
            Number(item.total) || 0;

    });


    const percentage =
        totalQuestions > 0
            ? Math.round(
                (totalScore /
                totalQuestions) * 100
            )
            : 0;


    progressBox.innerHTML =
        percentage + "%";

}



// ======================================================
// INITIALIZE
// ======================================================

async function initializeDashboard() {

    await loadNotes();

    updateProgressDisplay();

}


initializeDashboard();


console.log(
    "🎓 Mwaniki Scholars Dashboard loaded"
);