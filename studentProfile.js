import { supabase } from "./supabase.js";

console.log("✅ Mwaniki Scholars Student Profile Loaded");

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
   DASHBOARD
   ========================================================= */

dashboardButton.addEventListener("click", () => {

    window.location.href = "dashboard.html";

});


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadProfile() {

    status.textContent =
        "⏳ Loading your profile...";


    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();


        if (error) {
            throw error;
        }


        const session =
            data.session;


        if (!session || !session.user) {

            window.location.href =
                "studentLogin.html";

            return;

        }


        currentUser =
            session.user;


        email.value =
            currentUser.email || "";


        /* =================================================
           FIND STUDENT PROFILE
           ================================================= */

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("students")
                .select("*")
                .eq("id", currentUser.id)
                .maybeSingle();


        if (profileError) {
            throw profileError;
        }


        /* =================================================
           PROFILE EXISTS
           ================================================= */

        if (profile) {

            fullName.value =
                profile.full_name || "";

            phone.value =
                profile.phone || "";

            course.value =
                profile.course || "";

            level.value =
                profile.level || "";


            if (profile.photo_url) {

                showPhoto(
                    profile.photo_url
                );

            }

        }


        status.textContent = "";


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );


        status.textContent =
            "❌ " + error.message;

    }

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
                "❌ Please select a valid image.";

            this.value = "";

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


        const preview =
            URL.createObjectURL(file);


        showPhoto(preview);


        status.textContent =
            "📷 Photo selected. Click Save Profile.";

    }
);


/* =========================================================
   SHOW PHOTO
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
        "⏳ Uploading photo...";


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
            .getPublicUrl(
                filePath
            );


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


        const name =
            fullName.value.trim();


        if (!name) {

            status.textContent =
                "❌ Please enter your full name.";

            return;

        }


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

            const profileData = {

                id:
                    currentUser.id,

                full_name:
                    name,

                email:
                    currentUser.email || "",

                phone:
                    phone.value.trim(),

                course:
                    course.value.trim(),

                level:
                    level.value.trim()

            };


            if (photoURL) {

                profileData.photo_url =
                    photoURL;

            }


            /* =============================================
               UPSERT
               ============================================= */

            const {
                error
            } =
                await supabase
                    .from("students")
                    .upsert(
                        profileData,
                        {
                            onConflict: "id"
                        }
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


        } catch (error) {

            console.error(
                "Profile save error:",
                error
            );


            status.textContent =
                "❌ " + error.message;


        } finally {

            saveButton.disabled =
                false;


            saveButton.textContent =
                "💾 Save Profile";

        }

    }
);
