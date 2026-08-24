import { supabase } from "./supabase.js";


// =====================================================
// MWANIKI SCHOLARS - QUIZ ADMINISTRATION
// =====================================================


const courseSelect =
    document.getElementById("course");

const unitSelect =
    document.getElementById("unit");

const questionInput =
    document.getElementById("question");

const optionA =
    document.getElementById("optionA");

const optionB =
    document.getElementById("optionB");

const optionC =
    document.getElementById("optionC");

const optionD =
    document.getElementById("optionD");

const correctAnswer =
    document.getElementById("correctAnswer");

const saveButton =
    document.getElementById("saveQuestion");

const statusBox =
    document.getElementById("status");

const questionsArea =
    document.getElementById("questionsArea");


// =====================================================
// STATUS MESSAGE
// =====================================================

function showStatus(message, type = "normal") {

    if (!statusBox) return;

    statusBox.textContent = message;

    if (type === "success") {

        statusBox.style.background = "#e8f8ee";
        statusBox.style.color = "#087f3e";

    } else if (type === "error") {

        statusBox.style.background = "#fff0f0";
        statusBox.style.color = "#b00020";

    } else {

        statusBox.style.background = "#eef7fb";
        statusBox.style.color = "#063970";

    }

}


// =====================================================
// LOAD COURSES
// =====================================================

async function loadCourses() {

    if (!courseSelect) return;


    courseSelect.innerHTML = `
        <option value="">
            ⏳ Loading courses...
        </option>
    `;


    try {

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select("id,title")
            .order("id", {
                ascending: true
            });


        if (error) {

            console.error(
                "COURSES ERROR:",
                error
            );

            courseSelect.innerHTML = `
                <option value="">
                    ❌ Failed to load courses
                </option>
            `;

            showStatus(
                "❌ Failed to load courses: " +
                error.message,
                "error"
            );

            return;
        }


        courseSelect.innerHTML = `
            <option value="">
                Select a course
            </option>
        `;


        if (!data || data.length === 0) {

            courseSelect.innerHTML = `
                <option value="">
                    No courses available
                </option>
            `;

            return;
        }


        data.forEach(course => {

            const option =
                document.createElement("option");

            option.value =
                course.id;

            option.textContent =
                course.title;

            courseSelect.appendChild(
                option
            );

        });


        console.log(
            "📚 Quiz Admin courses loaded:",
            data.length
        );

    } catch (error) {

        console.error(
            "Unexpected courses error:",
            error
        );

        showStatus(
            "❌ Unable to load courses.",
            "error"
        );

    }

}


// =====================================================
// COURSE CHANGED
// =====================================================

courseSelect.addEventListener(
    "change",
    async function() {

        const courseId =
            this.value;


        unitSelect.innerHTML = `
            <option value="">
                ⏳ Loading units...
            </option>
        `;


        questionsArea.innerHTML =
            "Select a unit to view questions.";


        if (!courseId) {

            unitSelect.innerHTML = `
                <option value="">
                    Select a course first
                </option>
            `;

            return;
        }


        await loadUnits(courseId);

    }
);


// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits(courseId) {

    try {

        const {
            data,
            error
        } = await supabase
            .from("units")
            .select("id,title")
            .eq(
                "course_id",
                courseId
            )
            .order("id", {
                ascending: true
            });


        if (error) {

            console.error(
                "UNITS ERROR:",
                error
            );

            unitSelect.innerHTML = `
                <option value="">
                    ❌ Failed to load units
                </option>
            `;

            showStatus(
                "❌ Failed to load units: " +
                error.message,
                "error"
            );

            return;
        }


        unitSelect.innerHTML = `
            <option value="">
                Select a unit
            </option>
        `;


        if (!data || data.length === 0) {

            unitSelect.innerHTML = `
                <option value="">
                    No units available
                </option>
            `;

            return;
        }


        data.forEach(unit => {

            const option =
                document.createElement("option");

            option.value =
                unit.id;

            option.textContent =
                unit.title;

            unitSelect.appendChild(
                option
            );

        });


        console.log(
            "📖 Units loaded:",
            data.length
        );

    } catch (error) {

        console.error(
            "Unexpected units error:",
            error
        );

    }

}


// =====================================================
// UNIT CHANGED
// =====================================================

unitSelect.addEventListener(
    "change",
    async function() {

        const unitId =
            this.value;


        if (!unitId) {

            questionsArea.innerHTML =
                "Select a unit to view questions.";

            return;

        }


        await loadQuestions(unitId);

    }
);


// =====================================================
// LOAD EXISTING QUESTIONS
// =====================================================

async function loadQuestions(unitId) {

    questionsArea.innerHTML = `
        <p>⏳ Loading questions...</p>
    `;


    try {

        const {
            data,
            error
        } = await supabase
            .from("quiz_questions")
            .select("*")
            .eq(
                "unit_id",
                unitId
            )
            .order("id", {
                ascending: true
            });


        if (error) {

            console.error(
                "QUESTIONS ERROR:",
                error
            );

            questionsArea.innerHTML = `
                <p style="color:#b00020;">
                    ❌ ${escapeHTML(
                        error.message
                    )}
                </p>
            `;

            return;
        }


        if (!data || data.length === 0) {

            questionsArea.innerHTML = `
                <div class="question-card">

                    📚 No questions have been
                    added to this unit yet.

                </div>
            `;

            return;

        }


        questionsArea.innerHTML = "";


        data.forEach(
            (question, index) => {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "question-card";


                card.innerHTML = `

                    <h3>
                        Question ${index + 1}
                    </h3>

                    <p>
                        <strong>
                            ${escapeHTML(
                                question.question
                            )}
                        </strong>
                    </p>

                    <p>
                        A. ${escapeHTML(
                            question.option_a
                        )}
                    </p>

                    <p>
                        B. ${escapeHTML(
                            question.option_b
                        )}
                    </p>

                    <p>
                        C. ${escapeHTML(
                            question.option_c
                        )}
                    </p>

                    <p>
                        D. ${escapeHTML(
                            question.option_d
                        )}
                    </p>

                    <p>
                        ✅ Correct answer:
                        <strong>
                            ${escapeHTML(
                                question.correct_answer
                            )}
                        </strong>
                    </p>

                    <button
                        class="delete-btn"
                        data-id="${question.id}"
                    >

                        🗑️ Delete Question

                    </button>

                `;


                questionsArea.appendChild(
                    card
                );

            }
        );


        document
            .querySelectorAll(
                ".delete-btn"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async function() {

                        const id =
                            this.dataset.id;


                        await deleteQuestion(
                            id,
                            unitId
                        );

                    }
                );

            });


    } catch (error) {

        console.error(
            "Unexpected questions error:",
            error
        );

        questionsArea.innerHTML = `
            <p style="color:#b00020;">
                ❌ Failed to load questions.
            </p>
        `;

    }

}


// =====================================================
// SAVE QUESTION
// =====================================================

saveButton.addEventListener(
    "click",
    async function() {

        const courseId =
            courseSelect.value;

        const unitId =
            unitSelect.value;

        const question =
            questionInput.value.trim();

        const a =
            optionA.value.trim();

        const b =
            optionB.value.trim();

        const c =
            optionC.value.trim();

        const d =
            optionD.value.trim();

        const correct =
            correctAnswer.value;


        // =============================================
        // VALIDATION
        // =============================================

        if (!courseId) {

            showStatus(
                "❌ Please select a course.",
                "error"
            );

            return;

        }


        if (!unitId) {

            showStatus(
                "❌ Please select a unit.",
                "error"
            );

            return;

        }


        if (!question) {

            showStatus(
                "❌ Enter the question.",
                "error"
            );

            return;

        }


        if (!a || !b || !c || !d) {

            showStatus(
                "❌ Enter all four options.",
                "error"
            );

            return;

        }


        if (!correct) {

            showStatus(
                "❌ Select the correct answer.",
                "error"
            );

            return;

        }


        // =============================================
        // DISABLE BUTTON
        // =============================================

        saveButton.disabled = true;

        saveButton.textContent =
            "⏳ Saving...";


        try {

            const {
                data,
                error
            } = await supabase
                .from("quiz_questions")
                .insert({

                    course_id:
                        Number(courseId),

                    unit_id:
                        Number(unitId),

                    question:
                        question,

                    option_a:
                        a,

                    option_b:
                        b,

                    option_c:
                        c,

                    option_d:
                        d,

                    correct_answer:
                        correct

                })
                .select()
                .single();


            if (error) {

                console.error(
                    "SAVE QUESTION ERROR:",
                    error
                );

                showStatus(
                    "❌ Failed to save question: " +
                    error.message,
                    "error"
                );

                return;

            }


            console.log(
                "✅ Question saved:",
                data
            );


            showStatus(
                "✅ Question added successfully!",
                "success"
            );


            // =========================================
            // CLEAR QUESTION FORM
            // =========================================

            questionInput.value = "";

            optionA.value = "";

            optionB.value = "";

            optionC.value = "";

            optionD.value = "";

            correctAnswer.value = "";


            // =========================================
            // RELOAD QUESTIONS
            // =========================================

            await loadQuestions(
                unitId
            );


        } catch (error) {

            console.error(
                "Unexpected save error:",
                error
            );

            showStatus(
                "❌ Something went wrong while saving.",
                "error"
            );

        } finally {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "💾 Save Question";

        }

    }
);


// =====================================================
// DELETE QUESTION
// =====================================================

async function deleteQuestion(
    questionId,
    unitId
) {

    const confirmed =
        confirm(
            "Delete this quiz question?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabase
            .from("quiz_questions")
            .delete()
            .eq(
                "id",
                questionId
            );


        if (error) {

            console.error(
                "DELETE QUESTION ERROR:",
                error
            );

            showStatus(
                "❌ Failed to delete question: " +
                error.message,
                "error"
            );

            return;

        }


        showStatus(
            "✅ Question deleted.",
            "success"
        );


        await loadQuestions(
            unitId
        );


    } catch (error) {

        console.error(
            "Unexpected delete error:",
            error
        );

        showStatus(
            "❌ Something went wrong.",
            "error"
        );

    }

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// START
// =====================================================

loadCourses();


console.log(
    "📝 Mwaniki Scholars Quiz Admin Loaded"
);