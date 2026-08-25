```javascript
import { supabase } from "./supabase.js";

console.log("✅ Mwaniki Scholars Student Profile Loaded");


/* =========================================================
   CHANGE THIS ONLY IF YOUR STUDENT DASHBOARD HAS
   A DIFFERENT FILENAME
   ========================================================= */

const DASHBOARD_PAGE = "studentDashboard.html";


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let currentUser = null;
let selectedPhoto = null;


/* =========================================================
   ELEMENTS
   ========================================================= */

const fullName =
    document.getElementById("fullName");

const email =
    document.getElementById("email");

const phone =
    document.getElementById("phone");

const course =
    document.getElementById("course");

const level =
    document.getElementById("level");

const photoInput =
    document.getElementById("photoInput");

const photoContainer =
    document.getElementById("photoContainer");

const form =
    document.getElementById("profileForm");

const saveButton =
    document.getElementById("saveButton");

const status =
    document.getElementById("profileStatus");

const dashboardButton =
    document.getElementById("dashboardButton");


/* =========================================================
   DASHBOARD BUTTON
   ========================================================= */

dashboardButton.addEventListener(
    "click",
    function () {

        window.location.href =
            DASHBOARD_PAGE;

    }
);


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadProfile() {

    try {

        status.textContent =
            "⏳ Loading your profile...";


        /* -------------------------------------------------
           GET CURRENT SESSION
           ------------------------------------------------- */

        const {
            data,
            error
        } =
            await supabase.auth.getSession();


        if (error) {

            console.error(
                "Session error:",
                error
            );

            status.textContent =
                "❌ Unable to load your session.";

            return;

        }


        const session =
            data?.session;


        /* -------------------------------------------------
           USER NOT LOGGED IN
           ------------------------------------------------- */

        if (
            !session ||
            !session.user
        ) {

            window.location.href =
                "studentLogin.html";

            return;

        }


        currentUser =
            session.user;


        /* -------------------------------------------------
           EMAIL
           ------------------------------------------------- */

        email.value =
            currentUser.email || "";


        /* -------------------------------------------------
           LOAD STUDENT DATABASE PROFILE
           ------------------------------------------------- */

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("students")
                .select(
                    "id, full_name, email, phone, course, level, photo_url"
                )
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "Profile loading error:",
                profileError
            );

            status.textContent =
                "❌ " +
                profileError.message;

            return;

        }


        /* -------------------------------------------------
           NO PROFILE YET
           ------------------------------------------------- */

        if (!profile) {

            status.textContent =
                "ℹ️ Complete your profile below.";

            return;

        }


        /* -------------------------------------------------
           FILL FORM
           ------------------------------------------------- */

        fullName.value =
            profile.full_name || "";

        phone.value =
            profile.phone || "";

        course.value =
            profile.course || "";

        level.value =
            profile.level || "";


        /* -------------------------------------------------
           EXISTING PHOTO
           ------------------------------------------------- */

        if (profile.photo_url) {

            showPhoto(
                profile.photo_url
            );

        }


        status.textContent = "";


    }

    catch (error) {

        console.error(
            "Unexpected profile error:",
            error
        );

        status.textContent =
            "❌ Unable to load your profile.";

    }

}


/* =========================================================
   START PROFILE LOADING
   ========================================================= */

loadProfile();


/* =========================================================
   PHOTO SELECTION
   ========================================================= */

photoInput.addEventListener(
    "change",
    function () {

        const file =
            this.files?.[0];


        if (!file) {

            return;

        }


        /* -------------------------------------------------
           CHECK FILE TYPE
           ------------------------------------------------- */

        if (
            !file.type ||
            !file.type.startsWith("image/")
        ) {

            status.textContent =
                "❌ Please select a valid image.";

            this.value = "";

            selectedPhoto = null;

            return;

        }


        /* -------------------------------------------------
           CHECK FILE SIZE
           ------------------------------------------------- */

        const maxSize =
            5 * 1024 * 1024;


        if (file.size > maxSize) {

            status.textContent =
                "❌ Image must be smaller than 5 MB.";

            this.value = "";

            selectedPhoto = null;

            return;

        }


        /* -------------------------------------------------
           STORE SELECTED PHOTO
           ------------------------------------------------- */

        selectedPhoto =
            file;


        /* -------------------------------------------------
           PREVIEW
           ------------------------------------------------- */

        const previewURL =
            URL.createObjectURL(file);


        showPhoto(
            previewURL
        );


        status.textContent =
            "📷 Photo selected. Click Save Profile to upload it.";

    }
);


/* =========================================================
   DISPLAY PHOTO
   ========================================================= */

function showPhoto(url) {

    photoContainer.innerHTML = "";


    const img =
        document.createElement("img");


    img.src =
        url;


    img.className =
        "profile-photo";


    img.alt =
        "Student profile photo";


    img.onerror =
        function () {

            photoContainer.innerHTML =
                '<div class="photo-placeholder">👤</div>';

        };


    photoContainer.appendChild(
        img
    );

}


/* =========================================================
   UPLOAD PHOTO
   ========================================================= */

async function uploadPhoto() {

    if (!selectedPhoto) {

        return null;

    }


    status.textContent =
        "⏳ Uploading profile photo...";


    /* -----------------------------------------------------
       ALWAYS USE JPG AS THE STORED FILE
       ----------------------------------------------------- */

    const filePath =
        `${currentUser.id}/profile.jpg`;


    /* -----------------------------------------------------
       UPLOAD
       ----------------------------------------------------- */

    const {
        error
    } =
        await supabase.storage
            .from("student-profiles")
            .upload(
                filePath,
                selectedPhoto,
                {
                    upsert: true,
                    contentType:
                        selectedPhoto.type
                }
            );


    if (error) {

        console.error(
            "Photo upload error:",
            error
        );

        throw error;

    }


    /* -----------------------------------------------------
       GET PUBLIC URL
       ----------------------------------------------------- */

    const {
        data
    } =
        supabase.storage
            .from("student-profiles")
            .getPublicUrl(
                filePath
            );


    if (!data?.publicUrl) {

        throw new Error(
            "Photo uploaded but a public URL could not be generated."
        );

    }


    /*
       Add a cache-busting parameter so that when a student
       replaces their photo, the browser doesn't keep showing
       the old cached image.
    */

    return (
        data.publicUrl +
        "?t=" +
        Date.now()
    );

}


/* =========================================================
   SAVE PROFILE
   ========================================================= */

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        /* -------------------------------------------------
           MAKE SURE USER EXISTS
           ------------------------------------------------- */

        if (!currentUser) {

            status.textContent =
                "❌ You are not logged in.";

            return;

        }


        /* -------------------------------------------------
           VALIDATE NAME
           ------------------------------------------------- */

        const name =
            fullName.value.trim();


        if (!name) {

            status.textContent =
                "❌ Please enter your full name.";

            fullName.focus();

            return;

        }


        /* -------------------------------------------------
           DISABLE BUTTON
           ------------------------------------------------- */

        saveButton.disabled =
            true;


        saveButton.textContent =
            "⏳ Saving...";


        status.textContent =
            "Saving your profile...";


        try {


            /* =============================================
               PHOTO
               ============================================= */

            let photoURL =
                null;


            if (selectedPhoto) {

                photoURL =
                    await uploadPhoto();

            }


            /* =============================================
               PROFILE DATA
               ============================================= */

            const updateData = {

                full_name:
                    name,

                phone:
                    phone.value.trim(),

                course:
                    course.value.trim(),

                level:
                    level.value.trim()

            };


            /* =============================================
               ADD PHOTO URL
               ============================================= */

            if (photoURL) {

                updateData.photo_url =
                    photoURL;

            }


            /* =============================================
               UPDATE STUDENT PROFILE
               ============================================= */

            const {
                error
            } =
                await supabase
                    .from("students")
                    .update(
                        updateData
                    )
                    .eq(
                        "id",
                        currentUser.id
                    );


            if (error) {

                console.error(
                    "Database update error:",
                    error
                );

                throw error;

            }


            /* =============================================
               CLEAN UP
               ============================================= */

            selectedPhoto =
                null;


            photoInput.value =
                "";


            /* =============================================
               SUCCESS
               ============================================= */

            status.textContent =
                "✅ Profile saved successfully!";


        }

        catch (error) {

            console.error(
                "Profile save error:",
                error
            );


            status.textContent =
                "❌ " +
                (
                    error.message ||
                    "Unable to save profile."
                );

        }

        finally {

            saveButton.disabled =
                false;


            saveButton.textContent =
                "💾 Save Profile";

        }

    }
);
```
