import { supabase } from "./supabase.js";


console.log(
    "✅ Mwaniki Scholars Student Profile Loaded"
);


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
    () => {

        window.location.href =
            "dashboard.html";

    }
);


/* =========================================================
   LOAD USER
   ========================================================= */

async function loadProfile() {

    status.textContent =
        "⏳ Loading your profile...";


    const {
        data: {
            session
        },
        error
    } =
        await supabase.auth.getSession();


    if (error) {

        console.error(error);

        status.textContent =
            "❌ Unable to load your session.";

        return;

    }


    if (!session || !session.user) {

        window.location.href =
            "studentLogin.html";

        return;

    }


    currentUser =
        session.user;


    email.value =
        currentUser.email || "";


    /* =====================================================
       LOAD STUDENT PROFILE
       ===================================================== */

    const {
        data,
        error: profileError
    } =
        await supabase
            .from("students")
            .select("*")
            .eq("id", currentUser.id)
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


    if (data) {

        fullName.value =
            data.full_name || "";

        phone.value =
            data.phone || "";

        course.value =
            data.course || "";

        level.value =
            data.level || "";


        if (data.photo_url) {

            showPhoto(
                data.photo_url
            );

        }

    }


    status.textContent = "";

}


loadProfile();


/* =========================================================
   PHOTO SELECTION
   ========================================================= */

photoInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];


        if (!file) {

            return;

        }


        if (!file.type.startsWith("image/")) {

            status.textContent =
                "❌ Please select an image file.";

            return;

        }


        if (file.size > 5 * 1024 * 1024) {

            status.textContent =
                "❌ Image must be smaller than 5 MB.";

            this.value = "";

            return;

        }


        selectedPhoto =
            file;


        const previewURL =
            URL.createObjectURL(file);


        showPhoto(previewURL);


        status.textContent =
            "📷 New photo selected. Save your profile to upload it.";

    }
);


/* =========================================================
   SHOW PHOTO
   ========================================================= */

function showPhoto(url) {

    photoContainer.innerHTML = "";

    const img =
        document.createElement("img");

    img.src = url;

    img.className =
        "profile-photo";

    img.alt =
        "Student profile photo";

    photoContainer.appendChild(img);

}


/* =========================================================
   UPLOAD PHOTO
   ========================================================= */

async function uploadPhoto() {

    if (!selectedPhoto) {

        return null;

    }


    const extension =
        selectedPhoto.name
            .split(".")
            .pop()
            .toLowerCase();


    const filePath =
        `${currentUser.id}/profile.${extension}`;


    status.textContent =
        "⏳ Uploading profile photo...";


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

        throw error;

    }


    const {
        data
    } =
        supabase.storage
            .from("student-profiles")
            .getPublicUrl(filePath);


    return data.publicUrl;

}


/* =========================================================
   SAVE PROFILE
   ========================================================= */

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        if (!currentUser) {

            status.textContent =
                "❌ You are not logged in.";

            return;

        }


        saveButton.disabled = true;

        saveButton.textContent =
            "⏳ Saving...";


        status.textContent =
            "Saving your profile...";


        try {


            let photoURL =
                null;


            /* =============================================
               PHOTO
               ============================================= */

            if (selectedPhoto) {

                photoURL =
                    await uploadPhoto();

            }


            /* =============================================
               PROFILE DATA
               ============================================= */

            const updateData = {

                full_name:
                    fullName.value.trim(),

                phone:
                    phone.value.trim(),

                course:
                    course.value.trim(),

                level:
                    level.value.trim()

            };


            if (photoURL) {

                updateData.photo_url =
                    photoURL;

            }


            /* =============================================
               UPDATE DATABASE
               ============================================= */

            const {
                error
            } =
                await supabase
                    .from("students")
                    .update(updateData)
                    .eq(
                        "id",
                        currentUser.id
                    );


            if (error) {

                throw error;

            }


            selectedPhoto =
                null;


            photoInput.value =
                "";


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
                error.message;

        }

        finally {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "💾 Save Profile";

        }

    }
);
