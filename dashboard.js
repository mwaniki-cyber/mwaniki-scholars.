import { supabase } from "./supabase.js";

console.log("🎓 Mwaniki Scholars Dashboard Loaded");


// ============================================================
// LOAD LOGGED-IN STUDENT
// ============================================================

async function loadStudentProfile() {

    console.log("👤 Loading logged-in student...");

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();


        if (error) {

            console.error(
                "❌ Session error:",
                error
            );

            return;
        }


        const session = data?.session;


        if (!session) {

            console.warn(
                "⚠️ No active student session."
            );

            return;
        }


        const user = session.user;


        console.log(
            "✅ Logged-in student:",
            user.email
        );


        // ====================================================
        // GET STUDENT PROFILE FROM SUPABASE
        // ====================================================

        const {
            data: student,
            error: profileError
        } = await supabase
            .from("students")
            .select(
                "id, full_name, email, phone, course, level, photo_url"
            )
            .eq(
                "id",
                user.id
            )
            .maybeSingle();


        if (profileError) {

            console.error(
                "❌ Student profile error:",
                profileError
            );

            return;
        }


        // ====================================================
        // NO PROFILE ROW
        // ====================================================

        if (!student) {

            console.warn(
                "⚠️ No student profile found."
            );

            displayDefaultProfile(user);

            return;
        }


        console.log(
            "✅ Student profile loaded:",
            student
        );


        displayStudentProfile(
            student,
            user
        );

    }

    catch (error) {

        console.error(
            "❌ Dashboard error:",
            error
        );

    }
}


// ============================================================
// DISPLAY PERSONAL STUDENT PROFILE
// ============================================================

function displayStudentProfile(
    student,
    user
) {

    const name =
        student.full_name?.trim() ||
        "Student";


    const email =
        student.email ||
        user.email ||
        "";


    const course =
        student.course?.trim() ||
        "Course not set";


    const level =
        student.level?.trim() ||
        "Level not set";


    const phone =
        student.phone?.trim() ||
        "";


    const photo =
        student.photo_url ||
        "";


    // ========================================================
    // HEADER PROFILE BUTTON
    // ========================================================

    const profileButton =
        document.querySelector(".profile");


    if (profileButton) {

        profileButton.innerHTML = "";


        if (photo) {

            const img =
                document.createElement("img");


            img.src = photo;

            img.alt =
                "Student profile photo";


            img.style.cssText = `
                width:38px;
                height:38px;
                border-radius:50%;
                object-fit:cover;
                vertical-align:middle;
                margin-right:8px;
            `;


            profileButton.appendChild(img);

        }


        const text =
            document.createElement("span");


        text.textContent =
            `👤 ${name}`;


        profileButton.appendChild(text);


        profileButton.style.cursor =
            "pointer";


        profileButton.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };

    }


    // ========================================================
    // FIND DASHBOARD
    // ========================================================

    const dashboard =
        document.querySelector(
            ".container"
        );


    if (!dashboard) {

        console.warn(
            "⚠️ Dashboard .container not found."
        );

        return;
    }


    // ========================================================
    // REMOVE OLD PROFILE
    // ========================================================

    const oldProfile =
        document.getElementById(
            "studentPersonalProfile"
        );


    if (oldProfile) {

        oldProfile.remove();

    }


    // ========================================================
    // CREATE PROFILE CARD
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

        border-radius:22px;

        box-shadow:
            0 12px 35px
            rgba(0,0,0,.15);

        overflow:hidden;
    `;


    // ========================================================
    // PROFILE LAYOUT
    // ========================================================

    const layout =
        document.createElement("div");


    layout.style.cssText = `
        display:flex;

        align-items:center;

        gap:22px;

        flex-wrap:wrap;
    `;


    // ========================================================
    // PROFILE PHOTO
    // ========================================================

    const photoBox =
        document.createElement("div");


    if (photo) {

        const img =
            document.createElement("img");


        img.src =
            photo;


        img.alt =
            `${name} profile photo`;


        img.style.cssText = `
            width:90px;

            height:90px;

            border-radius:50%;

            object-fit:cover;

            border:
                4px solid
                rgba(255,255,255,.85);

            box-shadow:
                0 6px 20px
                rgba(0,0,0,.2);
        `;


        photoBox.appendChild(img);

    }

    else {

        const placeholder =
            document.createElement("div");


        placeholder.textContent =
            "👤";


        placeholder.style.cssText = `
            width:90px;

            height:90px;

            border-radius:50%;

            background:
                rgba(255,255,255,.18);

            display:flex;

            align-items:center;

            justify-content:center;

            font-size:42px;

            border:
                4px solid
                rgba(255,255,255,.5);
        `;


        photoBox.appendChild(
            placeholder
        );

    }


    // ========================================================
    // STUDENT INFORMATION
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
        font-size:26px;

        font-weight:700;

        margin-bottom:8px;
    `;


    information.appendChild(
        welcome
    );


    const emailElement =
        document.createElement("div");


    emailElement.textContent =
        `📧 ${email}`;


    emailElement.style.marginTop =
        "5px";


    information.appendChild(
        emailElement
    );


    const courseElement =
        document.createElement("div");


    courseElement.textContent =
        `🎓 ${course}`;


    courseElement.style.marginTop =
        "5px";


    information.appendChild(
        courseElement
    );


    const levelElement =
        document.createElement("div");


    levelElement.textContent =
        `📚 ${level}`;


    levelElement.style.marginTop =
        "5px";


    information.appendChild(
        levelElement
    );


    if (phone) {

        const phoneElement =
            document.createElement("div");


        phoneElement.textContent =
            `📱 ${phone}`;


        phoneElement.style.marginTop =
            "5px";


        information.appendChild(
            phoneElement
        );

    }


    // ========================================================
    // MY PROFILE BUTTON
    // ========================================================

    const profileButtonCard =
        document.createElement("button");


    profileButtonCard.type =
        "button";


    profileButtonCard.textContent =
        "👤 My Profile";


    profileButtonCard.style.cssText = `
        background:#ffffff;

        color:#063970;

        border:none;

        padding:13px 20px;

        border-radius:12px;

        cursor:pointer;

        font-weight:700;

        font-size:14px;

        box-shadow:
            0 5px 15px
            rgba(0,0,0,.15);
    `;


    profileButtonCard.addEventListener(
        "click",
        function () {

            window.location.href =
                "studentProfile.html";

        }
    );


    // ========================================================
    // BUILD PROFILE CARD
    // ========================================================

    layout.appendChild(
        photoBox
    );


    layout.appendChild(
        information
    );


    layout.appendChild(
        profileButtonCard
    );


    profileCard.appendChild(
        layout
    );


    // ========================================================
    // PUT PROFILE AT TOP OF DASHBOARD
    // ========================================================

    dashboard.prepend(
        profileCard
    );


    console.log(
        "✅ Personal student profile displayed"
    );

}


// ============================================================
// DEFAULT PROFILE
// ============================================================

function displayDefaultProfile(user) {

    const dashboard =
        document.querySelector(
            ".container"
        );


    if (!dashboard) {

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

        border-radius:22px;

        box-shadow:
            0 12px 35px
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
                    width:85px;
                    height:85px;
                    border-radius:50%;
                    background:
                        rgba(255,255,255,.18);
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
                        font-size:25px;
                        font-weight:700;
                    "
                >
                    Welcome, Student
                </div>


                <div
                    style="
                        margin-top:7px;
                    "
                >
                    📧 ${user.email || ""}
                </div>


                <div
                    style="
                        margin-top:7px;
                    "
                >
                    Complete your personal profile
                    to personalize your dashboard.
                </div>

            </div>


            <button
                id="completeStudentProfile"
                type="button"
                style="
                    background:white;
                    color:#063970;
                    border:none;
                    padding:13px 20px;
                    border-radius:12px;
                    cursor:pointer;
                    font-weight:bold;
                "
            >
                👤 Complete Profile
            </button>

        </div>

    `;


    dashboard.prepend(
        profileCard
    );


    const button =
        document.getElementById(
            "completeStudentProfile"
        );


    if (button) {

        button.onclick =
            function () {

                window.location.href =
                    "studentProfile.html";

            };

    }


    console.warn(
        "⚠️ Authenticated user has no students table row."
    );

}


// ============================================================
// START DASHBOARD
// ============================================================

loadStudentProfile();
