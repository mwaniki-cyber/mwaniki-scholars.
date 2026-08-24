import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS
// DASHBOARD COURSE LIBRARY
// =====================================================

async function loadCourses() {

    const courseArea = document.getElementById("courseArea");

    // This file should ONLY run on dashboard.html
    if (!courseArea) {
        console.log("ℹ️ courses.js skipped: courseArea not found");
        return;
    }

    courseArea.innerHTML = `
        <p>⏳ Loading courses...</p>
    `;

    try {

        console.log("📚 Loading all courses...");

        const { data, error } = await supabase
            .from("courses")
            .select("id,title,description,image,created_at")
            .order("id", {
                ascending: true
            });

        if (error) {

            console.error(
                "❌ COURSES DATABASE ERROR:",
                error
            );

            courseArea.innerHTML = `
                <div style="
                    padding:20px;
                    background:#fff0f0;
                    color:#b00020;
                    border-radius:12px;
                ">

                    <h3>❌ Failed to load courses</h3>

                    <p>
                        ${escapeHTML(error.message)}
                    </p>

                </div>
            `;

            return;
        }

        console.log(
            "📚 Courses returned:",
            data
        );

        const totalCourses =
            document.getElementById("totalCourses");

        if (totalCourses) {

            totalCourses.textContent =
                data?.length || 0;

        }

        if (!data || data.length === 0) {

            courseArea.innerHTML = `
                <div style="
                    padding:20px;
                    background:#fff8e6;
                    border-radius:12px;
                ">

                    <h3>📚 No courses available</h3>

                    <p>
                        The courses table currently contains
                        no visible rows.
                    </p>

                </div>
            `;

            return;
        }

        courseArea.innerHTML = "";

        data.forEach((course, index) => {

            const title =
                course.title ||
                `Medical Course ${index + 1}`;

            const description =
                course.description ||
                "Medical learning course";

            const card =
                document.createElement("div");

            card.className = "course-card";

            card.style.cssText = `
                background:white;
                padding:20px;
                margin:15px 0;
                border-radius:16px;
                border:1px solid #d9edf2;
                box-shadow:0 5px 15px rgba(0,0,0,.06);
            `;

            card.innerHTML = `

                <h3 style="
                    margin-top:0;
                    color:#063970;
                ">
                    📚 ${escapeHTML(title)}
                </h3>

                <p style="
                    color:#555;
                ">
                    ${escapeHTML(description)}
                </p>

                <button
                    class="open-course-button"
                    data-course-id="${escapeHTML(course.id)}"
                >
                    📖 Open Course
                </button>

            `;

            courseArea.appendChild(card);

        });

        // =================================================
        // OPEN COURSE
        // =================================================

        document
            .querySelectorAll(".open-course-button")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function () {

                        const courseId =
                            this.dataset.courseId;

                        const selectedCourse =
                            data.find(
                                course =>
                                    String(course.id) ===
                                    String(courseId)
                            );

                        if (!selectedCourse) {
                            console.error(
                                "❌ Selected course not found"
                            );
                            return;
                        }

                        localStorage.setItem(
                            "selectedCourse",
                            String(selectedCourse.id)
                        );

                        localStorage.setItem(
                            "selectedCourseName",
                            selectedCourse.title
                        );

                        console.log(
                            "📖 Opening:",
                            selectedCourse.title,
                            selectedCourse.id
                        );

                        window.location.href =
                            "course.html";

                    }
                );

            });

        // =================================================
        // COURSE SEARCH
        // =================================================

        const search =
            document.getElementById("courseSearch");

        if (search) {

            search.addEventListener(
                "input",
                function () {

                    const term =
                        this.value
                            .toLowerCase()
                            .trim();

                    document
                        .querySelectorAll(".course-card")
                        .forEach(card => {

                            const text =
                                card.textContent
                                    .toLowerCase();

                            card.style.display =
                                text.includes(term)
                                    ? ""
                                    : "none";

                        });

                }
            );

        }

        console.log(
            `✅ ${data.length} courses displayed`
        );

    } catch (error) {

        console.error(
            "❌ Unexpected course error:",
            error
        );

        courseArea.innerHTML = `
            <div style="
                padding:20px;
                background:#fff0f0;
                color:#b00020;
                border-radius:12px;
            ">

                <h3>❌ Something went wrong</h3>

                <p>
                    ${escapeHTML(error.message)}
                </p>

            </div>
        `;

    }

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// =====================================================
// START
// =====================================================

loadCourses();

console.log(
    "📚 Mwaniki Scholars Dashboard Course Library Loaded"
);