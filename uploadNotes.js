// uploadNotes.js
// Mwaniki Scholars - Admin Notes Upload
// Supabase Storage version

import { supabase } from "./supabase.js";

const BUCKET = "notes";

// Supported file types
const ALLOWED_TYPES = {
    "application/pdf": "pdf",

    "application/msword": "doc",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",

    "application/vnd.ms-powerpoint": "ppt",

    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx"
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB


console.log("📚 Mwaniki Scholars Admin Notes System Loaded");


// ----------------------------------------------------
// STATUS MESSAGE
// ----------------------------------------------------

function showStatus(message, type = "info") {

    const status = document.getElementById("status");

    if (!status) return;

    status.textContent = message;

    if (type === "success") {
        status.style.color = "#15803d";
    }

    else if (type === "error") {
        status.style.color = "#dc2626";
    }

    else {
        status.style.color = "#0b7285";
    }
}


// ----------------------------------------------------
// LOAD COURSES
// ----------------------------------------------------

async function loadCourses() {

    console.log("📚 Loading courses...");

    const courseSelect = document.getElementById("courseSelect");

    if (!courseSelect) {
        console.error("❌ courseSelect not found");
        return;
    }

    courseSelect.innerHTML =
        `<option value="">⏳ Loading courses...</option>`;

    const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("id", { ascending: true });


    if (error) {

        console.error("❌ Courses error:", error);

        courseSelect.innerHTML =
            `<option value="">❌ Failed to load courses</option>`;

        showStatus(
            "❌ Failed to load courses: " + error.message,
            "error"
        );

        return;
    }


    if (!data || data.length === 0) {

        courseSelect.innerHTML =
            `<option value="">No courses found</option>`;

        showStatus(
            "⚠️ No courses were found in Supabase.",
            "error"
        );

        return;
    }


    courseSelect.innerHTML =
        `<option value="">-- Select Course --</option>`;


    data.forEach(course => {

        const option = document.createElement("option");

        option.value = course.id;

        option.textContent = course.title;

        courseSelect.appendChild(option);

    });


    console.log(`✅ ${data.length} courses loaded`);

}


// ----------------------------------------------------
// LOAD UNITS
// ----------------------------------------------------

async function loadUnits(courseId) {

    const unitSelect = document.getElementById("unitSelect");

    if (!unitSelect) {
        console.error("❌ unitSelect not found");
        return;
    }


    if (!courseId) {

        unitSelect.innerHTML =
            `<option value="">Select a course first</option>`;

        unitSelect.disabled = true;

        return;
    }


    console.log("📖 Loading units for course:", courseId);


    unitSelect.disabled = true;

    unitSelect.innerHTML =
        `<option value="">⏳ Loading units...</option>`;


    const { data, error } = await supabase
        .from("units")
        .select("id, title")
        .eq("course_id", courseId)
        .order("id", { ascending: true });


    if (error) {

        console.error("❌ Units error:", error);

        unitSelect.innerHTML =
            `<option value="">❌ Failed to load units</option>`;

        showStatus(
            "❌ Failed to load units: " + error.message,
            "error"
        );

        return;
    }


    if (!data || data.length === 0) {

        unitSelect.innerHTML =
            `<option value="">No units found</option>`;

        showStatus(
            "⚠️ This course has no units yet.",
            "error"
        );

        return;
    }


    unitSelect.innerHTML =
        `<option value="">-- Select Unit --</option>`;


    data.forEach(unit => {

        const option = document.createElement("option");

        option.value = unit.id;

        option.textContent = unit.title;

        unitSelect.appendChild(option);

    });


    unitSelect.disabled = false;


    console.log(`✅ ${data.length} units loaded`);

}


// ----------------------------------------------------
// SANITIZE FILE NAME
// ----------------------------------------------------

function sanitizeFileName(fileName) {

    return fileName

        .replace(/\s+/g, "_")

        .replace(/[^a-zA-Z0-9._-]/g, "")

        .substring(0, 180);

}


// ----------------------------------------------------
// GET MIME TYPE
// ----------------------------------------------------

function getMimeType(file) {

    if (file.type && ALLOWED_TYPES[file.type]) {
        return file.type;
    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const mimeMap = {

        pdf: "application/pdf",

        doc: "application/msword",

        docx:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        ppt: "application/vnd.ms-powerpoint",

        pptx:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"

    };


    return mimeMap[extension] || null;

}


// ----------------------------------------------------
// UPLOAD NOTES
// ----------------------------------------------------

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


    if (!courseSelect || !unitSelect || !fileInput) {

        console.error("❌ Required HTML elements missing");

        showStatus(
            "❌ Upload form is incomplete.",
            "error"
        );

        return;
    }


    const courseId = courseSelect.value;

    const unitId = unitSelect.value;

    const file = fileInput.files[0];


    // ------------------------------------------------
    // VALIDATION
    // ------------------------------------------------

    if (!courseId) {

        showStatus(
            "⚠️ Please select a course.",
            "error"
        );

        return;
    }


    if (!unitId) {

        showStatus(
            "⚠️ Please select a unit.",
            "error"
        );

        return;
    }


    if (!file) {

        showStatus(
            "⚠️ Please select a notes file.",
            "error"
        );

        return;
    }


    const mimeType = getMimeType(file);


    if (!mimeType) {

        showStatus(
            "❌ Unsupported file type. Use PDF, DOC, DOCX, PPT or PPTX.",
            "error"
        );

        return;
    }


    if (file.size > MAX_FILE_SIZE) {

        showStatus(
            "❌ File is larger than 50 MB.",
            "error"
        );

        return;
    }


    console.log("📚 Course:", courseId);

    console.log("📖 Unit:", unitId);

    console.log("📄 File:", file.name);

    console.log(
        "📦 Size:",
        (file.size / 1024 / 1024).toFixed(2),
        "MB"
    );


    // ------------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------------

    showStatus(
        "🔐 Checking administrator login...",
        "info"
    );


    const {
        data: userData,
        error: userError
    } = await supabase.auth.getUser();


    if (userError || !userData?.user) {

        console.error("❌ Authentication error:", userError);

        showStatus(
            "❌ You must be logged in before uploading notes.",
            "error"
        );

        return;
    }


    const user = userData.user;


    console.log(
        "✅ Logged in user:",
        user.email
    );


    // ------------------------------------------------
    // GET COURSE
    // ------------------------------------------------

    const {
        data: course,
        error: courseError
    } = await supabase

        .from("courses")

        .select("id, title")

        .eq("id", courseId)

        .single();


    if (courseError || !course) {

        console.error(
            "❌ Course lookup error:",
            courseError
        );

        showStatus(
            "❌ Could not find selected course.",
            "error"
        );

        return;
    }


    // ------------------------------------------------
    // GET UNIT
    // ------------------------------------------------

    const {
        data: unit,
        error: unitError
    } = await supabase

        .from("units")

        .select("id, title")

        .eq("id", unitId)

        .eq("course_id", courseId)

        .single();


    if (unitError || !unit) {

        console.error(
            "❌ Unit lookup error:",
            unitError
        );

        showStatus(
            "❌ Could not find selected unit.",
            "error"
        );

        return;
    }


    console.log(
        "📚 Course name:",
        course.title
    );

    console.log(
        "📖 Unit name:",
        unit.title
    );


    // ------------------------------------------------
    // DISABLE BUTTON
    // ------------------------------------------------

    if (uploadButton) {

        uploadButton.disabled = true;

        uploadButton.textContent =
            "⏳ Uploading...";

    }


    try {

        // --------------------------------------------
        // CREATE STORAGE PATH
        // --------------------------------------------

        const safeName =
            sanitizeFileName(file.name);


        const timestamp =
            Date.now();


        const filePath =
            `${courseId}/${unitId}/${timestamp}_${safeName}`;


        console.log(
            "📁 Storage path:",
            filePath
        );


        // --------------------------------------------
        // UPLOAD TO SUPABASE STORAGE
        // --------------------------------------------

        showStatus(
            "📤 Uploading file to Supabase Storage...",
            "info"
        );


        const {
            data: uploadData,
            error: uploadError
        } = await supabase

            .storage

            .from(BUCKET)

            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",

                    contentType: mimeType,

                    upsert: false
                }
            );


        if (uploadError) {

            console.error(
                "❌ Storage upload error:",
                uploadError
            );

            throw new Error(
                uploadError.message
            );
        }


        console.log(
            "✅ Storage upload successful:",
            uploadData
        );


        // --------------------------------------------
        // GET PUBLIC URL
        // --------------------------------------------

        const {
            data: publicUrlData
        } = supabase

            .storage

            .from(BUCKET)

            .getPublicUrl(filePath);


        const publicUrl =
            publicUrlData?.publicUrl;


        if (!publicUrl) {

            throw new Error(
                "Could not generate public file URL."
            );
        }


        console.log(
            "🔗 Public URL:",
            publicUrl
        );


        // --------------------------------------------
        // SAVE FILE INFORMATION IN NOTES TABLE
        // --------------------------------------------

        showStatus(
            "💾 Saving notes information...",
            "info"
        );


        const {
            data: noteData,
            error: noteError
        } = await supabase

            .from("notes")

            .insert({

                course: course.title,

                unit: unit.title,

                file_name: file.name,

                file_url: publicUrl,

                uploaded_by: user.id,

                course_id: course.id,

                unit_id: unit.id

            })

            .select();


        if (noteError) {

            console.error(
                "❌ Database insert error:",
                noteError
            );


            // ----------------------------------------
            // DELETE STORAGE FILE IF DB INSERT FAILS
            // ----------------------------------------

            await supabase

                .storage

                .from(BUCKET)

                .remove([filePath]);


            throw new Error(
                noteError.message
            );
        }


        console.log(
            "✅ Notes database record created:",
            noteData
        );


        // --------------------------------------------
        // SUCCESS
        // --------------------------------------------

        showStatus(
            `✅ Notes uploaded successfully!<br>
             📚 ${course.title}<br>
             📖 ${unit.title}<br>
             📄 ${file.name}`,
            "success"
        );


        // Clear file input
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


// ----------------------------------------------------
// COURSE CHANGE EVENT
// ----------------------------------------------------

function setupEvents() {

    const courseSelect =
        document.getElementById("courseSelect");


    if (courseSelect) {

        courseSelect.addEventListener(
            "change",
            function () {

                console.log(
                    "🔄 Course changed:",
                    this.value
                );


                loadUnits(this.value);

            }
        );

    }

}


// ----------------------------------------------------
// MAKE FUNCTION AVAILABLE TO HTML onclick
// ----------------------------------------------------

window.uploadNotes = uploadNotes;


// ----------------------------------------------------
// INITIALIZE
// ----------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "🚀 Admin notes page initialized"
        );


        setupEvents();

        await loadCourses();

    }
);
