// uploadNotes.js
// Mwaniki Scholars - Admin Notes Upload

import { supabase } from "./supabase.js";

const BUCKET = "notes";

const ALLOWED_EXTENSIONS = [
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx"
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;

console.log("📚 Mwaniki Scholars Notes Upload Loaded");


// =====================================================
// STATUS
// =====================================================

function showStatus(message, type = "info") {

    const status = document.getElementById("status");

    if (!status) return;

    status.innerHTML = message;

    status.style.color =
        type === "success"
            ? "#15803d"
            : type === "error"
            ? "#dc2626"
            : "#0b7285";
}


// =====================================================
// LOAD COURSES
// =====================================================

async function loadCourses() {

    const courseSelect =
        document.getElementById("courseSelect");

    const unitSelect =
        document.getElementById("unitSelect");

    if (!courseSelect) {
        console.error("❌ courseSelect not found");
        return;
    }

    if (!unitSelect) {
        console.error("❌ unitSelect not found");
        return;
    }

    console.log("📚 Loading courses...");

    courseSelect.innerHTML =
        `<option value="">⏳ Loading courses...</option>`;

    unitSelect.innerHTML =
        `<option value="">Select a course first</option>`;

    unitSelect.disabled = true;


    const {
        data: courses,
        error
    } = await supabase

        .from("courses")

        .select("id, title")

        .order("id", {
            ascending: true
        });


    if (error) {

        console.error(
            "❌ Course loading error:",
            error
        );

        courseSelect.innerHTML =
            `<option value="">❌ Failed to load courses</option>`;

        showStatus(
            "❌ Failed to load courses: " +
            error.message,
            "error"
        );

        return;
    }


    console.log(
        "✅ Courses returned:",
        courses
    );


    if (!courses || courses.length === 0) {

        courseSelect.innerHTML =
            `<option value="">No courses found</option>`;

        showStatus(
            "⚠️ No courses found.",
            "error"
        );

        return;
    }


    courseSelect.innerHTML =
        `<option value="">-- Select Course --</option>`;


    courses.forEach(course => {

        const option =
            document.createElement("option");

        option.value = String(course.id);

        option.textContent =
            course.title;

        courseSelect.appendChild(option);

    });


    console.log(
        `✅ ${courses.length} courses added`
    );
}


// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits(courseId) {

    const unitSelect =
        document.getElementById("unitSelect");


    if (!unitSelect) {

        console.error(
            "❌ unitSelect not found"
        );

        return;
    }


    console.log(
        "🔄 Course selected:",
        courseId
    );


    // No course selected
    if (!courseId) {

        unitSelect.innerHTML =
            `<option value="">Select a course first</option>`;

        unitSelect.disabled = true;

        return;
    }


    unitSelect.disabled = true;

    unitSelect.innerHTML =
        `<option value="">⏳ Loading units...</option>`;


    console.log(
        "📖 Querying units for course_id:",
        courseId
    );


    const {
        data: units,
        error
    } = await supabase

        .from("units")

        .select("id, title, course_id")

        .eq("course_id", Number(courseId))

        .order("id", {
            ascending: true
        });


    if (error) {

        console.error(
            "❌ Units query error:",
            error
        );

        unitSelect.innerHTML =
            `<option value="">❌ Failed to load units</option>`;

        showStatus(
            "❌ Could not load units: " +
            error.message,
            "error"
        );

        return;
    }


    console.log(
        "📦 Units returned:",
        units
    );


    if (!units || units.length === 0) {

        unitSelect.innerHTML =
            `<option value="">⚠️ No units found</option>`;

        unitSelect.disabled = true;

        showStatus(
            "⚠️ This course has no units in the database.",
            "error"
        );

        return;
    }


    // Clear old options
    unitSelect.innerHTML =
        `<option value="">-- Select Unit --</option>`;


    // Add units
    units.forEach((unit, index) => {

        const option =
            document.createElement("option");

        option.value =
            String(unit.id);

        option.textContent =
            unit.title || `Unit ${index + 1}`;

        unitSelect.appendChild(option);

    });


    // ENABLE UNIT DROPDOWN
    unitSelect.disabled = false;


    console.log(
        `✅ ${units.length} units added to dropdown`
    );


    showStatus(
        `✅ ${units.length} units loaded. Select a unit.`,
        "success"
    );
}


// =====================================================
// FILE NAME CLEANER
// =====================================================

function cleanFileName(name) {

    return name
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .substring(0, 180);
}


// =====================================================
// UPLOAD NOTES
// =====================================================

async function uploadNotes() {

    console.log("📤 Upload button clicked");


    const courseSelect =
        document.getElementById("courseSelect");

    const unitSelect =
        document.getElementById("unitSelect");

    const fileInput =
        document.getElementById("notesFile");

    const uploadButton =
        document.getElementById("uploadButton");


    if (!courseSelect ||
        !unitSelect ||
        !fileInput) {

        showStatus(
            "❌ Upload form elements are missing.",
            "error"
        );

        return;
    }


    const courseId =
        courseSelect.value;

    const unitId =
        unitSelect.value;

    const file =
        fileInput.files[0];


    // VALIDATION

    if (!courseId) {

        showStatus(
            "⚠️ Select a course first.",
            "error"
        );

        return;
    }


    if (!unitId) {

        showStatus(
            "⚠️ Select a unit first.",
            "error"
        );

        return;
    }


    if (!file) {

        showStatus(
            "⚠️ Select a notes file.",
            "error"
        );

        return;
    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    if (!ALLOWED_EXTENSIONS.includes(extension)) {

        showStatus(
            "❌ Allowed files: PDF, DOC, DOCX, PPT, PPTX.",
            "error"
        );

        return;
    }


    if (file.size > MAX_FILE_SIZE) {

        showStatus(
            "❌ File must be 50 MB or smaller.",
            "error"
        );

        return;
    }


    try {

        if (uploadButton) {

            uploadButton.disabled = true;

            uploadButton.textContent =
                "⏳ Uploading...";

        }


        // =================================================
        // AUTH
        // =================================================

        showStatus(
            "🔐 Checking login...",
            "info"
        );


        const {
            data: authData,
            error: authError
        } = await supabase.auth.getUser();


        if (authError ||
            !authData ||
            !authData.user) {

            throw new Error(
                "You must be logged in to upload notes."
            );
        }


        const user =
            authData.user;


        // =================================================
        // GET COURSE
        // =================================================

        const {
            data: course,
            error: courseError
        } = await supabase

            .from("courses")

            .select("id, title")

            .eq("id", Number(courseId))

            .single();


        if (courseError ||
            !course) {

            throw new Error(
                "Selected course could not be found."
            );
        }


        // =================================================
        // GET UNIT
        // =================================================

        const {
            data: unit,
            error: unitError
        } = await supabase

            .from("units")

            .select("id, title, course_id")

            .eq("id", Number(unitId))

            .eq("course_id", Number(courseId))

            .single();


        if (unitError ||
            !unit) {

            throw new Error(
                "Selected unit could not be found."
            );
        }


        console.log(
            "📚 Course:",
            course.title
        );

        console.log(
            "📖 Unit:",
            unit.title
        );


        // =================================================
        // STORAGE PATH
        // =================================================

        const safeName =
            cleanFileName(file.name);


        const filePath =
            `${courseId}/${unitId}/${Date.now()}_${safeName}`;


        console.log(
            "📁 Upload path:",
            filePath
        );


        // =================================================
        // UPLOAD
        // =================================================

        showStatus(
            "📤 Uploading to Supabase Storage...",
            "info"
        );


        const {
            data: storageData,
            error: storageError
        } = await supabase

            .storage

            .from(BUCKET)

            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    contentType: file.type,
                    upsert: false
                }
            );


        if (storageError) {

            console.error(
                "❌ Storage error:",
                storageError
            );

            throw new Error(
                storageError.message
            );
        }


        console.log(
            "✅ Storage upload:",
            storageData
        );


        // =================================================
        // PUBLIC URL
        // =================================================

        const {
            data: urlData
        } = supabase

            .storage

            .from(BUCKET)

            .getPublicUrl(filePath);


        const publicUrl =
            urlData.publicUrl;


        if (!publicUrl) {

            throw new Error(
                "Could not create file URL."
            );
        }


        // =================================================
        // SAVE TO NOTES TABLE
        // =================================================

        showStatus(
            "💾 Saving notes information...",
            "info"
        );


        const {
            error: notesError
        } = await supabase

            .from("notes")

            .insert({

                course: course.title,

                unit: unit.title,

                file_name: file.name,

                file_url: publicUrl,

                uploaded_by: user.id,

                course_id: Number(courseId),

                unit_id: Number(unitId)

            });


        if (notesError) {

            console.error(
                "❌ Notes database error:",
                notesError
            );


            // Remove uploaded file
            await supabase

                .storage

                .from(BUCKET)

                .remove([filePath]);


            throw new Error(
                notesError.message
            );
        }


        // =================================================
        // SUCCESS
        // =================================================

        console.log(
            "🎉 Notes uploaded successfully!"
        );


        showStatus(
            `✅ <strong>Notes uploaded successfully!</strong><br>
             📚 ${course.title}<br>
             📖 ${unit.title}<br>
             📄 ${file.name}`,
            "success"
        );


        fileInput.value = "";


    } catch (error) {

        console.error(
            "❌ UPLOAD ERROR:",
            error
        );


        showStatus(
            "❌ Upload failed: " +
            error.message,
            "error"
        );


    } finally {

        if (uploadButton) {

            uploadButton.disabled = false;

            uploadButton.textContent =
                "📤 Upload Notes";

        }

    }
}


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "🚀 Admin notes page initialized"
        );


        const courseSelect =
            document.getElementById("courseSelect");


        if (!courseSelect) {

            console.error(
                "❌ courseSelect missing from HTML"
            );

            return;
        }


        courseSelect.addEventListener(
            "change",
            () => {

                loadUnits(
                    courseSelect.value
                );

            }
        );


        await loadCourses();

    }
);


// Make onclick="uploadNotes()" work
window.uploadNotes = uploadNotes;
