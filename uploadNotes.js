import { supabase } from "./supabase.js";

console.log("📚 Mwaniki Scholars Admin Notes System Loaded");

const BUCKET = "notes";

// ============================================================
// LOAD COURSES
// ============================================================

async function loadCourses() {
    console.log("📚 Loading courses...");

    const courseSelect = document.getElementById("courseSelect");

    if (!courseSelect) {
        console.error("❌ courseSelect not found");
        return;
    }

    const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("id");

    if (error) {
        console.error("❌ Failed to load courses:", error);
        return;
    }

    courseSelect.innerHTML =
        '<option value="">-- Select Course --</option>';

    data.forEach(course => {
        const option = document.createElement("option");

        option.value = course.id;
        option.textContent = course.title;

        courseSelect.appendChild(option);
    });

    console.log("✅ Courses loaded:", data.length);
}

// ============================================================
// LOAD UNITS
// ============================================================

async function loadUnits(courseId) {
    console.log("📖 loadUnits() called with course:", courseId);

    const unitSelect = document.getElementById("unitSelect");

    if (!unitSelect) {
        console.error("❌ unitSelect not found");
        return;
    }

    unitSelect.innerHTML =
        '<option value="">-- Loading units... --</option>';

    if (!courseId) {
        unitSelect.innerHTML =
            '<option value="">-- Select Unit --</option>';
        return;
    }

    const { data, error } = await supabase
        .from("units")
        .select("id, course_id, title")
        .eq("course_id", courseId)
        .order("id");

    if (error) {
        console.error("❌ Failed to load units:", error);

        unitSelect.innerHTML =
            '<option value="">-- Failed to load units --</option>';

        return;
    }

    unitSelect.innerHTML =
        '<option value="">-- Select Unit --</option>';

    data.forEach(unit => {
        const option = document.createElement("option");

        option.value = unit.id;
        option.textContent = unit.title;

        unitSelect.appendChild(option);
    });

    console.log("📦 Units query returned:", data);
    console.log(`✅ ${data.length} units added to dropdown`);
}

// ============================================================
// UPLOAD NOTES
// ============================================================

window.uploadNotes = async function () {

    console.log("📤 Upload button clicked");

    const courseSelect = document.getElementById("courseSelect");
    const unitSelect = document.getElementById("unitSelect");
    const fileInput = document.getElementById("notesFile");

    if (!courseSelect || !unitSelect || !fileInput) {
        alert("❌ Upload form elements are missing.");
        return;
    }

    const courseId = courseSelect.value;
    const unitId = unitSelect.value;
    const file = fileInput.files[0];

    console.log("Course:", courseId);
    console.log("Unit:", unitId);
    console.log("File:", file ? file.name : "None");

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!courseId) {
        alert("⚠️ Please select a course.");
        return;
    }

    if (!unitId) {
        alert("⚠️ Please select a unit.");
        return;
    }

    if (!file) {
        alert("⚠️ Please select a PDF file.");
        return;
    }

    if (file.type !== "application/pdf") {
        alert("❌ Only PDF files are allowed.");
        return;
    }

    // 50 MB limit
    const MAX_SIZE = 50 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
        alert("❌ File is too large. Maximum size is 50 MB.");
        return;
    }

    // --------------------------------------------------------
    // CHECK USER
    // --------------------------------------------------------

    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error("❌ User authentication error:", userError);

        alert("❌ You must be logged in as an admin to upload notes.");
        return;
    }

    console.log("👤 Uploading user:", user.id);

    // --------------------------------------------------------
    // GET COURSE + UNIT NAMES
    // --------------------------------------------------------

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .single();

    if (courseError) {
        console.error("❌ Course lookup failed:", courseError);
        alert("❌ Could not find the selected course.");
        return;
    }

    const { data: unit, error: unitError } = await supabase
        .from("units")
        .select("title")
        .eq("id", unitId)
        .single();

    if (unitError) {
        console.error("❌ Unit lookup failed:", unitError);
        alert("❌ Could not find the selected unit.");
        return;
    }

    // --------------------------------------------------------
    // CREATE SAFE FILE NAME
    // --------------------------------------------------------

    const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");

    const timestamp = Date.now();

    const filePath =
        `${courseId}/${unitId}/${timestamp}_${safeName}`;

    console.log("📁 Storage path:", filePath);

    // --------------------------------------------------------
    // UPLOAD DIRECTLY TO SUPABASE STORAGE
    // --------------------------------------------------------

    console.log("☁️ Uploading to Supabase Storage...");

    const { data: uploadData, error: uploadError } =
        await supabase.storage
            .from(BUCKET)
            .upload(filePath, file, {
                cacheControl: "3600",
                contentType: "application/pdf",
                upsert: false
            });

    if (uploadError) {

        console.error(
            "❌ Supabase Storage upload failed:",
            uploadError
        );

        alert(
            "❌ Upload failed.\n\n" +
            uploadError.message
        );

        return;
    }

    console.log("✅ File uploaded:", uploadData);

    // --------------------------------------------------------
    // GET PUBLIC URL
    // --------------------------------------------------------

    const { data: publicUrlData } =
        supabase.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

    const fileUrl = publicUrlData.publicUrl;

    console.log("🔗 File URL:", fileUrl);

    // --------------------------------------------------------
    // SAVE NOTE INFORMATION IN DATABASE
    // --------------------------------------------------------

    console.log("💾 Saving note information...");

    const { data: noteData, error: noteError } =
        await supabase
            .from("notes")
            .insert({
                course: course.title,
                unit: unit.title,
                file_name: file.name,
                file_url: fileUrl,
                uploaded_by: user.id,
                course_id: courseId,
                unit_id: unitId
            })
            .select()
            .single();

    if (noteError) {

        console.error(
            "❌ Database insert failed:",
            noteError
        );

        // Remove uploaded file if database insert fails
        await supabase.storage
            .from(BUCKET)
            .remove([filePath]);

        alert(
            "❌ File uploaded but note information could not be saved.\n\n" +
            noteError.message
        );

        return;
    }

    console.log("✅ Note saved:", noteData);

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    alert(
        `✅ NOTES UPLOADED SUCCESSFULLY!\n\n` +
        `Course: ${course.title}\n` +
        `Unit: ${unit.title}\n` +
        `File: ${file.name}`
    );

    // Clear file input
    fileInput.value = "";

    console.log("🎉 Upload completed successfully!");
};

// ============================================================
// COURSE CHANGE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("🚀 Admin notes page initialized");

    const courseSelect =
        document.getElementById("courseSelect");

    if (courseSelect) {

        courseSelect.addEventListener("change", function () {

            console.log(
                "🔄 Course changed:",
                this.value
            );

            loadUnits(this.value);
        });
    }

    loadCourses();
});
