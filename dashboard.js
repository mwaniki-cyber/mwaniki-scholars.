import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
   COMPLETE VERSION
   ---------------------------------------------------------
   IMPORTANT ARCHITECTURE:

   Mwaniki AI = separate system / aiTutor.html

   Turbo AI = separate dashboard system

   Turbo AI MUST NOT use Mwaniki AI DOM IDs,
   storage keys, handlers or backend code.
========================================================= */

console.log("🚀 Mwaniki Scholars dashboard engine loaded");

/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;
let currentStudent = null;

let allCourses = [];
let allNotes = [];
let allQuizzes = [];

let dashboardReady = false;
let dashboardInitializing = false;
let dashboardClockTimer = null;

/* =========================================================
   CONFIGURATION
========================================================= */

const PROFILE_PHOTO_BUCKET = "student-profiles";

const MAX_PROFILE_PHOTO_SIZE =
    5 * 1024 * 1024;

const NOTIFICATION_STORAGE_PREFIX =
    "mwanikiNotifications_";

const NOTIFICATION_STATE_PREFIX =
    "mwanikiNotificationState_";

const APP_UPDATE_ID =
    "mwaniki-dashboard-update-2026-09";

/* =========================================================
   TURBO AI CONFIGURATION
   ---------------------------------------------------------
   COMPLETELY SEPARATE FROM MWANIKI AI
========================================================= */

const TURBO_AI_FUNCTION_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co/functions/v1/turbo-ai";

const TURBO_AI_LAST_QUESTION_KEY =
    "mwanikiTurboAILastQuestion";

const TURBO_AI_RECENT_QUESTIONS_KEY =
    "mwanikiTurboAIRecentQuestions";

/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(
        document.querySelectorAll(selector)
    );
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent =
            value ?? "";
    }
}

function setHTML(selector, value) {
    const element = $(selector);

    if (element) {
        element.innerHTML =
            value ?? "";
    }
}

function showElement(
    selector,
    displayValue = ""
) {
    const element = $(selector);

    if (element) {
        element.style.display =
            displayValue;
    }
}

function hideElement(selector) {
    const element = $(selector);

    if (element) {
        element.style.display =
            "none";
    }
}

function escapeHTML(value) {
    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

function setCounterText(
    selector,
    value
) {
    const element = $(selector);

    if (element) {
        element.textContent =
            Number(value || 0).toLocaleString();
    }
}

/* =========================================================
   FORM FIELD HELPERS
========================================================= */

function getFieldValue(selector) {
    const element = $(selector);

    return element
        ? String(element.value || "").trim()
        : "";
}

function setFieldValue(
    selector,
    value
) {
    const element = $(selector);

    if (element) {
        element.value =
            value ?? "";
    }
}

/* =========================================================
   USER-FACING STATUS
========================================================= */

function showMessage(
    message,
    type = "info"
) {
    const status =
        $("#dashboardMessage") ||
        $("#profileMessage") ||
        $("#statusMessage");

    if (!status) {
        console.log(
            `[${type}]`,
            message
        );
        return;
    }

    status.textContent =
        message || "";

    status.dataset.messageType =
        type;

    status.style.display =
        message
            ? ""
            : "none";
}

/* =========================================================
   STORAGE HELPERS
========================================================= */

function readStorage(
    key,
    fallback = null
) {
    try {
        const raw =
            localStorage.getItem(key);

        if (raw === null) {
            return fallback;
        }

        return JSON.parse(raw);

    } catch (error) {

        console.warn(
            `⚠️ Could not read localStorage key "${key}".`,
            error
        );

        return fallback;
    }
}

function writeStorage(
    key,
    value
) {
    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

        return true;

    } catch (error) {

        console.error(
            `❌ Could not write localStorage key "${key}".`,
            error
        );

        return false;
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn(
            "⚠️ Could not remove storage key:",
            key,
            error
        );
    }
}

/* =========================================================
   COURSE NORMALIZATION
========================================================= */

function normalizeCourse(course) {

    if (!course) {
        return null;
    }

    const id =
        course.id ??
        course.courseId ??
        course.course_id;

    if (
        id === undefined ||
        id === null ||
        id === ""
    ) {
        return null;
    }

    const title =
        course.title ||
        course.courseTitle ||
        course.course_name ||
        course.name ||
        "Untitled Course";

    return {
        id,
        title,
        description:
            course.description || "",
        image:
            course.image || "",
        created_at:
            course.created_at || null
    };
}

/* =========================================================
   COURSE URL
========================================================= */

function getCourseURL(course) {

    const normalized =
        normalizeCourse(course);

    if (!normalized) {
        return "./course.html";
    }

    return (
        `./course.html?course_id=` +
        encodeURIComponent(
            normalized.id
        )
    );
}

/* =========================================================
   RECENT COURSE STORAGE
========================================================= */

function getLastCourse() {

    return normalizeCourse(
        readStorage(
            "mwanikiLastCourse",
            null
        )
    );
}

function saveLastCourse(course) {

    const normalized =
        normalizeCourse(course);

    if (!normalized) {
        return;
    }

    writeStorage(
        "mwanikiLastCourse",
        normalized
    );
}

function getRecentCourses() {

    const courses =
        readStorage(
            "mwanikiRecentCourses",
            []
        );

    if (!Array.isArray(courses)) {
        return [];
    }

    return courses
        .map(normalizeCourse)
        .filter(Boolean);
}

function saveRecentCourse(course) {

    const normalized =
        normalizeCourse(course);

    if (!normalized) {
        return;
    }

    const existing =
        getRecentCourses();

    const filtered =
        existing.filter(
            item =>
                String(item.id) !==
                String(normalized.id)
        );

    filtered.unshift(
        normalized
    );

    writeStorage(
        "mwanikiRecentCourses",
        filtered.slice(0, 8)
    );
}

function saveSelectedCourse(course) {

    const normalized =
        normalizeCourse(course);

    if (!normalized) {
        return;
    }

    writeStorage(
        "selectedCourse",
        normalized.id
    );

    localStorage.setItem(
        "selectedCourse",
        String(normalized.id)
    );

    localStorage.setItem(
        "selectedCourseName",
        normalized.title
    );

    saveLastCourse(
        normalized
    );

    saveRecentCourse(
        normalized
    );
}

/* =========================================================
   COURSE OPENING
========================================================= */

function openCourse(course) {

    const normalized =
        normalizeCourse(course);

    if (!normalized) {

        console.warn(
            "⚠️ Cannot open invalid course.",
            course
        );

        return;
    }

    saveSelectedCourse(
        normalized
    );

    window.location.href =
        getCourseURL(
            normalized
        );
}

window.mwanikiOpenCourse =
    openCourse;

/* =========================================================
   COURSE COMMUNITY
   ---------------------------------------------------------
   IMPORTANT:

   Community is keyed by COURSE ID.

   This is necessary because courses can have the same
   name but different IDs, e.g. Clinical Pharmacology.
========================================================= */

function openCourseCommunity(
    course
) {

    const normalized =
        normalizeCourse(course);

    if (!normalized) {

        console.warn(
            "⚠️ Cannot open community for invalid course.",
            course
        );

        return;
    }

    /*
     * Store the exact course identity.
     */
    localStorage.setItem(
        "communityCourseId",
        String(normalized.id)
    );

    localStorage.setItem(
        "communityCourseName",
        normalized.title
    );

    /*
     * Also keep the normal selected-course state
     * synchronized.
     */
    saveSelectedCourse(
        normalized
    );

    /*
     * Pass the course ID directly in the URL.
     * community.js should use this ID as its primary
     * course identity.
     */
    const communityURL =
        `./community.html?course_id=${encodeURIComponent(
            normalized.id
        )}`;

    console.log(
        "💬 Opening course community:",
        {
            courseId:
                normalized.id,
            courseName:
                normalized.title
        }
    );

    window.location.href =
        communityURL;
}

window.mwanikiOpenCourseCommunity =
    openCourseCommunity;

/* =========================================================
   LIVE DATE AND TIME
========================================================= */

function updateCurrentDate() {

    const element =
        $("#currentDate");

    if (!element) {
        return;
    }

    const now =
        new Date();

    element.textContent =
        now.toLocaleDateString(
            "en-KE",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
}

function startDashboardClock() {

    updateCurrentDate();

    if (dashboardClockTimer) {
        clearInterval(
            dashboardClockTimer
        );
    }

    dashboardClockTimer =
        setInterval(
            updateCurrentDate,
            60000
        );
}

/* =========================================================
   AUTHENTICATION
========================================================= */

async function getAuthenticatedUser() {

    try {

        const {
            data,
            error
        } =
            await supabase.auth.getUser();

        if (error) {

            console.error(
                "❌ Authentication check failed:",
                error
            );

            return null;
        }

        return data?.user || null;

    } catch (error) {

        console.error(
            "❌ Unexpected authentication error:",
            error
        );

        return null;
    }
}

function handleSignedOut() {

    currentUser = null;
    currentStudent = null;
    dashboardReady = false;

    if (dashboardClockTimer) {

        clearInterval(
            dashboardClockTimer
        );

        dashboardClockTimer =
            null;
    }

    window.location.href =
        "./index.html";
}

/* =========================================================
   STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {

    if (!currentUser) {
        return false;
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from("students")
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    course,
                    level,
                    photo_url,
                    created_at
                `)
                .eq(
                    "id",
                    currentUser.id
                )
                .maybeSingle();

        if (error) {

            console.error(
                "❌ Student profile loading failed:",
                error
            );

            currentStudent = {
                id:
                    currentUser.id,
                full_name:
                    currentUser.user_metadata?.full_name ||
                    currentUser.user_metadata?.name ||
                    currentUser.email?.split("@")[0] ||
                    "Student",
                email:
                    currentUser.email || "",
                phone:
                    currentUser.user_metadata?.phone || "",
                course:
                    currentUser.user_metadata?.course || "",
                level:
                    currentUser.user_metadata?.level || "",
                photo_url:
                    currentUser.user_metadata?.photo_url || ""
            };

            renderStudentProfile();

            return false;
        }

        if (data) {

            currentStudent =
                data;

        } else {

            currentStudent = {

                id:
                    currentUser.id,

                full_name:
                    currentUser.user_metadata?.full_name ||
                    currentUser.user_metadata?.name ||
                    currentUser.email?.split("@")[0] ||
                    "Student",

                email:
                    currentUser.email || "",

                phone:
                    currentUser.user_metadata?.phone || "",

                course:
                    currentUser.user_metadata?.course || "",

                level:
                    currentUser.user_metadata?.level || "",

                photo_url:
                    currentUser.user_metadata?.photo_url || ""
            };
        }

        renderStudentProfile();

        return true;

    } catch (error) {

        console.error(
            "❌ Unexpected student profile error:",
            error
        );

        return false;
    }
}

function getStudentDisplayName() {

    return (
        currentStudent?.full_name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        currentUser?.email?.split("@")[0] ||
        "Student"
    );
}

function getStudentFirstName() {

    const name =
        getStudentDisplayName()
            .trim();

    return (
        name.split(/\s+/)[0] ||
        "Student"
    );
}


/* =========================================================
   PROFILE AVATAR
   ---------------------------------------------------------
   IMPORTANT:
   The student's personal photo comes ONLY from:

   students.photo_url

   Supabase Storage bucket:

   student-profiles

   The favicon is NEVER used as a profile photo.
========================================================= */

function createInitialsAvatar(name) {

    const safeName =
        String(
            name || "Student"
        ).trim();

    const initials =
        safeName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
                word =>
                    word
                        .charAt(0)
                        .toUpperCase()
            )
            .join("");

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="160"
            height="160"
            viewBox="0 0 160 160"
        >

            <rect
                width="160"
                height="160"
                rx="80"
                fill="#087f73"
            />

            <text
                x="80"
                y="96"
                text-anchor="middle"
                font-size="54"
                font-family="Arial, sans-serif"
                font-weight="700"
                fill="#ffffff"
            >
                ${escapeHTML(initials || "S")}
            </text>

        </svg>
    `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}


/* =========================================================
   GET THE AUTHENTIC STUDENT PHOTO
========================================================= */

function getStudentPhotoURL() {

    const photoURL =
        String(
            currentStudent?.photo_url || ""
        ).trim();

    if (!photoURL) {

        console.log(
            "ℹ️ This student has no saved photo_url."
        );

        return "";
    }

    console.log(
        "🖼️ Student photo_url found:",
        photoURL
    );

    return photoURL;
}


/* =========================================================
   APPLY AVATAR
========================================================= */

function setAvatar(
    selector,
    photoURL,
    name
) {

    const element =
        $(selector);

    if (!element) {

        console.warn(
            `⚠️ Avatar element not found: ${selector}`
        );

        return;
    }

    const fallbackURL =
        createInitialsAvatar(name);


    /*
        Always start with the initials avatar.

        This prevents the favicon from appearing
        while the real Supabase image loads.
    */

    element.src =
        fallbackURL;

    element.alt =
        `${name} profile photo`;

    element.style.display =
        "block";

    element.style.visibility =
        "visible";

    element.style.opacity =
        "1";


    /*
        No personal photo exists.
    */

    if (!photoURL) {

        return;
    }


    /*
        Load the real personal photo.

        We create a separate Image object first.
        This prevents a broken Supabase URL from
        replacing the working avatar.
    */

    const testImage =
        new Image();

    testImage.onload =
        function () {

            element.src =
                photoURL;

            element.alt =
                `${name} profile photo`;

            element.style.display =
                "block";

            element.style.visibility =
                "visible";

            element.style.opacity =
                "1";

            console.log(
                `✅ Personal profile photo loaded: ${selector}`
            );
        };


    testImage.onerror =
        function () {

            console.error(
                `❌ Personal profile photo could not be loaded: ${photoURL}`
            );

            /*
                Keep initials avatar.
            */

            element.src =
                fallbackURL;
        };


    /*
        Force the browser to fetch the actual
        Supabase image rather than relying on an
        old cached image.
    */

    const separator =
        photoURL.includes("?")
            ? "&"
            : "?";

    testImage.src =
        `${photoURL}${separator}profile_load=${Date.now()}`;
}


/* =========================================================
   DISPLAY STUDENT PROFILE IMAGE
========================================================= */

function displayProfileImage() {

    const displayName =
        getStudentDisplayName();

    const imageURL =
        getStudentPhotoURL();


    setAvatar(
        "#headerProfileAvatar",
        imageURL,
        displayName
    );


    setAvatar(
        "#profileLargeAvatar",
        imageURL,
        displayName
    );


    if (imageURL) {

        console.log(
            "🖼️ Loading student's personal Supabase profile photo."
        );

    } else {

        console.log(
            "ℹ️ No personal profile photo saved. Using initials avatar."
        );
    }
}
/* =========================================================
   PROFILE RENDERING
========================================================= */

function renderStudentProfile() {

    const name =
        getStudentDisplayName();

    const firstName =
        getStudentFirstName();

    const email =
        currentStudent?.email ||
        currentUser?.email ||
        "";

    setText(
        "#studentName",
        name
    );

    setText(
        "#profileName",
        name
    );

    setText(
        "#welcomeName",
        firstName
    );

    setText(
        "#profileEmailDisplay",
        email
    );

    setFieldValue(
        "#profileFullName",
        name
    );

    setFieldValue(
        "#profileEmail",
        email
    );

    setFieldValue(
        "#profilePhone",
        currentStudent?.phone || ""
    );

    setFieldValue(
        "#profileCourse",
        currentStudent?.course || ""
    );

    setFieldValue(
        "#profileLevel",
        currentStudent?.level || ""
    );

    displayProfileImage();
}

/* =========================================================
   PROFILE PANEL
========================================================= */

function setPanelOpen(
    panel,
    shouldOpen
) {

    if (!panel) {

        console.warn(
            "⚠️ setPanelOpen(): panel was not found."
        );

        return;
    }


    /* =====================================================
       OPEN PANEL
    ===================================================== */

    if (shouldOpen) {

        panel.classList.add(
            "active"
        );

        panel.classList.add(
            "open"
        );

        panel.setAttribute(
            "aria-hidden",
            "false"
        );

        panel.hidden =
            false;

        panel.style.display =
            "flex";

        panel.style.visibility =
            "visible";

        panel.style.opacity =
            "1";

        panel.style.pointerEvents =
            "auto";

        panel.style.zIndex =
            "10000";

    }


    /* =====================================================
       CLOSE PANEL
    ===================================================== */

    else {

        panel.classList.remove(
            "active"
        );

        panel.classList.remove(
            "open"
        );

        panel.setAttribute(
            "aria-hidden",
            "true"
        );

        panel.hidden =
            true;

        panel.style.display =
            "none";

        panel.style.visibility =
            "hidden";

        panel.style.opacity =
            "0";

        panel.style.pointerEvents =
            "none";
    }
}


/* =========================================================
   OPEN PROFILE PANEL
========================================================= */

function openProfilePanel() {

    const panel =
        $("#profilePanel");

    if (!panel) {

        console.warn(
            "⚠️ #profilePanel was not found."
        );

        return;
    }

    setPanelOpen(
        panel,
        true
    );
}


/* =========================================================
   CLOSE PROFILE PANEL
========================================================= */

function closeProfilePanel() {

    const panel =
        $("#profilePanel");

    if (!panel) {
        return;
    }

    setPanelOpen(
        panel,
        false
    );
}


/* =========================================================
   SETUP PROFILE PANEL
========================================================= */

function setupProfilePanel() {

    const button =
        $("#profileButton");

    const closeButton =
        $("#closeProfilePanel");

    const panel =
        $("#profilePanel");


    /* =====================================================
       REQUIRED ELEMENT CHECK
    ===================================================== */

    if (!button) {

        console.error(
            "❌ #profileButton was not found."
        );

        return;
    }

    if (!panel) {

        console.error(
            "❌ #profilePanel was not found."
        );

        return;
    }


    /* =====================================================
       PREVENT DUPLICATE EVENT LISTENERS
    ===================================================== */

    if (
        button.dataset.profileReady === "true"
    ) {

        console.log(
            "👤 Profile panel is already initialized."
        );

        return;
    }

    button.dataset.profileReady =
        "true";


    /* =====================================================
       START CLOSED
    ===================================================== */

    setPanelOpen(
        panel,
        false
    );


    /* =====================================================
       PROFILE BUTTON
    ===================================================== */

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            const isOpen =
                panel.classList.contains(
                    "active"
                ) ||
                panel.getAttribute(
                    "aria-hidden"
                ) === "false";


            if (isOpen) {

                closeProfilePanel();

                return;
            }


            /* =============================================
               REFRESH PROFILE CONTENT
            ============================================= */

            renderStudentProfile();


            /* =============================================
               OPEN PROFILE PANEL
            ============================================= */

            openProfilePanel();

        }
    );


    /* =====================================================
       CLOSE BUTTON
    ===================================================== */

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                closeProfilePanel();

            }
        );

    } else {

        console.warn(
            "⚠️ #closeProfilePanel was not found."
        );
    }


    console.log(
        "👤 Profile panel ready."
    );
}

/* =========================================================
   REPAIR PROFILE FIELDS
========================================================= */

function repairProfileFields() {

    if (!currentStudent) {
        return;
    }

    setFieldValue(
        "#profileFullName",
        currentStudent.full_name ||
            getStudentDisplayName()
    );

    setFieldValue(
        "#profileEmail",
        currentStudent.email ||
            currentUser?.email ||
            ""
    );

    setFieldValue(
        "#profilePhone",
        currentStudent.phone ||
            ""
    );

    setFieldValue(
        "#profileCourse",
        currentStudent.course ||
            ""
    );

    setFieldValue(
        "#profileLevel",
        currentStudent.level ||
            ""
    );
}

/* =========================================================
   SAVE STUDENT PROFILE
========================================================= */

function setupProfileForm() {

    const button =
        $("#saveProfileButton");

    if (!button) {
        return;
    }

    button.onclick =
        async function (event) {

            event.preventDefault();

            await saveStudentProfile();
        };
}

async function saveStudentProfile() {

    if (!currentUser) {
        return;
    }

    const fullName =
        getFieldValue(
            "#profileFullName"
        );

    const phone =
        getFieldValue(
            "#profilePhone"
        );

    const course =
        getFieldValue(
            "#profileCourse"
        );

    const level =
        getFieldValue(
            "#profileLevel"
        );

    if (!fullName) {

        showMessage(
            "Please enter your full name.",
            "warning"
        );

        return;
    }

    const button =
        $("#saveProfileButton");

    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Saving...";
    }

    try {

        const {
            data,
            error
        } =
            await supabase
                .from("students")
                .update({
                    full_name:
                        fullName,
                    phone,
                    course,
                    level
                })
                .eq(
                    "id",
                    currentUser.id
                )
                .select()
                .maybeSingle();

        if (error) {
            throw error;
        }

        currentStudent = {
            ...(currentStudent || {}),
            ...(data || {}),
            id:
                currentUser.id,
            full_name:
                fullName,
            phone,
            course,
            level
        };

        renderStudentProfile();

        showMessage(
            "Profile updated successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "❌ Profile update failed:",
            error
        );

        showMessage(
            error.message ||
                "Unable to update your profile.",
            "error"
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Save Profile";
        }
    }
}

/* =========================================================
   PROFILE PHOTO UPLOAD
========================================================= */

function sanitizeFileName(
    fileName
) {

    return String(
        fileName || "profile"
    )
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        );
}

async function uploadProfilePhoto(
    file
) {

    if (!currentUser || !file) {
        return false;
    }

    if (!file.type.startsWith("image/")) {

        showMessage(
            "Please select an image file.",
            "warning"
        );

        return false;
    }

    if (
        file.size >
        MAX_PROFILE_PHOTO_SIZE
    ) {

        showMessage(
            "Profile image must be 5 MB or smaller.",
            "warning"
        );

        return false;
    }

    try {

        const extension =
            (
                file.name
                    .split(".")
                    .pop() ||
                "jpg"
            )
                .toLowerCase();

        const safeExtension =
            sanitizeFileName(
                extension
            );

        const path =
            `${currentUser.id}/${Date.now()}-profile.${safeExtension}`;

        const {
            error:
                uploadError
        } =
            await supabase
                .storage
                .from(
                    PROFILE_PHOTO_BUCKET
                )
                .upload(
                    path,
                    file,
                    {
                        upsert: true,
                        contentType:
                            file.type
                    }
                );

        if (uploadError) {
            throw uploadError;
        }

        const {
            data:
                publicData
        } =
            supabase
                .storage
                .from(
                    PROFILE_PHOTO_BUCKET
                )
                .getPublicUrl(
                    path
                );

        const publicURL =
            publicData?.publicUrl || "";

        if (!publicURL) {
            throw new Error(
                "Could not obtain the public profile image URL."
            );
        }

        const {
            error:
                updateError
        } =
            await supabase
                .from("students")
                .update({
                    photo_url:
                        publicURL
                })
                .eq(
                    "id",
                    currentUser.id
                );

        if (updateError) {
            throw updateError;
        }

        currentStudent = {
            ...(currentStudent || {}),
            photo_url:
                publicURL
        };

        displayProfileImage();

        showMessage(
            "Profile photo updated successfully.",
            "success"
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Profile photo upload failed:",
            error
        );

        showMessage(
            error.message ||
                "Unable to upload profile photo.",
            "error"
        );

        return false;
    }
}

function setupProfilePhoto() {

    const input =
        $("#profilePhotoInput");

    if (!input) {
        return;
    }

    input.onchange =
        async function () {

            const file =
                input.files?.[0];

            if (!file) {
                return;
            }

            const preview =
                $("#profilePhotoPreview");

            if (preview) {

                const objectURL =
                    URL.createObjectURL(
                        file
                    );

                if (
                    preview.tagName
                        .toLowerCase() ===
                    "img"
                ) {

                    preview.src =
                        objectURL;

                } else {

                    preview.innerHTML = `
                        <img
                            src="${objectURL}"
                            alt="Profile photo preview"
                        >
                    `;
                }
            }

            await uploadProfilePhoto(
                file
            );

            input.value = "";
        };
}

/* =========================================================
   PASSWORD RESET
========================================================= */

function setupChangePassword() {

    const button =
        $("#changePasswordButton");

    if (!button) {
        return;
    }

    button.onclick =
        async function (event) {

            event.preventDefault();

            if (!currentUser?.email) {
                return;
            }

            button.disabled =
                true;

            button.textContent =
                "Sending...";

            try {

                const {
                    error
                } =
                    await supabase.auth
                        .resetPasswordForEmail(
                            currentUser.email,
                            {
                                redirectTo:
                                    `${window.location.origin}${window.location.pathname}`
                            }
                        );

                if (error) {
                    throw error;
                }

                showMessage(
                    "Password reset instructions have been sent to your email.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "❌ Password reset failed:",
                    error
                );

                showMessage(
                    error.message ||
                        "Unable to send password reset instructions.",
                    "error"
                );

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    "Change Password";
            }
        };
}

/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    const button =
        $("#logoutButton");

    if (!button) {
        return;
    }

    button.onclick =
        async function (event) {

            event.preventDefault();

            button.disabled =
                true;

            try {

                const {
                    error
                } =
                    await supabase.auth
                        .signOut();

                if (error) {
                    throw error;
                }

                window.location.href =
                    "./index.html";

            } catch (error) {

                console.error(
                    "❌ Logout failed:",
                    error
                );

                button.disabled =
                    false;

                showMessage(
                    "Unable to sign out. Please try again.",
                    "error"
                );
            }
        };
}

/* =========================================================
   NOTIFICATION STORAGE
========================================================= */

function getNotificationStorageKey() {

    if (!currentUser?.id) {
        return null;
    }

    return (
        NOTIFICATION_STORAGE_PREFIX +
        currentUser.id
    );
}

function getNotificationStateKey() {

    if (!currentUser?.id) {
        return null;
    }

    return (
        NOTIFICATION_STATE_PREFIX +
        currentUser.id
    );
}

function getNotifications() {

    const key =
        getNotificationStorageKey();

    if (!key) {
        return [];
    }

    const notifications =
        readStorage(
            key,
            []
        );

    return Array.isArray(
        notifications
    )
        ? notifications
        : [];
}

function saveNotifications(
    notifications
) {

    const key =
        getNotificationStorageKey();

    if (!key) {
        return;
    }

    writeStorage(
        key,
        Array.isArray(
            notifications
        )
            ? notifications.slice(
                0,
                50
            )
            : []
    );
}

function getNotificationState() {

    const key =
        getNotificationStateKey();

    if (!key) {
        return {};
    }

    const state =
        readStorage(
            key,
            {}
        );

    return (
        state &&
        typeof state === "object"
    )
        ? state
        : {};
}

function saveNotificationState(
    state
) {

    const key =
        getNotificationStateKey();

    if (!key) {
        return;
    }

    writeStorage(
        key,
        state || {}
    );
}

/* =========================================================
   ADD NOTIFICATION
========================================================= */

function addNotification({
    id,
    type = "info",
    title = "Mwaniki Scholars",
    message = "",
    created_at =
        new Date().toISOString()
} = {}) {

    if (!id) {
        return;
    }

    const notifications =
        getNotifications();

    const existing =
        notifications.some(
            notification =>
                String(
                    notification.id
                ) ===
                String(id)
        );

    if (existing) {
        return;
    }

    notifications.unshift({

        id:
            String(id),

        type,

        title,

        message,

        created_at,

        read:
            false
    });

    saveNotifications(
        notifications
    );

    updateNotificationBadge();
}

/* =========================================================
   WELCOME NOTIFICATION
========================================================= */

function createWelcomeNotification() {

    if (!currentUser) {
        return;
    }

    const state =
        getNotificationState();

    if (state.welcomeSent) {
        return;
    }

    addNotification({

        id:
            `welcome-${currentUser.id}`,

        type:
            "welcome",

        title:
            "Welcome to Mwaniki Scholars",

        message:
            `Welcome, ${getStudentFirstName()}. Your medical learning dashboard is ready. Explore courses, notes and quizzes to continue learning.`,

        created_at:
            new Date().toISOString()
    });

    saveNotificationState({

        ...state,

        welcomeSent:
            true
    });
}

/* =========================================================
   CONTENT NOTIFICATIONS
========================================================= */

function syncContentNotifications() {

    if (!currentUser) {
        return;
    }

    const state =
        getNotificationState();

    const currentCourseIds =
        allCourses.map(
            course =>
                String(course.id)
        );

    const currentNoteIds =
        allNotes.map(
            note =>
                String(note.id)
        );

    /*
     * First visit establishes a baseline so existing
     * content does not generate hundreds of notifications.
     */
    if (!state.contentBaselineCreated) {

        saveNotificationState({

            ...state,

            knownCourseIds:
                currentCourseIds,

            knownNoteIds:
                currentNoteIds,

            contentBaselineCreated:
                true,

            appUpdateShown:
                Boolean(
                    state.appUpdateShown
                )
        });

    } else {

        const knownCourseIds =
            Array.isArray(
                state.knownCourseIds
            )
                ? state.knownCourseIds.map(
                    String
                )
                : [];

        const knownNoteIds =
            Array.isArray(
                state.knownNoteIds
            )
                ? state.knownNoteIds.map(
                    String
                )
                : [];

        const newCourses =
            allCourses.filter(
                course =>
                    !knownCourseIds.includes(
                        String(course.id)
                    )
            );

        const newNotes =
            allNotes.filter(
                note =>
                    !knownNoteIds.includes(
                        String(note.id)
                    )
            );

        newCourses.forEach(
            course => {

                addNotification({

                    id:
                        `course-${course.id}`,

                    type:
                        "course",

                    title:
                        "New Course Available",

                    message:
                        `${course.title} has been added to Mwaniki Scholars.`,

                    created_at:
                        course.created_at ||
                        new Date().toISOString()
                });
            }
        );

        newNotes.forEach(
            note => {

                addNotification({

                    id:
                        `note-${note.id}`,

                    type:
                        "note",

                    title:
                        "New Notes Available",

                    message:
                        `${note.file_name || note.unit || "New study notes"} is now available in the Notes Library.`,

                    created_at:
                        note.created_at ||
                        new Date().toISOString()
                });
            }
        );

        saveNotificationState({

            ...state,

            knownCourseIds:
                currentCourseIds,

            knownNoteIds:
                currentNoteIds
        });
    }

    const latestState =
        getNotificationState();

    if (
        !latestState.appUpdateShown
    ) {

        addNotification({

            id:
                APP_UPDATE_ID,

            type:
                "update",

            title:
                "Dashboard Updated",

            message:
                "Your Mwaniki Scholars dashboard has been updated with improved course navigation, notifications and learning tools.",

            created_at:
                new Date().toISOString()
        });

        saveNotificationState({

            ...latestState,

            appUpdateShown:
                true
        });
    }

    updateNotificationBadge();
}

/* =========================================================
   NOTIFICATION BADGE
========================================================= */

function updateNotificationBadge() {

    const notifications =
        getNotifications();

    const unreadCount =
        notifications.filter(
            notification =>
                !notification.read
        ).length;

    const targets =
        $all(
            "#notificationBadge, [data-notification-count], .notification-badge, .notification-count"
        );

    targets.forEach(
        badge => {

            badge.textContent =
                unreadCount > 99
                    ? "99+"
                    : String(
                        unreadCount
                    );

            badge.style.display =
                unreadCount > 0
                    ? ""
                    : "none";

            badge.setAttribute(
                "aria-hidden",
                unreadCount > 0
                    ? "false"
                    : "true"
            );
        }
    );

    const panelCount =
        $("#notificationPanelCount");

    if (panelCount) {

        panelCount.textContent =
            String(
                unreadCount
            );

        panelCount.style.display =
            unreadCount > 0
                ? ""
                : "none";
    }

    const visibleCount =
        $("#notificationCount");

    if (visibleCount) {

        visibleCount.textContent =
            String(
                unreadCount
            );

        visibleCount.style.display =
            unreadCount > 0
                ? ""
                : "none";
    }

    const button =
        $("#notificationButton");

    if (button) {

        button.setAttribute(
            "aria-label",
            unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
        );

        button.dataset.unreadCount =
            String(unreadCount);
    }
}

/* =========================================================
   FORMAT NOTIFICATION DATE
========================================================= */

function formatNotificationDate(
    timestamp
) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleString(
        "en-KE",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

/* =========================================================
   RENDER NOTIFICATIONS
========================================================= */

function renderNotifications() {

    const content =
        $("#notificationContent");

    if (!content) {

        updateNotificationBadge();

        return;
    }

    const notifications =
        getNotifications()
            .sort(
                (a, b) =>
                    new Date(
                        b.created_at || 0
                    ) -
                    new Date(
                        a.created_at || 0
                    )
            );

    if (!notifications.length) {

        content.innerHTML = `

            <div class="empty-panel">

                <strong>
                    You are all caught up.
                </strong>

                <span>
                    New learning updates will appear here.
                </span>

            </div>

        `;

        updateNotificationBadge();

        return;
    }

    content.innerHTML =
        notifications
            .map(
                notification => {

                    const unreadClass =
                        notification.read
                            ? ""
                            : " unread";

                    return `

                        <article
                            class="notification-item${unreadClass}"
                            data-notification-id="${escapeHTML(notification.id)}"
                            tabindex="0"
                        >

                            <div
                                class="notification-item-header"
                            >

                                <strong>
                                    ${escapeHTML(
                                        notification.title
                                    )}
                                </strong>

                                ${
                                    notification.read
                                        ? ""
                                        : `
                                            <span
                                                class="notification-unread-dot"
                                                aria-label="Unread"
                                            ></span>
                                        `
                                }

                            </div>

                            <p>
                                ${escapeHTML(
                                    notification.message
                                )}
                            </p>

                            <small>
                                ${escapeHTML(
                                    formatNotificationDate(
                                        notification.created_at
                                    )
                                )}
                            </small>

                        </article>

                    `;
                }
            )
            .join("");

    content
        .querySelectorAll(
            "[data-notification-id]"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "click",
                    () => {

                        markNotificationRead(
                            item.dataset
                                .notificationId
                        );

                        renderNotifications();
                    }
                );

                item.addEventListener(
                    "keydown",
                    event => {

                        if (
                            event.key ===
                                "Enter" ||
                            event.key ===
                                " "
                        ) {

                            event.preventDefault();

                            markNotificationRead(
                                item.dataset
                                    .notificationId
                            );

                            renderNotifications();
                        }
                    }
                );
            }
        );

    updateNotificationBadge();
}

/* =========================================================
   MARK NOTIFICATION READ
========================================================= */

function markNotificationRead(
    notificationId
) {

    if (!notificationId) {
        return;
    }

    const notifications =
        getNotifications();

    let changed =
        false;

    const updated =
        notifications.map(
            notification => {

                if (
                    notification.id ===
                    notificationId
                ) {

                    changed =
                        true;

                    return {
                        ...notification,
                        read: true
                    };
                }

                return notification;
            }
        );

    if (changed) {

        saveNotifications(
            updated
        );

        updateNotificationBadge();
    }
}

function markAllNotificationsRead() {

    const notifications =
        getNotifications();

    if (!notifications.length) {

        updateNotificationBadge();

        return;
    }

    const updated =
        notifications.map(
            notification => ({
                ...notification,
                read: true
            })
        );

    saveNotifications(
        updated
    );

    updateNotificationBadge();

    renderNotifications();
}

/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function openNotificationPanel() {

    const panel =
        $("#notificationPanel");

    if (!panel) {

        console.warn(
            "⚠️ #notificationPanel was not found."
        );

        return;
    }

    setPanelOpen(
        panel,
        true
    );
}


function closeNotificationPanel() {

    const panel =
        $("#notificationPanel");

    if (!panel) {
        return;
    }

    setPanelOpen(
        panel,
        false
    );
}


function setupNotificationPanel() {

    const button =
        $("#notificationButton");

    const closeButton =
        $("#closeNotificationPanel");

    const panel =
        $("#notificationPanel");


    /* =====================================================
       REQUIRED ELEMENT CHECKS
    ===================================================== */

    if (!button) {

        console.error(
            "❌ #notificationButton was not found."
        );

        return;
    }


    if (!panel) {

        console.error(
            "❌ #notificationPanel was not found."
        );

        return;
    }


    /* =====================================================
       PREVENT DUPLICATE EVENT LISTENERS
    ===================================================== */

    if (
        button.dataset.notificationReady === "true"
    ) {

        console.log(
            "🔔 Notification panel is already initialized."
        );

        return;
    }


    button.dataset.notificationReady =
        "true";


    /* =====================================================
       START CLOSED
    ===================================================== */

    setPanelOpen(
        panel,
        false
    );


    /* =====================================================
       NOTIFICATION BUTTON
    ===================================================== */

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();


            const isOpen =
                panel.classList.contains("active") ||
                panel.getAttribute("aria-hidden") === "false";


            if (isOpen) {

                closeNotificationPanel();

                return;
            }


            /* =============================================
               REFRESH NOTIFICATIONS BEFORE OPENING
            ============================================= */

            renderNotifications();


            /* =============================================
               OPEN PANEL
            ============================================= */

            openNotificationPanel();

        }
    );


    /* =====================================================
       CLOSE BUTTON
    ===================================================== */

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                closeNotificationPanel();

            }
        );

    } else {

        console.warn(
            "⚠️ #closeNotificationPanel was not found."
        );

    }


    /* =====================================================
       INITIAL BADGE UPDATE
    ===================================================== */

    updateNotificationBadge();


    console.log(
        "🔔 Notification system ready."
    );
}

/* =========================================================
   NAVIGATION
========================================================= */

function activateSection(
    sectionId
) {

    $all(
        ".nav-link"
    ).forEach(
        link => {

            const linkSection =
                link.dataset.section;

            if (!linkSection) {
                return;
            }

            const isActive =
                linkSection ===
                sectionId;

            link.classList.toggle(
                "active",
                isActive
            );

            if (isActive) {

                link.setAttribute(
                    "aria-current",
                    "page"
                );

            } else {

                link.removeAttribute(
                    "aria-current"
                );
            }
        }
    );
}

function setupNavigation() {

    $all(
        ".nav-link"
    ).forEach(
        link => {

            const sectionId =
                link.dataset.section;

            if (!sectionId) {
                return;
            }

            link.addEventListener(
                "click",
                event => {

                    const section =
                        document.getElementById(
                            sectionId
                        );

                    if (!section) {
                        return;
                    }

                    event.preventDefault();

                    activateSection(
                        sectionId
                    );

                    section.scrollIntoView(
                        {
                            behavior:
                                "smooth",

                            block:
                                "start"
                        }
                    );
                }
            );
        }
    );

    $all(
        'a[href^="#"]'
    ).forEach(
        link => {

            if (
                link.classList
                    .contains("nav-link")
            ) {
                return;
            }

            link.addEventListener(
                "click",
                event => {

                    const targetId =
                        link
                            .getAttribute(
                                "href"
                            )
                            ?.slice(1);

                    if (!targetId) {
                        return;
                    }

                    const target =
                        document.getElementById(
                            targetId
                        );

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    target.scrollIntoView(
                        {
                            behavior:
                                "smooth",

                            block:
                                "start"
                        }
                    );

                    activateSection(
                        targetId
                    );
                }
            );
        }
    );
}

/* =========================================================
   COURSE LOADING
========================================================= */

async function loadCourses() {

    const courseGrid =
        $("#courseGrid");

    if (courseGrid) {

        courseGrid.innerHTML = `

            <div class="loading-state">
                Loading courses...
            </div>

        `;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("courses")
            .select(`
                id,
                title,
                description,
                image,
                created_at
            `)
            .order(
                "id",
                {
                    ascending:
                        true
                }
            );

        if (error) {

            console.error(
                "❌ Course loading failed:",
                error
            );

            allCourses =
                [];

            if (courseGrid) {

                courseGrid.innerHTML = `

                    <div class="empty-state">
                        Unable to load courses.
                    </div>

                `;
            }

            updateDashboardStatistics();

            return;
        }

        allCourses =
            (data || [])
                .map(
                    normalizeCourse
                )
                .filter(Boolean);

        console.log(
            "📚 Courses loaded:",
            allCourses.length
        );

        renderCourseLibrary();

        renderRecentCourse();

        renderRecommendations();

        updateDashboardStatistics();

        const searchInput =
            $("#courseSearch");

        if (
            searchInput &&
            searchInput.value.trim()
        ) {

            performCourseSearch(
                false
            );
        }

    } catch (error) {

        console.error(
            "❌ Unexpected course loading error:",
            error
        );

        allCourses =
            [];

        if (courseGrid) {

            courseGrid.innerHTML = `

                <div class="empty-state">
                    An unexpected error occurred while loading courses.
                </div>

            `;
        }

        updateDashboardStatistics();
    }
}

/* =========================================================
   COURSE LIBRARY RENDERING
   ---------------------------------------------------------
   NO COURSE IMAGE
   NO IMAGE PLACEHOLDER

   COMMUNITY BUTTON ADDED
========================================================= */

function renderCourseLibrary(
    coursesToRender = allCourses
) {

    const courseGrid =
        $("#courseGrid");

    if (!courseGrid) {

        console.warn(
            "⚠️ #courseGrid was not found."
        );

        return;
    }

    if (!coursesToRender.length) {

        courseGrid.innerHTML = `

            <div class="empty-state">
                No courses match your search.
            </div>

        `;

        return;
    }

    courseGrid.innerHTML =
        coursesToRender
            .map(
                course => `

                    <article
                        class="course-card"
                        data-course-id="${escapeHTML(
                            course.id
                        )}"
                    >

                        <div
                            class="course-card-content"
                        >

                            <h3>
                                ${escapeHTML(
                                    course.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    course.description ||
                                    "Explore this medical course and begin learning."
                                )}
                            </p>

                            <div
                                class="course-card-actions"
                            >

                                <button
                                    type="button"
                                    class="course-card-button"
                                    data-open-course="${escapeHTML(
                                        course.id
                                    )}"
                                >
                                    Start Learning
                                </button>

                                <button
                                    type="button"
                                    class="course-card-button course-community-button"
                                    data-open-course-community="${escapeHTML(
                                        course.id
                                    )}"
                                >
                                    💬 Community
                                </button>

                            </div>

                        </div>

                    </article>

                `
            )
            .join("");

    /*
     * Start Learning buttons.
     */
    courseGrid
        .querySelectorAll(
            "[data-open-course]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const courseId =
                            button.dataset
                                .openCourse;

                        const course =
                            allCourses.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        courseId
                                    )
                            );

                        openCourse(
                            course
                        );
                    }
                );
            }
        );

    /*
     * Course Community buttons.
     *
     * Each button is resolved against the actual
     * course ID rather than the course title.
     */
    courseGrid
        .querySelectorAll(
            "[data-open-course-community]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const courseId =
                            button.dataset
                                .openCourseCommunity;

                        const course =
                            allCourses.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        courseId
                                    )
                            );

                        openCourseCommunity(
                            course
                        );
                    }
                );
            }
        );
}

/* =========================================================
   COURSE SEARCH
========================================================= */

function performCourseSearch(
    shouldScroll = false
) {

    const searchInput =
        $("#courseSearch");

    const searchStatus =
        $("#courseSearchStatus");

    if (!searchInput) {
        return;
    }

    const searchTerm =
        String(
            searchInput.value || ""
        )
            .trim()
            .toLowerCase();

    if (!searchTerm) {

        renderCourseLibrary(
            allCourses
        );

        if (searchStatus) {

            searchStatus.textContent =
                `${allCourses.length.toLocaleString()} courses available`;

            searchStatus.dataset.messageType =
                "info";
        }

        if (shouldScroll) {
            scrollToCourses();
        }

        return;
    }

    const matchingCourses =
        allCourses.filter(
            course => {

                const searchableText =
                    `${course.title} ${course.description || ""}`
                        .toLowerCase();

                return searchableText
                    .includes(
                        searchTerm
                    );
            }
        );

    renderCourseLibrary(
        matchingCourses
    );

    if (searchStatus) {

        searchStatus.textContent =
            `${matchingCourses.length.toLocaleString()} course${matchingCourses.length === 1 ? "" : "s"} found`;

        searchStatus.dataset.messageType =
            matchingCourses.length
                ? "success"
                : "warning";
    }

    if (shouldScroll) {
        scrollToCourses();
    }
}

function clearCourseSearch() {

    const searchInput =
        $("#courseSearch");

    const searchStatus =
        $("#courseSearchStatus");

    if (searchInput) {
        searchInput.value = "";
    }

    renderCourseLibrary(
        allCourses
    );

    if (searchStatus) {

        searchStatus.textContent =
            `${allCourses.length.toLocaleString()} courses available`;

        searchStatus.dataset.messageType =
            "info";
    }
}

function scrollToCourses() {

    const coursesSection =
        $("#courses");

    if (!coursesSection) {
        return;
    }

    coursesSection.scrollIntoView(
        {
            behavior:
                "smooth",

            block:
                "start"
        }
    );

    activateSection(
        "courses"
    );
}

function setupCourseSearch() {

    const searchInput =
        $("#courseSearch");

    const searchButton =
        $("#searchCourseButton");

    const clearButton =
        $("#clearCourseSearchButton");

    const searchStatus =
        $("#courseSearchStatus");

    if (searchInput) {

        searchInput.onkeydown =
            function (event) {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    performCourseSearch(
                        true
                    );
                }

                if (
                    event.key ===
                    "Escape"
                ) {

                    clearCourseSearch();
                }
            };

        searchInput.oninput =
            function () {

                performCourseSearch(
                    false
                );
            };
    }

    if (searchButton) {

        searchButton.onclick =
            function (event) {

                event.preventDefault();

                performCourseSearch(
                    true
                );
            };
    }

    if (clearButton) {

        clearButton.onclick =
            function (event) {

                event.preventDefault();

                clearCourseSearch();

                if (searchInput) {
                    searchInput.focus();
                }
            };
    }

    if (
        !document.body.dataset
            .courseSearchShortcutReady
    ) {

        document.body.dataset
            .courseSearchShortcutReady =
            "true";

        document.addEventListener(
            "keydown",
            function (event) {

                const activeElement =
                    document.activeElement;

                const isTyping =
                    activeElement &&
                    (
                        activeElement.tagName ===
                            "INPUT" ||
                        activeElement.tagName ===
                            "TEXTAREA" ||
                        activeElement.isContentEditable
                    );

                if (
                    event.key === "/" &&
                    !isTyping
                ) {

                    const input =
                        $("#courseSearch");

                    if (input) {

                        event.preventDefault();

                        scrollToCourses();

                        setTimeout(
                            () => {
                                input.focus();
                            },
                            250
                        );
                    }
                }
            }
        );
    }

    if (searchStatus) {

        const existingTerm =
            searchInput?.value
                ?.trim();

        if (existingTerm) {

            searchStatus.textContent =
                "Searching courses...";

        } else {

            searchStatus.textContent =
                `${allCourses.length.toLocaleString()} courses available`;

            searchStatus.dataset.messageType =
                "info";
        }
    }

    console.log(
        "🔎 Course search initialized."
    );
}

/* =========================================================
   RECENT COURSE
========================================================= */

function renderRecentCourse() {

    const recentCourse =
        getLastCourse();

    const titleElement =
        $("#recentCourseTitle");

    const descriptionElement =
        $("#recentCourseDescription");

    const buttonElement =
        $("#recentCourseButton");

    if (
        !titleElement ||
        !descriptionElement ||
        !buttonElement
    ) {
        return;
    }

    if (!recentCourse) {

        titleElement.textContent =
            "No recent course";

        descriptionElement.textContent =
            "Choose a course from the library to begin learning.";

        buttonElement.textContent =
            "Explore Courses";

        buttonElement.onclick =
            function () {

                scrollToCourses();
            };

        return;
    }

    titleElement.textContent =
        recentCourse.title;

    descriptionElement.textContent =
        recentCourse.description ||
        "Continue learning from your previously selected course.";

    buttonElement.textContent =
        "Continue Learning";

    buttonElement.onclick =
        function () {

            openCourse(
                recentCourse
            );
        };
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function renderRecommendations() {

    const recommendationsGrid =
        $("#recommendationsGrid");

    if (!recommendationsGrid) {
        return;
    }

    if (!allCourses.length) {

        recommendationsGrid.innerHTML = `

            <div class="empty-state">
                Recommendations will appear when courses are available.
            </div>

        `;

        return;
    }

    const lastCourse =
        getLastCourse();

    let recommendations =
        allCourses.filter(
            course => {

                if (!lastCourse) {
                    return true;
                }

                return (
                    String(course.id) !==
                    String(lastCourse.id)
                );
            }
        );

    if (!recommendations.length) {
        recommendations =
            allCourses;
    }

    recommendations =
        recommendations.slice(
            0,
            3
        );

    recommendationsGrid.innerHTML =
        recommendations
            .map(
                course => `

                    <article
                        class="recommendation-card"
                    >

                        <div
                            class="recommendation-card-content"
                        >

                            <span
                                class="recommendation-label"
                            >
                                Recommended for you
                            </span>

                            <h3>
                                ${escapeHTML(
                                    course.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    course.description ||
                                    "Build your medical knowledge with this course."
                                )}
                            </p>

                            <button
                                type="button"
                                class="recommendation-button"
                                data-recommendation-course="${escapeHTML(
                                    course.id
                                )}"
                            >
                                Start Learning
                            </button>

                        </div>

                    </article>

                `
            )
            .join("");

    recommendationsGrid
        .querySelectorAll(
            "[data-recommendation-course]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const courseId =
                            button.dataset
                                .recommendationCourse;

                        const course =
                            allCourses.find(
                                item =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        courseId
                                    )
                            );

                        openCourse(
                            course
                        );
                    }
                );
            }
        );
}

/* =========================================================
   NOTES LOADING
========================================================= */

async function loadNotes() {

    const notesGrid =
        $("#notesGrid");

    if (notesGrid) {

        notesGrid.innerHTML = `

            <div class="loading-state">
                Loading notes...
            </div>

        `;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("notes")
            .select(`
                id,
                course,
                unit,
                file_name,
                file_url,
                created_at,
                uploaded_by,
                course_id,
                unit_id,
                published
            `)
            .eq(
                "published",
                true
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            );

        if (error) {

            console.error(
                "❌ Notes loading failed:",
                error
            );

            allNotes =
                [];

            if (notesGrid) {

                notesGrid.innerHTML = `

                    <div class="empty-state">
                        Unable to load notes.
                    </div>

                `;
            }

            updateDashboardStatistics();

            return;
        }

        allNotes =
            data || [];

        console.log(
            "📝 Notes loaded:",
            allNotes.length
        );

        renderNotesLibrary();

        updateDashboardStatistics();

    } catch (error) {

        console.error(
            "❌ Unexpected notes loading error:",
            error
        );

        allNotes =
            [];

        if (notesGrid) {

            notesGrid.innerHTML = `

                <div class="empty-state">
                    An unexpected error occurred while loading notes.
                </div>

            `;
        }

        updateDashboardStatistics();
    }
}

/* =========================================================
   SAFE NOTE URL
========================================================= */

function getSafeURL(
    url
) {

    if (!url) {
        return "";
    }

    const value =
        String(url).trim();

    if (!value) {
        return "";
    }

    if (
        /^https?:\/\//i.test(
            value
        ) ||
        value.startsWith("/") ||
        value.startsWith("./") ||
        value.startsWith("../")
    ) {

        return value;
    }

    return "";
}

/* =========================================================
   NOTES LIBRARY
========================================================= */

function renderNotesLibrary() {

    const notesGrid =
        $("#notesGrid");

    if (!notesGrid) {

        console.warn(
            "⚠️ #notesGrid was not found."
        );

        return;
    }

    if (!allNotes.length) {

        notesGrid.innerHTML = `

            <div class="empty-state">
                No published notes are currently available.
            </div>

        `;

        return;
    }

    notesGrid.innerHTML =
        allNotes
            .map(
                note => {

                    const noteTitle =
                        note.file_name ||
                        note.unit ||
                        "Medical Study Note";

                    const courseName =
                        note.course ||
                        "Mwaniki Scholars";

                    const unitName =
                        note.unit ||
                        "Study material";

                    const noteURL =
                        getSafeURL(
                            note.file_url
                        );

                    const buttonHTML =
                        noteURL
                            ? `

                                <a
                                    href="${escapeHTML(
                                        noteURL
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="note-card-button"
                                >
                                    View Notes
                                </a>

                            `
                            : `

                                <span
                                    class="note-unavailable"
                                >
                                    File unavailable
                                </span>

                            `;

                    return `

                        <article
                            class="note-card"
                        >

                            <div
                                class="note-card-icon"
                            >
                                📄
                            </div>

                            <div
                                class="note-card-content"
                            >

                                <h3>
                                    ${escapeHTML(
                                        noteTitle
                                    )}
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        courseName
                                    )}
                                </p>

                                <span>
                                    ${escapeHTML(
                                        unitName
                                    )}
                                </span>

                                ${buttonHTML}

                            </div>

                        </article>

                    `;
                }
            )
            .join("");
}

/* =========================================================
   QUIZ LOADING
========================================================= */

async function loadQuizzes() {

    try {

        console.log(
            "📝 Loading all quiz questions from Supabase..."
        );

        const PAGE_SIZE =
            1000;

        let allQuizRows =
            [];

        let from =
            0;

        while (true) {

            const to =
                from +
                PAGE_SIZE -
                1;

            console.log(
                `📝 Loading quiz rows ${from}–${to}...`
            );

            const {
                data,
                error
            } =
                await supabase
                    .from("quizzes")
                    .select(`
                        id,
                        course_id,
                        question,
                        option_a,
                        option_b,
                        option_c,
                        option_d,
                        correct_answer,
                        created_at,
                        course,
                        unit
                    `)
                    .order(
                        "id",
                        {
                            ascending:
                                true
                        }
                    )
                    .range(
                        from,
                        to
                    );

            if (error) {

                console.error(
                    "❌ Quiz loading failed:",
                    error
                );

                allQuizzes =
                    [];

                updateDashboardStatistics();

                return;
            }

            if (
                !data ||
                data.length === 0
            ) {

                break;
            }

            allQuizRows =
                allQuizRows.concat(
                    data
                );

            console.log(
                `📝 Quiz batch loaded: ${data.length} | ` +
                `Total loaded: ${allQuizRows.length}`
            );

            if (
                data.length <
                PAGE_SIZE
            ) {

                break;
            }

            from +=
                PAGE_SIZE;
        }

        allQuizzes =
            allQuizRows;

        console.log(
            "✅ ALL quiz questions loaded:",
            allQuizzes.length
        );

        updateDashboardStatistics();

    } catch (error) {

        console.error(
            "❌ Unexpected quiz loading error:",
            error
        );

        allQuizzes =
            [];

        updateDashboardStatistics();
    }
}

/* =========================================================
   QUIZ PROGRESS
========================================================= */

function calculateQuizProgress() {

    const progress =
        readStorage(
            "mwanikiQuizProgress",
            {}
        );

    if (
        !progress ||
        typeof progress !==
            "object"
    ) {
        return 0;
    }

    const progressValues =
        Object.values(
            progress
        );

    if (!progressValues.length) {
        return 0;
    }

    let completed =
        0;

    progressValues.forEach(
        value => {

            if (
                typeof value ===
                "number"
            ) {

                completed +=
                    value > 0
                        ? 1
                        : 0;

            } else if (
                value &&
                typeof value ===
                    "object"
            ) {

                if (
                    value.completed ===
                        true ||

                    value.finished ===
                        true ||

                    value.score !==
                        undefined
                ) {

                    completed +=
                        1;
                }
            }
        }
    );

    return Math.min(
        100,
        Math.round(
            (
                completed /
                progressValues.length
            ) * 100
        )
    );
}

/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function updateDashboardStatistics() {

    setCounterText(
        "#totalCourses",
        allCourses.length
    );

    setCounterText(
        "#totalNotes",
        allNotes.length
    );

    setCounterText(
        "#totalQuizzes",
        allQuizzes.length
    );

    const progress =
        calculateQuizProgress();

    setText(
        "#learningProgress",
        `${progress}%`
    );

    const progressBar =
        $("#learningProgressBar");

    if (progressBar) {

        progressBar.style.width =
            `${progress}%`;

        progressBar.setAttribute(
            "aria-valuenow",
            String(progress)
        );

        progressBar.setAttribute(
            "aria-valuemin",
            "0"
        );

        progressBar.setAttribute(
            "aria-valuemax",
            "100"
        );
    }
}

/* =========================================================
   COMPATIBILITY FUNCTIONS
========================================================= */

function updateDashboardStats() {
    updateDashboardStatistics();
}

window.updateDashboardStats =
    updateDashboardStats;

window.updateDashboardStatistics =
    updateDashboardStatistics;

/* =========================================================
   UNIT TRACKING
========================================================= */

function mwanikiTrackUnit(
    courseId,
    unitId,
    unitTitle,
    courseTitle
) {

    const activity =
        readStorage(
            "mwanikiRecentActivity",
            []
        );

    const newActivity = {

        courseId,

        unitId,

        unitTitle:
            unitTitle || "",

        courseTitle:
            courseTitle || "",

        timestamp:
            new Date().toISOString()
    };

    const updatedActivity = [

        newActivity,

        ...(
            Array.isArray(
                activity
            )
                ? activity
                : []
        )

    ].slice(
        0,
        20
    );

    writeStorage(
        "mwanikiRecentActivity",
        updatedActivity
    );

    const matchingCourse =
        allCourses.find(
            course =>
                String(
                    course.id
                ) ===
                String(
                    courseId
                )
        );

    const fallbackCourse =
        normalizeCourse({

            id:
                courseId,

            title:
                courseTitle ||
                "Selected Course"
        });

    const courseToSave =
        matchingCourse ||
        fallbackCourse;

    if (courseToSave) {

        saveLastCourse(
            courseToSave
        );

        saveRecentCourse(
            courseToSave
        );
    }

    writeStorage(
        "mwanikiLastUnit",
        {
            courseId,
            unitId,
            unitTitle:
                unitTitle || "",
            courseTitle:
                courseTitle || "",
            timestamp:
                new Date().toISOString()
        }
    );

    renderRecentCourse();

    renderRecommendations();
}

window.mwanikiTrackUnit =
    mwanikiTrackUnit;

/* =========================================================
   REFRESH BUTTONS
========================================================= */

function setupRefreshButtons() {

    const refreshCoursesButton =
        $("#refreshCoursesButton");

    const refreshNotesButton =
        $("#refreshNotesButton");

    if (refreshCoursesButton) {

        refreshCoursesButton.onclick =
            async function () {

                refreshCoursesButton.disabled =
                    true;

                refreshCoursesButton.textContent =
                    "Refreshing...";

                try {

                    await loadCourses();

                    syncContentNotifications();

                    renderNotifications();

                } catch (error) {

                    console.error(
                        "❌ Course refresh failed:",
                        error
                    );

                } finally {

                    refreshCoursesButton.disabled =
                        false;

                    refreshCoursesButton.textContent =
                        "Refresh";
                }
            };
    }

    if (refreshNotesButton) {

        refreshNotesButton.onclick =
            async function () {

                refreshNotesButton.disabled =
                    true;

                refreshNotesButton.textContent =
                    "Refreshing...";

                try {

                    await loadNotes();

                    syncContentNotifications();

                    renderNotifications();

                } catch (error) {

                    console.error(
                        "❌ Notes refresh failed:",
                        error
                    );

                } finally {

                    refreshNotesButton.disabled =
                        false;

                    refreshNotesButton.textContent =
                        "Refresh";
                }
            };
    }
}

/* =========================================================
   GENERIC CARD FILTER
========================================================= */

function filterCards(
    input,
    cardSelector
) {

    if (!input) {
        return;
    }

    const searchTerm =
        input.value
            .trim()
            .toLowerCase();

    $all(
        cardSelector
    ).forEach(
        card => {

            const cardText =
                card.textContent
                    .toLowerCase();

            card.style.display =
                !searchTerm ||
                cardText.includes(
                    searchTerm
                )
                    ? ""
                    : "none";
        }
    );
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const notesSearch =
        $("#notesSearch");

    if (notesSearch) {

        notesSearch.oninput =
            function () {

                filterCards(
                    notesSearch,
                    ".note-card"
                );
            };
    }

    $all(
        "[data-dashboard-search]"
    ).forEach(
        input => {

            const target =
                input.dataset
                    .dashboardSearch;

            if (
                target ===
                "notes"
            ) {

                input.oninput =
                    function () {

                        filterCards(
                            input,
                            ".note-card"
                        );
                    };

            } else if (
                target ===
                "courses"
            ) {

                input.oninput =
                    function () {

                        const courseSearch =
                            $("#courseSearch");

                        if (
                            courseSearch &&
                            input !== courseSearch
                        ) {

                            courseSearch.value =
                                input.value;
                        }

                        performCourseSearch(
                            false
                        );
                    };
            }
        }
    );

    setupCourseSearch();
}

/* =========================================================
   TURBO AI
   ---------------------------------------------------------
   COMPLETELY SEPARATE FROM MWANIKI AI

   Mwaniki AI IDs are NOT USED HERE.

   Turbo AI IDs:
   #turboAIQuestion
   #askTurboAIButton
   #turboAIAnswer
   #turboAIStatus
   #turboAIRecentQuestions
========================================================= */

/* =========================================================
   TURBO AI RECENT QUESTIONS
========================================================= */

function getTurboAIRecentQuestions() {

    const questions =
        readStorage(
            TURBO_AI_RECENT_QUESTIONS_KEY,
            []
        );

    return Array.isArray(
        questions
    )
        ? questions
        : [];
}

function saveTurboAIQuestion(
    question
) {

    const cleanedQuestion =
        String(
            question || ""
        ).trim();

    if (!cleanedQuestion) {
        return;
    }

    const existing =
        getTurboAIRecentQuestions();

    const filtered =
        existing.filter(
            item =>
                String(
                    item.question || ""
                ).toLowerCase() !==
                cleanedQuestion.toLowerCase()
        );

    filtered.unshift({

        question:
            cleanedQuestion,

        timestamp:
            new Date().toISOString()
    });

    writeStorage(
        TURBO_AI_RECENT_QUESTIONS_KEY,
        filtered.slice(
            0,
            8
        )
    );

    /*
     * Keep the last question separately as well.
     */
    writeStorage(
        TURBO_AI_LAST_QUESTION_KEY,
        cleanedQuestion
    );
}

function renderTurboAIRecentQuestions() {

    const container =
        $("#turboAIRecentQuestions");

    if (!container) {
        return;
    }

    const questions =
        getTurboAIRecentQuestions();

    if (!questions.length) {

        container.innerHTML = `

            <div class="turbo-ai-empty-history">
                Your recent Turbo AI questions will appear here.
            </div>

        `;

        return;
    }

    container.innerHTML =
        questions
            .map(
                item => `

                    <button
                        type="button"
                        class="turbo-ai-history-item"
                        data-turbo-question="${escapeHTML(
                            item.question
                        )}"
                    >
                        ${escapeHTML(
                            item.question
                        )}
                    </button>

                `
            )
            .join("");

    container
        .querySelectorAll(
            "[data-turbo-question]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const input =
                            $("#turboAIQuestion");

                        if (!input) {
                            return;
                        }

                        input.value =
                            button.dataset
                                .turboQuestion ||
                            "";

                        input.focus();

                        scrollToTurboAI();
                    }
                );
            }
        );
}

/* =========================================================
   TURBO AI STATUS
========================================================= */

function setTurboAIStatus(
    message,
    type = "info"
) {

    const status =
        $("#turboAIStatus");

    if (!status) {
        return;
    }

    status.textContent =
        message || "";

    status.dataset.messageType =
        type;

    status.style.display =
        message
            ? ""
            : "none";
}

/* =========================================================
   TURBO AI SCROLL
========================================================= */

function scrollToTurboAI() {

    const section =
        $("#turbo-ai") ||
        $("#turboAISection");

    if (!section) {
        return;
    }

    section.scrollIntoView(
        {
            behavior:
                "smooth",

            block:
                "start"
        }
    );

    activateSection(
        "turbo-ai"
    );
}

/* =========================================================
   TURBO AI ANSWER FORMATTER
========================================================= */

function formatTurboAIAnswer(
    answer
) {

    const safe =
        escapeHTML(
            answer || ""
        );

    return safe
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        )
        .replace(
            /\n\n+/g,
            "</p><p>"
        )
        .replace(
            /\n/g,
            "<br>"
        );
}

/* =========================================================
   ASK TURBO AI
========================================================= */

async function askTurboAI() {

    const questionInput =
        document.getElementById(
            "turboAIQuestion"
        );

    const answerBox =
        document.getElementById(
            "turboAIAnswer"
        );

    const statusBox =
        document.getElementById(
            "turboAIStatus"
        );

    const askButton =
        document.getElementById(
            "askTurboAIButton"
        );

    if (
        !questionInput ||
        !answerBox ||
        !askButton
    ) {

        console.error(
            "❌ Turbo AI elements were not found."
        );

        return;
    }

    const question =
        questionInput.value.trim();

    if (!question) {

        if (statusBox) {

            statusBox.textContent =
                "Please enter a question.";
        }

        answerBox.innerHTML =
            "<p>Please enter a question for Turbo AI.</p>";

        questionInput.focus();

        return;
    }

    askButton.disabled =
        true;

    if (statusBox) {

        statusBox.textContent =
            "Turbo AI is thinking.";
    }

    answerBox.innerHTML = `
        <div class="turbo-ai-loading">
            <span>Turbo AI is preparing your answer...</span>
        </div>
    `;

    try {

        console.log(
            "🤖 Sending question to Turbo AI..."
        );

        const {
            data,
            error
        } =
            await supabase.functions.invoke(
                "turbo-ai",
                {
                    body: {
                        message:
                            question
                    }
                }
            );

        if (error) {

            console.error(
                "❌ Turbo AI function error:",
                error
            );

            throw new Error(
                error.message ||
                "Turbo AI could not be reached."
            );
        }

        if (!data) {

            throw new Error(
                "Turbo AI returned no response."
            );
        }

        if (!data.success) {

            throw new Error(
                data.error ||
                "Turbo AI could not answer the question."
            );
        }

        const answer =
            typeof data.answer ===
                "string"
                ? data.answer.trim()
                : "";

        if (!answer) {

            throw new Error(
                "Turbo AI returned an empty answer."
            );
        }

        answerBox.innerHTML = `
            <div class="turbo-ai-response">
                ${formatTurboAIAnswer(answer)}
            </div>
        `;

        if (statusBox) {

            statusBox.textContent =
                "Turbo AI response ready.";

            statusBox.dataset.messageType =
                "success";
        }

        /*
         * CORRECT FUNCTION NAME.
         *
         * The old code called:
         * saveTurboAIRecentQuestion()
         *
         * but the actual function is:
         * saveTurboAIQuestion()
         */
        saveTurboAIQuestion(
            question
        );

        renderTurboAIRecentQuestions();

        console.log(
            "✅ Turbo AI response received successfully."
        );

    } catch (error) {

        console.error(
            "❌ Turbo AI request failed:",
            error
        );

        answerBox.innerHTML = `
            <div class="turbo-ai-error">

                <strong>
                    Turbo AI could not respond.
                </strong>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Please try again."
                    )}
                </p>

            </div>
        `;

        if (statusBox) {

            statusBox.textContent =
                "Turbo AI request failed.";

            statusBox.dataset.messageType =
                "error";
        }

    } finally {

        askButton.disabled =
            false;
    }
}

/* =========================================================
   TURBO AI EVENT HANDLER
========================================================= */

function setupTurboAI() {

    const askButton =
        $("#askTurboAIButton");

    const questionInput =
        $("#turboAIQuestion");

    const clearButton =
        $("#clearTurboAIButton");

    const section =
        $("#turbo-ai") ||
        $("#turboAISection");

    if (
        !askButton ||
        !questionInput
    ) {

        console.log(
            "ℹ️ Turbo AI dashboard interface is not present on this page."
        );

        return;
    }

    askButton.onclick =
        function (event) {

            event.preventDefault();

            askTurboAI();
        };

    questionInput.onkeydown =
        function (event) {

            if (
                event.key === "Enter" &&
                event.ctrlKey
            ) {

                event.preventDefault();

                askTurboAI();
            }
        };

    if (clearButton) {

        clearButton.onclick =
            function (event) {

                event.preventDefault();

                questionInput.value =
                    "";

                const answer =
                    $("#turboAIAnswer");

                if (answer) {

                    answer.textContent =
                        "Ask Turbo AI a medical learning question.";

                    answer.dataset.messageType =
                        "info";
                }

                setTurboAIStatus(
                    "",
                    "info"
                );

                questionInput.focus();
            };
    }

    renderTurboAIRecentQuestions();

    console.log(
        "🤖 Turbo AI dashboard interface ready."
    );

    if (section) {

        section.dataset.turboAIReady =
            "true";
    }
}
/* =========================================================
   OUTSIDE PANEL CLOSING
========================================================= */

function setupOutsidePanelClosing() {

    if (
        document.body.dataset
            .outsidePanelsReady
    ) {
        return;
    }

    document.body.dataset
        .outsidePanelsReady =
        "true";

    document.addEventListener(
        "click",
        function (event) {

            const profilePanel =
                $("#profilePanel");

            const notificationPanel =
                $("#notificationPanel");

            const profileButton =
                $("#profileButton");

            const notificationButton =
                $("#notificationButton");

            if (
                profilePanel &&
                profilePanel.classList
                    .contains("active") &&
                !profilePanel.contains(
                    event.target
                ) &&
                !profileButton?.contains(
                    event.target
                )
            ) {

                closeProfilePanel();
            }

            if (
                notificationPanel &&
                notificationPanel.classList
                    .contains("active") &&
                !notificationPanel.contains(
                    event.target
                ) &&
                !notificationButton?.contains(
                    event.target
                )
            ) {

                closeNotificationPanel();
            }
        }
    );
}

/* =========================================================
   ESCAPE KEY
========================================================= */

function setupEscapeKey() {

    if (
        document.body.dataset
            .escapeKeyReady
    ) {
        return;
    }

    document.body.dataset
        .escapeKeyReady =
        "true";

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            closeProfilePanel();

            closeNotificationPanel();
        }
    );
}

/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

async function initializeDashboard() {

    if (
        dashboardInitializing ||
        dashboardReady
    ) {
        return;
    }

    dashboardInitializing =
        true;

    console.log(
        "🚀 Initializing Mwaniki Scholars dashboard..."
    );

    try {

        startDashboardClock();

        setupNavigation();

        setupNotificationPanel();

        setupProfilePanel();

        setupProfileForm();

        setupProfilePhoto();

        setupChangePassword();

        setupLogout();

        setupRefreshButtons();

        setupSearch();

        setupTurboAI();

        setupOutsidePanelClosing();

        setupEscapeKey();

        currentUser =
            await getAuthenticatedUser();

        if (!currentUser) {

            console.warn(
                "⚠️ No authenticated user found."
            );

            window.location.href =
                "./index.html";

            return;
        }

        console.log(
            "🔐 Authenticated user:",
            currentUser.email
        );

        const profileLoaded =
            await loadStudentProfile();

        if (!profileLoaded) {

            console.warn(
                "⚠️ Student profile was not loaded, but dashboard will continue."
            );
        }

        createWelcomeNotification();

        /*
         * Load every dashboard data source independently.
         */
        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        /*
         * Course search is initialized after courses
         * have arrived.
         */
        setupCourseSearch();

        syncContentNotifications();

        renderStudentProfile();

        repairProfileFields();

        renderRecentCourse();

        renderRecommendations();

        renderNotesLibrary();

        renderNotifications();

        updateNotificationBadge();

        updateDashboardStatistics();

        dashboardReady =
            true;

        console.log(
            "✅ Mwaniki Scholars dashboard ready"
        );

    } catch (error) {

        console.error(
            "❌ Dashboard initialization failed:",
            error
        );

    } finally {

        dashboardInitializing =
            false;
    }
}

/* =========================================================
   PUBLIC DASHBOARD API
========================================================= */

window.mwanikiDashboard = {

    getCurrentUser() {
        return currentUser;
    },

    getCurrentStudent() {
        return currentStudent;
    },

    getCourses() {
        return allCourses;
    },

    getNotes() {
        return allNotes;
    },

    getQuizzes() {
        return allQuizzes;
    },

    refreshCourses:
        async function () {

            await loadCourses();

            setupCourseSearch();

            syncContentNotifications();

            updateDashboardStatistics();

            updateNotificationBadge();
        },

    refreshNotes:
        async function () {

            await loadNotes();

            syncContentNotifications();

            updateDashboardStatistics();

            updateNotificationBadge();
        },

    refreshAll:
        async function () {

            await Promise.all([
                loadCourses(),
                loadNotes(),
                loadQuizzes()
            ]);

            setupCourseSearch();

            syncContentNotifications();

            renderRecentCourse();

            renderRecommendations();

            updateDashboardStatistics();

            renderNotifications();

            updateNotificationBadge();
        },

    openProfile:
        function () {

            renderStudentProfile();

            openProfilePanel();
        },

    closeProfile:
        closeProfilePanel,

    openNotifications:
        function () {

            renderNotifications();

            openNotificationPanel();
        },

    closeNotifications:
        closeNotificationPanel,

    markNotificationsRead:
        markAllNotificationsRead,

    searchCourses:
        function (term) {

            const searchInput =
                $("#courseSearch");

            if (!searchInput) {
                return;
            }

            searchInput.value =
                String(term || "");

            performCourseSearch(
                true
            );
        },

    /*
     * Course Community API
     */
    openCourseCommunity:
        function (course) {

            openCourseCommunity(
                course
            );
        },

    /*
     * Turbo AI remains independent from
     * Mwaniki AI.
     */
    askTurboAI:
        askTurboAI
};

/* =========================================================
   PUBLIC NOTIFICATION FUNCTION
========================================================= */

window.mwanikiAddNotification =
    function (notification) {

        addNotification(
            notification
        );

        renderNotifications();

        updateNotificationBadge();
    };

/* =========================================================
   PUBLIC COURSE COMMUNITY FUNCTION
========================================================= */

window.mwanikiOpenCommunity =
    function (course) {

        openCourseCommunity(
            course
        );
    };

/* =========================================================
   AUTH STATE LISTENER
========================================================= */

supabase.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "🔐 Auth state:",
            event
        );

        if (
            event ===
            "SIGNED_OUT"
        ) {

            handleSignedOut();

            return;
        }

        if (
            event ===
                "SIGNED_IN" &&
            session?.user &&
            !dashboardReady &&
            !dashboardInitializing
        ) {

            initializeDashboard();
        }
    }
);

/* =========================================================
   START DASHBOARD
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        {
            once: true
        }
    );

} else {

    initializeDashboard();
}

/* =========================================================
   FINAL STARTUP LOG
========================================================= */

console.log(
    "✅ Mwaniki Scholars dashboard.js loaded successfully."
);
