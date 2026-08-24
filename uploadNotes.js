import { supabase } from "./supabase.js";


// =====================================================
// MWANIKI SCHOLARS - ADMIN NOTES UPLOAD
// =====================================================

console.log(
    "📚 Mwaniki Scholars Admin Notes System Loaded"
);


// =====================================================
// ELEMENTS
// =====================================================

const courseSelect =
    document.getElementById("course");

const unitSelect =
    document.getElementById("unit");

const fileInput =
    document.getElementById("file");

const statusBox =
    document.getElementById("status");

const uploadButton =
    document.getElementById("uploadButton");


// =====================================================
// LOAD COURSES
// =====================================================

async function loadCourses() {

    console.log(
        "📚 Loading courses..."
    );


    if (!courseSelect) {

        console.error(
            "❌ #course was not found"
        );

        return;
    }


    courseSelect.innerHTML = `
        <option value="">
            ⏳ Loading courses...
        </option>
    `;


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("courses")
                .select("id,title")
                .order("id");


        if (error) {

            console.error(
                "❌ COURSES ERROR:",
                error
            );


            courseSelect.innerHTML = `
                <option value="">
                    ❌ Failed to load courses
                </option>
            `;

            return;
        }


        console.log(
            "✅ Courses loaded:",
            data
        );


        courseSelect.innerHTML = `
            <option value="">
                -- Select Course --
            </option>
        `;


        data.forEach(course => {

            const option =
                document.createElement("option");


            option.value =
                String(course.id);


            option.textContent =
                course.title;


            courseSelect.appendChild(
                option
            );

        });


        console.log(
            "✅ Course dropdown populated"
        );

    }

    catch(error) {

        console.error(
            "❌ COURSE EXCEPTION:",
            error
        );

    }

}


// =====================================================
// LOAD UNITS
// =====================================================

async function loadUnits(courseId) {

    console.log(
        "📖 loadUnits() called with course:",
        courseId
    );


    if (!unitSelect) {

        console.error(
            "❌ #unit was not found"
        );

        return;
    }


    unitSelect.disabled = true;


    unitSelect.innerHTML = `
        <option value="">
            ⏳ Loading units...
        </option>
    `;


    if (!courseId) {

        unitSelect.innerHTML = `
            <option value="">
                Select a course first
            </option>
        `;

        return;
    }


    try {

        console.log(
            "🔎 Querying units for course_id:",
            courseId
        );


        const {
            data,
            error
        } =
            await supabase
                .from("units")
                .select(
                    "id,course_id,title"
                )
                .eq(
                    "course_id",
                    Number(courseId)
                )
                .order(
                    "id",
                    {
                        ascending:true
                    }
                );


        console.log(
            "📦 Units query returned:",
            data
        );


        if (error) {

            console.error(
                "❌ UNITS SUPABASE ERROR:",
                error
            );


            unitSelect.innerHTML = `
                <option value="">
                    ❌ Failed to load units
                </option>
            `;

            return;
        }


        unitSelect.innerHTML = `
            <option value="">
                -- Select Unit --
            </option>
        `;


        if (!data || data.length === 0) {

            console.warn(
                "⚠️ No units found for course:",
                courseId
            );


            unitSelect.innerHTML = `
                <option value="">
                    ⚠️ No units found
                </option>
            `;

            return;
        }


        data.forEach(unit => {

            const option =
                document.createElement("option");


            option.value =
                String(unit.id);


            option.textContent =
                unit.title;


            unitSelect.appendChild(
                option
            );

        });


        unitSelect.disabled = false;


        console.log(
            `✅ ${data.length} units added to dropdown`
        );

    }

    catch(error) {

        console.error(
            "❌ UNITS EXCEPTION:",
            error
        );


        unitSelect.innerHTML = `
            <option value="">
                ❌ Error loading units
            </option>
        `;

    }

}


// =====================================================
// COURSE CHANGE EVENT
// =====================================================

if (courseSelect) {

    courseSelect.addEventListener(
        "change",
        function () {

            console.log(
                "🔄 Course changed:",
                this.value
            );


            loadUnits(
                this.value
            );

        }
    );

}


// =====================================================
// UPLOAD
// =====================================================

window.uploadNotes =
    async function () {

        console.log(
            "📤 Upload button clicked"
        );


        const courseId =
            courseSelect.value;

        const unitId =
            unitSelect.value;

        const file =
            fileInput.files[0];


        console.log(
            "Course:",
            courseId
        );

        console.log(
            "Unit:",
            unitId
        );

        console.log(
            "File:",
            file?.name
        );


        if (!courseId) {

            statusBox.innerHTML =
                "❌ Select a course.";

            return;
        }


        if (!unitId) {

            statusBox.innerHTML =
                "❌ Select a unit.";

            return;
        }


        if (!file) {

            statusBox.innerHTML =
                "❌ Select a file.";

            return;
        }


        statusBox.innerHTML =
            "⏳ Uploading...";


        try {

            const {
                data: {
                    user
                }
            } =
                await supabase.auth.getUser();


            if (!user) {

                statusBox.innerHTML =
                    "❌ Please login first.";

                return;
            }


            const formData =
                new FormData();


            formData.append(
                "file",
                file
            );


            formData.append(
                "course",
                courseId
            );


            formData.append(
                "unit",
                unitId
            );


            console.log(
                "🌐 Sending to localhost:5000..."
            );


            const response =
                await fetch(
                    "http://localhost:5000/upload",
                    {
                        method:"POST",
                        body:formData
                    }
                );


            const result =
                await response.json();


            console.log(
                "📦 Server result:",
                result
            );


            if (
                !response.ok ||
                !result.success
            ) {

                statusBox.innerHTML =
                    "❌ " +
                    (
                        result.error ||
                        "Upload failed"
                    );

                return;
            }


            statusBox.innerHTML =
                "⏳ Saving note record...";


            // -----------------------------------------
            // GET COURSE
            // -----------------------------------------

            const {
                data: courseData
            } =
                await supabase
                    .from("courses")
                    .select("title")
                    .eq(
                        "id",
                        courseId
                    )
                    .single();


            // -----------------------------------------
            // GET UNIT
            // -----------------------------------------

            const {
                data: unitData
            } =
                await supabase
                    .from("units")
                    .select("title")
                    .eq(
                        "id",
                        unitId
                    )
                    .single();


            // -----------------------------------------
            // SAVE NOTE
            // -----------------------------------------

            const {
                error: noteError
            } =
                await supabase
                    .from("notes")
                    .insert({

                        course:
                            courseData?.title,

                        unit:
                            unitData?.title,

                        file_name:
                            result.file,

                        file_url:
                            result.file_url,

                        uploaded_by:
                            user.id

                    });


            if (noteError) {

                console.error(
                    "❌ NOTE DATABASE ERROR:",
                    noteError
                );


                statusBox.innerHTML =
                    `
                    ❌ File uploaded,
                    but database record failed.
                    <br><br>
                    ${noteError.message}
                    `;

                return;
            }


            statusBox.innerHTML =
                `
                <span style="color:green">
                ✅ Notes uploaded successfully!
                </span>
                `;


            fileInput.value = "";


            console.log(
                "✅ COMPLETE UPLOAD"
            );

        }

        catch(error) {

            console.error(
                "❌ UPLOAD ERROR:",
                error
            );


            statusBox.innerHTML =
                `
                ❌ Upload failed:
                <br>
                ${error.message}
                `;

        }

    };


// =====================================================
// START
// =====================================================

loadCourses();