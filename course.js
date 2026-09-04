```javascript
import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS - COURSE PAGE ENGINE
// =====================================================

const courseId = localStorage.getItem("selectedCourse");
const courseName = localStorage.getItem("selectedCourseName");

// =====================================================
// PAGE ELEMENTS
// =====================================================

const courseTitle = document.getElementById("courseTitle");
const courseDescription = document.getElementById("courseDescription");
const unitsArea = document.getElementById("unitsArea");
const notesArea = document.getElementById("notesArea");

let quizArea = document.getElementById("quizArea");

// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =====================================================
// GET UNIT NOTES
// =====================================================

function getUnitNotes(unit) {
    if (
        unit &&
        typeof unit.notes_content === "string" &&
        unit.notes_content.trim() !== ""
    ) {
        return unit.notes_content.trim();
    }

    if (
        unit &&
        typeof unit.notes === "string" &&
        unit.notes.trim() !== ""
    ) {
        return unit.notes.trim();
    }

    return "";
}

// =====================================================
// CREATE QUIZ AREA IF MISSING
// =====================================================

function ensureQuizArea() {
    quizArea = document.getElementById("quizArea");

    if (quizArea) {
        return quizArea;
    }

    quizArea = document.createElement("div");
    quizArea.id = "quizArea";
    quizArea.style.margin = "30px 0";

    if (notesArea && notesArea.parentNode) {
        notesArea.parentNode.insertBefore(quizArea, notesArea);
    } else if (unitsArea && unitsArea.parentNode) {
        unitsArea.parentNode.appendChild(quizArea);
    } else {
        document.body.appendChild(quizArea);
    }

    return quizArea;
}

// =====================================================
// LOAD COURSE
// =====================================================

async function loadCourse() {
    if (!courseId) {
        console.error("No selected course found.");

        if (courseTitle) {
            courseTitle.textContent = "No course selected";
        }

        if (courseDescription) {
            courseDescription.textContent =
                "Please return to the courses page and select a course.";
        }

        return;
    }

    console.log("Loading selected course:", courseId);

    try {
        const result = await supabase
            .from("courses")
            .select("id, title, description, image, created_at")
            .eq("id", courseId)
            .single();

        const data = result.data;
        const error = result.error;

        if (error) {
            console.error("COURSE ERROR:", error);

            if (courseTitle) {
                courseTitle.textContent = "Failed to load course";
            }

            if (courseDescription) {
                courseDescription.textContent = error.message;
            }

            return;
        }

        console.log("Course loaded:", data);

        if (courseTitle) {
            courseTitle.textContent =
                data.title ||
                courseName ||
                "Medical Course";
        }

        if (courseDescription) {
            courseDescription.textContent =
                data.description ||
                "Medical learning course";
        }

    } catch (error) {
        console.error("Unexpected course error:", error);

        if (courseTitle) {
            courseTitle.textContent = "Failed to load course";
        }

        if (courseDescription) {
            courseDescription.textContent = error.message;
        }
    }
}

// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits() {
    if (!unitsArea) {
        console.error("#unitsArea was not found.");
        return;
    }

    if (!courseId) {
        unitsArea.innerHTML =
            "<p>Please select a course first.</p>";
        return;
    }

    unitsArea.innerHTML =
        "<p>Loading units...</p>";

    try {
        const result = await supabase
            .from("units")
            .select(
                "id, course_id, title, notes, notes_content, image, video_url, created_at"
            )
            .eq("course_id", courseId)
            .order("id", { ascending: true });

        const data = result.data;
        const error = result.error;

        if (error) {
            console.error("UNITS ERROR:", error);

            unitsArea.innerHTML =
                '<div style="padding:20px;background:#fff0f0;color:#b00020;border-radius:12px;">' +
                "<h3>Failed to load units</h3>" +
                "<p>" + escapeHTML(error.message) + "</p>" +
                "</div>";

            return;
        }

        console.log("Units loaded:", data);

        if (!data || data.length === 0) {
            unitsArea.innerHTML =
                '<div style="padding:20px;background:#fff8e6;border-radius:12px;">' +
                "No units available for this course yet." +
                "</div>";

            return;
        }

        unitsArea.innerHTML = "";

        data.forEach(function(unit) {
            const card = document.createElement("div");

            card.className = "unit-card";

            const notes = getUnitNotes(unit);
            const hasNotes = notes.length > 0;

            card.innerHTML =
                '<h3>📖 ' +
                escapeHTML(unit.title) +
                "</h3>" +

                '<div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;">' +

                '<button type="button" ' +
                'class="start-quiz-button" ' +
                'data-unit-id="' +
                escapeHTML(unit.id) +
                '" ' +
                'data-unit-title="' +
                escapeHTML(unit.title) +
                '">' +
                "📝 Start Quiz" +
                "</button>" +

                '<button type="button" ' +
                'class="view-notes-button" ' +
                'data-unit-id="' +
                escapeHTML(unit.id) +
                '" ' +
                'data-unit-title="' +
                escapeHTML(unit.title) +
                '">' +
                "📄 View Notes" +
                "</button>" +

                "</div>" +

                '<div style="margin-top:10px;font-size:14px;color:' +
                (hasNotes ? "#137333" : "#777") +
                ';">' +
                (
                    hasNotes
                        ? "Detailed notes available"
                        : "Notes will load from the notes library"
                ) +
                "</div>";

            unitsArea.appendChild(card);
        });

        // =================================================
        // QUIZ BUTTONS
        // =================================================

        const quizButtons =
            document.querySelectorAll(".start-quiz-button");

        quizButtons.forEach(function(button) {
            button.addEventListener("click", function() {
                const unitId = button.dataset.unitId;
                const unitTitle = button.dataset.unitTitle;

                console.log(
                    "Starting quiz:",
                    unitTitle,
                    unitId
                );

                loadUnitQuiz(unitId, unitTitle);
            });
        });

        // =================================================
        // NOTES BUTTONS
        // =================================================

        const notesButtons =
            document.querySelectorAll(".view-notes-button");

        notesButtons.forEach(function(button) {
            button.addEventListener("click", function() {
                const unitId = button.dataset.unitId;
                const unitTitle = button.dataset.unitTitle;

                console.log(
                    "Showing notes:",
                    unitTitle,
                    unitId
                );

                showUnitNotes(unitId, unitTitle);
            });
        });

        console.log(
            data.length + " units displayed."
        );

    } catch (error) {
        console.error("Unexpected units error:", error);

        unitsArea.innerHTML =
            '<div style="padding:20px;background:#fff0f0;color:#b00020;border-radius:12px;">' +
            "<h3>Something went wrong.</h3>" +
            "<p>" + escapeHTML(error.message) + "</p>" +
            "</div>";
    }
}

// =====================================================
// LOAD QUIZ
// =====================================================

async function loadUnitQuiz(unitId, unitTitle) {
    const area = ensureQuizArea();

    area.innerHTML =
        '<div style="padding:25px;text-align:center;background:#f8fafc;border-radius:14px;">' +
        "Loading quiz for <strong>" +
        escapeHTML(unitTitle) +
        "</strong>..." +
        "</div>";

    area.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    console.log("Quiz query:", {
        courseId: courseId,
        unitId: unitId,
        unitTitle: unitTitle
    });

    try {
        const result = await supabase
            .from("quizzes")
            .select(
                "id, course_id, course, unit, question, option_a, option_b, option_c, option_d, correct_answer"
            )
            .eq("course_id", courseId)
            .eq("unit", unitTitle)
            .order("id", { ascending: true });

        const quizzes = result.data;
        const error = result.error;

        if (error) {
            console.error(
                "QUIZ DATABASE ERROR:",
                error
            );

            area.innerHTML =
                '<div style="padding:25px;background:#fff0f0;color:#b00020;border-radius:14px;">' +
                "<h3>Failed to load quiz</h3>" +
                "<p>" +
                escapeHTML(error.message) +
                "</p>" +
                "<small>Course ID: " +
                escapeHTML(courseId) +
                "<br>Unit: " +
                escapeHTML(unitTitle) +
                "</small>" +
                "</div>";

            return;
        }

        console.log(
            "Quizzes loaded:",
            quizzes
        );

        if (!quizzes || quizzes.length === 0) {
            area.innerHTML =
                '<div style="padding:25px;background:#fff8e6;border-radius:14px;border:1px solid #f0dfaa;">' +
                "<h3>No quizzes found</h3>" +
                "<p>No quizzes are connected to <strong>" +
                escapeHTML(unitTitle) +
                "</strong>.</p>" +
                "<small>Course ID: " +
                escapeHTML(courseId) +
                "<br>Unit ID: " +
                escapeHTML(unitId) +
                "</small>" +
                "</div>";

            return;
        }

        renderUnitQuiz(
            unitTitle,
            quizzes
        );

    } catch (error) {
        console.error(
            "Unexpected quiz error:",
            error
        );

        area.innerHTML =
            '<div style="padding:25px;background:#fff0f0;color:#b00020;border-radius:14px;">' +
            "<h3>Quiz loading failed</h3>" +
            "<p>" +
            escapeHTML(error.message) +
            "</p>" +
            "</div>";
    }
}

// =====================================================
// RENDER QUIZ
// =====================================================

function renderUnitQuiz(unitTitle, quizzes) {
    const area = ensureQuizArea();

    area.innerHTML = "";

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "quiz-container";

    wrapper.style.cssText =
        "background:#ffffff;" +
        "padding:25px;" +
        "margin:20px 0;" +
        "border-radius:16px;" +
        "border:1px solid #d9edf2;" +
        "box-shadow:0 5px 18px rgba(0,0,0,.07);";

    const header =
        document.createElement("div");

    header.style.cssText =
        "border-bottom:2px solid #e8f1f5;" +
        "padding-bottom:15px;" +
        "margin-bottom:25px;";

    header.innerHTML =
        '<h2 style="color:#063970;margin:0;">📝 ' +
        escapeHTML(unitTitle) +
        "</h2>" +

        '<p style="color:#666;margin-bottom:0;">' +
        quizzes.length +
        " question" +
        (quizzes.length === 1 ? "" : "s") +
        "</p>";

    wrapper.appendChild(header);

    quizzes.forEach(function(quiz, index) {
        const questionCard =
            document.createElement("div");

        questionCard.className =
            "quiz-question";

        questionCard.style.cssText =
            "padding:20px;" +
            "margin-bottom:20px;" +
            "background:#f8fafc;" +
            "border-radius:12px;" +
            "border:1px solid #e5e7eb;";

        questionCard.innerHTML =
            '<h3 style="margin-top:0;color:#063970;line-height:1.5;">' +
            (index + 1) +
            ". " +
            escapeHTML(quiz.question) +
            "</h3>" +

            '<div style="display:flex;flex-direction:column;gap:12px;">' +

            '<label>' +
            '<input type="radio" name="quiz_' +
            quiz.id +
            '" value="A">' +
            " A. " +
            escapeHTML(quiz.option_a) +
            "</label>" +

            '<label>' +
            '<input type="radio" name="quiz_' +
            quiz.id +
            '" value="B">' +
            " B. " +
            escapeHTML(quiz.option_b) +
            "</label>" +

            '<label>' +
            '<input type="radio" name="quiz_' +
            quiz.id +
            '" value="C">' +
            " C. " +
            escapeHTML(quiz.option_c) +
            "</label>" +

            '<label>' +
            '<input type="radio" name="quiz_' +
            quiz.id +
            '" value="D">' +
            " D. " +
            escapeHTML(quiz.option_d) +
            "</label>" +

            "</div>";

        wrapper.appendChild(
            questionCard
        );
    });

    const submitButton =
        document.createElement("button");

    submitButton.type = "button";
    submitButton.textContent =
        "✅ Submit Quiz";

    submitButton.style.cssText =
        "padding:14px 24px;" +
        "border:none;" +
        "border-radius:10px;" +
        "cursor:pointer;" +
        "font-size:16px;" +
        "font-weight:bold;" +
        "margin-top:10px;";

    submitButton.addEventListener(
        "click",
        function() {
            calculateQuizScore(
                quizzes,
                wrapper
            );
        }
    );

    wrapper.appendChild(
        submitButton
    );

    area.appendChild(
        wrapper
    );

    area.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    console.log(
        "Rendered " +
        quizzes.length +
        " quizzes for " +
        unitTitle
    );
}

// =====================================================
// CALCULATE SCORE
// =====================================================

function calculateQuizScore(
    quizzes,
    wrapper
) {
    let score = 0;
    let answered = 0;

    quizzes.forEach(function(quiz) {
        const selected =
            document.querySelector(
                'input[name="quiz_' +
                quiz.id +
                '"]:checked'
            );

        if (!selected) {
            return;
        }

        answered++;

        const correct =
            String(
                quiz.correct_answer == null
                    ? ""
                    : quiz.correct_answer
            )
                .trim()
                .toUpperCase();

        const selectedAnswer =
            selected.value
                .trim()
                .toUpperCase();

        let isCorrect =
            selectedAnswer === correct;

        if (!isCorrect) {
            const optionKey =
                "option_" +
                selectedAnswer.toLowerCase();

            const selectedText =
                String(
                    quiz[optionKey] == null
                        ? ""
                        : quiz[optionKey]
                )
                    .trim()
                    .toUpperCase();

            isCorrect =
                selectedText === correct;
        }

        if (isCorrect) {
            score++;
        }
    });

    const percentage =
        quizzes.length > 0
            ? Math.round(
                (score / quizzes.length) *
                100
            )
            : 0;

    const oldResult =
        wrapper.querySelector(
            ".quiz-result"
        );

    if (oldResult) {
        oldResult.remove();
    }

    const result =
        document.createElement("div");

    result.className =
        "quiz-result";

    result.style.cssText =
        "margin-top:25px;" +
        "padding:20px;" +
        "background:#f0fdf4;" +
        "border-radius:12px;" +
        "border:1px solid #bbf7d0;" +
        "font-weight:bold;" +
        "line-height:1.8;";

    result.innerHTML =
        "🎯 Quiz Result" +
        "<br><br>" +
        "Score: " +
        score +
        "/" +
        quizzes.length +
        "<br>" +
        "Percentage: " +
        percentage +
        "%" +
        "<br>" +
        "Answered: " +
        answered +
        "/" +
        quizzes.length;

    wrapper.appendChild(
        result
    );

    result.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    console.log(
        "Quiz score:",
        score,
        "/",
        quizzes.length
    );
}

// =====================================================
// SHOW NOTES
// =====================================================

async function showUnitNotes(
    unitId,
    unitTitle
) {
    if (!notesArea) {
        console.warn(
            "#notesArea not found."
        );
        return;
    }

    notesArea.innerHTML =
        '<div style="padding:20px;text-align:center;">' +
        "Loading notes for <strong>" +
        escapeHTML(unitTitle) +
        "</strong>..." +
        "</div>";

    notesArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        // =================================================
        // DIRECT UNIT NOTES
        // =================================================

        const unitResult =
            await supabase
                .from("units")
                .select(
                    "id, course_id, title, notes, notes_content, image, video_url, created_at"
                )
                .eq("id", unitId)
                .single();

        const unit =
            unitResult.data;

        if (unitResult.error) {
            console.warn(
                "Unit notes lookup:",
                unitResult.error.message
            );
        }

        if (unit) {
            const directNotes =
                getUnitNotes(unit);

            if (directNotes) {
                renderDetailedNotes(
                    unitTitle,
                    unitId,
                    directNotes
                );

                return;
            }
        }

        // =================================================
        // NOTES TABLE - UNIT ID
        // =================================================

        const uploadedResult =
            await supabase
                .from("notes")
                .select("*")
                .eq("course_id", courseId)
                .eq("unit_id", unitId)
                .order(
                    "created_at",
                    { ascending: false }
                );

        const uploadedNotes =
            uploadedResult.data;

        if (uploadedResult.error) {
            console.warn(
                "Uploaded notes lookup:",
                uploadedResult.error.message
            );
        }

        if (
            uploadedNotes &&
            uploadedNotes.length > 0
        ) {
            renderUploadedNotes(
                unitTitle,
                uploadedNotes
            );

            return;
        }

        // =================================================
        // NOTES TABLE - UNIT NAME
        // =================================================

        const fallbackResult =
            await supabase
                .from("notes")
                .select("*")
                .eq("course_id", courseId)
                .eq("unit", unitTitle)
                .order(
                    "created_at",
                    { ascending: false }
                );

        const fallbackNotes =
            fallbackResult.data;

        if (fallbackResult.error) {
            console.warn(
                "Fallback notes lookup:",
                fallbackResult.error.message
            );
        }

        if (
            fallbackNotes &&
            fallbackNotes.length > 0
        ) {
            renderUploadedNotes(
                unitTitle,
                fallbackNotes
            );

            return;
        }

        // =================================================
        // NOTHING FOUND
        // =================================================

        notesArea.innerHTML =
            '<div style="padding:25px;background:#fff8e6;border-radius:14px;border:1px solid #f0dfaa;">' +
            "<h3>📄 No notes found</h3>" +
            "<p>No notes are currently connected to <strong>" +
            escapeHTML(unitTitle) +
            "</strong>.</p>" +
            "</div>";

    } catch (error) {
        console.error(
            "Unexpected notes error:",
            error
        );

        notesArea.innerHTML =
            '<div style="padding:20px;background:#fff0f0;color:#b00020;border-radius:12px;">' +
            "<h3>Failed to load notes.</h3>" +
            "<p>" +
            escapeHTML(error.message) +
            "</p>" +
            "</div>";
    }
}

// =====================================================
// RENDER DETAILED NOTES
// =====================================================

function renderDetailedNotes(
    unitTitle,
    unitId,
    notes
) {
    notesArea.innerHTML = "";

    const card =
        document.createElement("div");

    card.className =
        "note-card";

    card.dataset.unitId =
        unitId;

    card.innerHTML =
        '<div style="background:#ffffff;padding:30px;margin:20px 0;border-radius:16px;border:1px solid #d9edf2;box-shadow:0 5px 18px rgba(0,0,0,.07);">' +

        '<div style="margin-bottom:25px;border-bottom:2px solid #e8f1f5;padding-bottom:15px;">' +

        '<h2 style="color:#063970;margin:0;">📚 ' +
        escapeHTML(unitTitle) +
        "</h2>" +

        "</div>" +

        '<article style="line-height:1.85;color:#222;font-size:16px;">' +
        formatDetailedNotes(notes) +
        "</article>" +

        "</div>";

    notesArea.appendChild(
        card
    );
}

// =====================================================
// RENDER UPLOADED NOTES
// =====================================================

function renderUploadedNotes(
    unitTitle,
    notes
) {
    notesArea.innerHTML = "";

    const heading =
        document.createElement("h2");

    heading.style.color =
        "#063970";

    heading.textContent =
        "📄 " + unitTitle;

    notesArea.appendChild(
        heading
    );

    notes.forEach(function(note) {
        const filename =
            note.file_name ||
            "Study Notes";

        const fileUrl =
            note.file_url ||
            "";

        const card =
            document.createElement("div");

        card.className =
            "note-card";

        const container =
            document.createElement("div");

        container.style.cssText =
            "background:white;" +
            "padding:20px;" +
            "margin:12px 0;" +
            "border-radius:14px;" +
            "border:1px solid #d9edf2;" +
            "box-shadow:0 4px 12px rgba(0,0,0,.06);";

        const title =
            document.createElement("h3");

        title.style.color =
            "#063970";

        title.textContent =
            "📄 " + filename;

        container.appendChild(
            title
        );

        if (fileUrl) {
            const link =
                document.createElement("a");

            link.href =
                fileUrl;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";

            const button =
                document.createElement("button");

            button.type =
                "button";

            button.textContent =
                "📖 Open Notes";

            link.appendChild(
                button
            );

            container.appendChild(
                link
            );

        } else {
            const warning =
                document.createElement("p");

            warning.style.color =
                "#b00020";

            warning.textContent =
                "⚠️ File URL unavailable.";

            container.appendChild(
                warning
            );
        }

        card.appendChild(
            container
        );

        notesArea.appendChild(
            card
        );
    });
}

// =====================================================
// FORMAT NOTES
// =====================================================

function formatDetailedNotes(text) {
    if (!text) {
        return "";
    }

    let html =
        escapeHTML(text);

    html = html.replace(
        /^###### (.*)$/gm,
        "<h6>$1</h6>"
    );

    html = html.replace(
        /^##### (.*)$/gm,
        "<h5>$1</h5>"
    );

    html = html.replace(
        /^#### (.*)$/gm,
        "<h4>$1</h4>"
    );

    html = html.replace(
        /^### (.*)$/gm,
        "<h3>$1</h3>"
    );

    html = html.replace(
        /^## (.*)$/gm,
        "<h2>$1</h2>"
    );

    html = html.replace(
        /^# (.*)$/gm,
        "<h1>$1</h1>"
    );

    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );

    html = html.replace(
        /(?<!\*)\*([^*]+)\*(?!\*)/g,
        "<em>$1</em>"
    );

    html = html.replace(
        /^---$/gm,
        "<hr>"
    );

    html = html.replace(
        /^[-*] (.*)$/gm,
        "<li>$1</li>"
    );

    html = html.replace(
        /(<li>.*<\/li>\n?)+/g,
        function(match) {
            return "<ul>" +
                match +
                "</ul>";
        }
    );

    html = html.replace(
        /^\d+\. (.*)$/gm,
        "<li>$1</li>"
    );

    html = html.replace(
        /\n{2,}/g,
        "</p><p>"
    );

    html = html.replace(
        /\n/g,
        "<br>"
    );

    return "<p>" +
        html +
        "</p>";
}

// =====================================================
// INITIALIZE
// =====================================================

async function initializeCourse() {
    console.log(
        "Starting Mwaniki Scholars Course Engine..."
    );

    console.log(
        "Selected course ID:",
        courseId
    );

    console.log(
        "Selected course name:",
        courseName
    );

    if (!courseId) {
        if (courseTitle) {
            courseTitle.textContent =
                "No course selected";
        }

        if (unitsArea) {
            unitsArea.innerHTML =
                "<p>Please select a course first.</p>";
        }

        return;
    }

    await loadCourse();
    await loadUnits();

    console.log(
        "Mwaniki Scholars Course Engine Loaded"
    );
}

initializeCourse();
```
