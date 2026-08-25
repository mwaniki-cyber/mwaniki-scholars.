import { supabase } from "./supabase.js";

// ============================================================
// MWANIKI SCHOLARS — STUDENT DASHBOARD
// PERSONAL PROFILE + DASHBOARD IDENTITY
// COURSES ARE HANDLED BY courses.js
// ============================================================

console.log("🎓 Mwaniki Scholars Dashboard Loaded");


// ============================================================
// GET CURRENT USER
// ============================================================

async function getCurrentUser() {

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {

        console.error(
            "❌ Session error:",
            error
        );

        return null;
    }

    if (!data || !data.session) {

        console.warn(
            "⚠️ No active Supabase session."
        );

        return null;
    }

    return data.session.user;
}


// ============================================================
// LOAD STUDENT PROFILE
// ============================================================

async function loadStudentProfile() {

    console.log(
        "👤 Loading personal student profile..."
    );

    const user =
        await getCurrentUser();

    if (!user) {

        console.warn(
            "⚠️ No logged-in student."
        );

        return;
    }


    console.log(
        "✅ Logged-in user:",
        user.email
    );


    // ========================================================
    // FIND PROFILE USING AUTH USER UID
    // ========================================================

    const {
        data: student,
        error
    } = await supabase
        .from("students")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();


    if (error) {

        console.error(
            "❌ Could not load student profile:",
            error
        );

        return;
    }


    // ========================================================
    // PROFILE DOES NOT EXIST
    // ========================================================

    if (!student) {

        console.warn(
            "⚠️ No student profile exists for UID:",
            user.id
        );

        showIncompleteProfile(
            user
        );

        return;
    }


    console.log(
        "✅ Student profile found:",
        student
    );


    displayStudentIdentity(
        student,
        user
    );
}


// ============================================================
// DISPLAY STUDENT IDENTITY
// ============================================================

function displayStudentIdentity(
    student,
    user
) {

    const name =
        student.full_name ||
        "Student";


    const email =
        student.email ||
        user.email ||
        "";


    const course =
        student.course ||
        "Course not set";


    const level =
        student.level ||
        "Level not set";


    const phone =
        student.phone ||
        "";


    const photo =
        student.photo_url ||
        "";


    // ========================================================
    // TOP PROFILE BUTTON
    // ========================================================

    const profileButton =
        document.querySelector(".profile");


    if (profileButton) {

        profileButton.innerHTML = "";


        if (photo) {

            const image =
                document.createElement("img");

            image.src =
                photo;

            image.alt =
                "Profile photo";

            image.style.cssText = `
                width:38px;
                height:38px;
                border-radius:50%;
                object-fit:cover;
                vertical-align:middle;
                margin-right:8px;
            `;

            profileButton.appendChild(
                image
            );
        }


        const nameElement =
            document.createElement("span");

        nameElement.textContent =
            name;


        profileButton.appendChild(
            nameElement
        );


        profileButton.style.cursor =
            "pointer";


        profileButton.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };
    }


    // ========================================================
    // DASHBOARD CONTAINER
    // ========================================================

    const container =
        document.querySelector(
            ".container"
        );


    if (!container) {

        console.warn(
            "⚠️ .container not found."
        );

        return;
    }


    // ========================================================
    // REMOVE OLD PERSONAL PROFILE
    // ========================================================

    const oldProfile =
        document.getElementById(
            "studentPersonalProfile"
        );


    if (oldProfile) {

        oldProfile.remove();
    }


    // ========================================================
    // CREATE PERSONAL PROFILE CARD
    // ========================================================

    const profileCard =
        document.createElement("section");


    profileCard.id =
        "studentPersonalProfile";


    profileCard.style.cssText = `
        background:
            linear-gradient(
                135deg,
                #063970,
                #0b7285
            );

        color:#ffffff;

        padding:28px;

        margin-bottom:25px;

        border-radius:20px;

        box-shadow:
            0 10px 30px
            rgba(0,0,0,.15);
    `;


    // ========================================================
    // PROFILE CONTENT
    // ========================================================

    const profileLayout =
        document.createElement("div");


    profileLayout.style.cssText = `
        display:flex;
        align-items:center;
        gap:20px;
        flex-wrap:wrap;
    `;


    // ========================================================
    // PHOTO
    // ========================================================

    const photoArea =
        document.createElement("div");


    if (photo) {

        const image =
            document.createElement("img");


        image.src =
            photo;


        image.alt =
            `${name} profile photo`;


        image.style.cssText = `
            width:85px;
            height:85px;
            border-radius:50%;
            object-fit:cover;
            border:3px solid white;
        `;


        photoArea.appendChild(
            image
        );

    } else {

        const placeholder =
            document.createElement("div");


        placeholder.textContent =
            "👤";


        placeholder.style.cssText = `
            width:85px;
            height:85px;
            border-radius:50%;
            background:rgba(255,255,255,.18);
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:42px;
            border:3px solid rgba(255,255,255,.5);
        `;


        photoArea.appendChild(
            placeholder
        );
    }


    // ========================================================
    // INFORMATION
    // ========================================================

    const information =
        document.createElement("div");


    information.style.flex =
        "1";


    const welcome =
        document.createElement("div");


    welcome.textContent =
        `Welcome, ${name}`;


    welcome.style.cssText = `
        font-size:25px;
        font-weight:bold;
        margin-bottom:8px;
    `;


    information.appendChild(
        welcome
    );


    const emailLine =
        document.createElement("div");


    emailLine.textContent =
        `📧 ${email}`;


    information.appendChild(
        emailLine
    );


    const courseLine =
        document.createElement("div");


    courseLine.textContent =
        `🎓 ${course}`;


    courseLine.style.marginTop =
        "5px";


    information.appendChild(
        courseLine
    );


    const levelLine =
        document.createElement("div");


    levelLine.textContent =
        `📚 ${level}`;


    levelLine.style.marginTop =
        "5px";


    information.appendChild(
        levelLine
    );


    if (phone) {

        const phoneLine =
            document.createElement("div");


        phoneLine.textContent =
            `📱 ${phone}`;


        phoneLine.style.marginTop =
            "5px";


        information.appendChild(
            phoneLine
        );
    }


    // ========================================================
    // MY PROFILE BUTTON
    // ========================================================

    const myProfileButton =
        document.createElement("button");


    myProfileButton.type =
        "button";


    myProfileButton.textContent =
        "👤 My Profile";


    myProfileButton.style.cssText = `
        background:white;
        color:#063970;
        border:none;
        padding:12px 18px;
        border-radius:10px;
        cursor:pointer;
        font-weight:bold;
    `;


    myProfileButton.onclick =
        function () {

            window.location.href =
                "studentProfile.html";

        };


    // ========================================================
    // BUILD PROFILE
    // ========================================================

    profileLayout.appendChild(
        photoArea
    );


    profileLayout.appendChild(
        information
    );


    profileLayout.appendChild(
        myProfileButton
    );


    profileCard.appendChild(
        profileLayout
    );


    // ========================================================
    // INSERT PROFILE ABOVE COURSES
    // ========================================================

    container.prepend(
        profileCard
    );


    console.log(
        "✅ Personal student profile displayed."
    );
}


// ============================================================
// NO PROFILE FOUND
// ============================================================

function showIncompleteProfile(user) {

    const container =
        document.querySelector(
            ".container"
        );


    if (!container) {

        return;
    }


    const oldProfile =
        document.getElementById(
            "studentPersonalProfile"
        );


    if (oldProfile) {

        oldProfile.remove();
    }


    const profileCard =
        document.createElement("section");


    profileCard.id =
        "studentPersonalProfile";


    profileCard.style.cssText = `
        background:
            linear-gradient(
                135deg,
                #063970,
                #0b7285
            );

        color:white;

        padding:28px;

        margin-bottom:25px;

        border-radius:20px;

        box-shadow:
            0 10px 30px
            rgba(0,0,0,.15);
    `;


    profileCard.innerHTML = `
        <div
            style="
                display:flex;
                align-items:center;
                gap:20px;
                flex-wrap:wrap;
            "
        >

            <div
                style="
                    width:80px;
                    height:80px;
                    border-radius:50%;
                    background:rgba(255,255,255,.18);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:40px;
                "
            >
                👤
            </div>

            <div style="flex:1">

                <div
                    style="
                        font-size:24px;
                        font-weight:bold;
                    "
                >
                    Welcome, Student
                </div>

                <div style="margin-top:7px;">
                    📧 ${user.email || ""}
                </div>

                <div style="margin-top:7px;">
                    Complete your personal profile
                    to personalize your dashboard.
                </div>

            </div>

            <button
                id="completeProfileButton"
                type="button"
                style="
                    background:white;
                    color:#063970;
                    border:none;
                    padding:12px 18px;
                    border-radius:10px;
                    cursor:pointer;
                    font-weight:bold;
                "
            >
                👤 Complete Profile
            </button>

        </div>
    `;


    container.prepend(
        profileCard
    );


    const button =
        document.getElementById(
            "completeProfileButton"
        );


    if (button) {

        button.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };
    }
}


// ============================================================
// START
// ============================================================

loadStudentProfile();
