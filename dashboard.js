import { supabase } from "./supabase.js";

/* =========================================================
   MWANIKI SCHOLARS
   STUDENT DASHBOARD ENGINE
   COMPLETE VERSION ALIGNED WITH dashboard.html
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

/*
    Change this ID whenever a significant dashboard/app
    improvement is released.

    Students will receive one notification for each new ID.
*/
const APP_UPDATE_ID =
    "mwaniki-dashboard-update-2026-09";

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
        element.textContent = value ?? "";
    }
}

function setHTML(selector, value) {
    const element = $(selector);

    if (element) {
        element.innerHTML = value ?? "";
    }
}

function showElement(selector, displayValue = "") {
    const element = $(selector);

    if (element) {
        element.style.display = displayValue;
    }
}

function hideElement(selector) {
    const element = $(selector);

    if (element) {
        element.style.display = "none";
    }
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setCounterText(selector, value) {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent =
        Number(value || 0).toLocaleString();
}

/* =========================================================
   FORM FIELD HELPERS
========================================================= */

function getFieldValue(selector) {
    const element = $(selector);

    if (!element) {
        return "";
    }

    if (
        "value" in element
    ) {
        return String(element.value ?? "").trim();
    }

    return String(
        element.textContent ?? ""
    ).trim();
}

function setFieldValue(selector, value) {
    const element = $(selector);

    if (!element) {
        return;
    }

    if ("value" in element) {
        element.value = value ?? "";
    } else {
        element.textContent = value ?? "";
    }
}

/* =========================================================
   USER-FACING STATUS MESSAGE
========================================================= */

function showMessage(
    selector,
    message,
    type = "info"
) {
    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent = message;

    element.dataset.messageType = type;

    element.classList.remove(
        "success",
        "error",
        "info",
        "warning"
    );

    element.classList.add(type);

    element.style.display =
        message ? "block" : "";
}

/* =========================================================
   LOCAL STORAGE HELPERS
========================================================= */

function readStorage(
    key,
    fallback = null
) {
    try {
        const value =
            localStorage.getItem(key);

        if (!value) {
            return fallback;
        }

        return JSON.parse(value);

    } catch (error) {

        console.warn(
            `⚠️ Could not read localStorage key: ${key}`,
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

    } catch (error) {

        console.warn(
            `⚠️ Could not write localStorage key: ${key}`,
            error
        );
    }
}

function removeStorage(key) {
    try {

        localStorage.removeItem(key);

    } catch (error) {

        console.warn(
            `⚠️ Could not remove localStorage key: ${key}`,
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
        course.course_id ??
        null;

    const title =
        course.title ||
        course.courseTitle ||
        course.course_name ||
        course.name ||
        "Untitled Course";

    if (
        id === null ||
        id === undefined ||
        id === ""
    ) {
        return null;
    }

    return {

        id,

        title:
            String(title).trim() ||
            "Untitled Course",

        description:
            String(
                course.description || ""
            ).trim(),

        image:
            String(
                course.image || ""
            ).trim(),

        created_at:
            course.created_at || null
    };
}

/* =========================================================
   COURSE URL
========================================================= */

function getCourseURL(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return "./courses.html";
    }

    return (
        `./course.html?course_id=` +
        encodeURIComponent(
            normalizedCourse.id
        )
    );
}

/* =========================================================
   RECENT COURSE STORAGE
========================================================= */

function getLastCourse() {

    const storedCourse =
        readStorage(
            "mwanikiLastCourse",
            null
        );

    return normalizeCourse(
        storedCourse
    );
}

function saveLastCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    writeStorage(
        "mwanikiLastCourse",
        normalizedCourse
    );
}

function getRecentCourses() {

    const recentCourses =
        readStorage(
            "mwanikiRecentCourses",
            []
        );

    if (!Array.isArray(recentCourses)) {
        return [];
    }

    return recentCourses
        .map(normalizeCourse)
        .filter(Boolean);
}

function saveRecentCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    const existingCourses =
        getRecentCourses();

    const filteredCourses =
        existingCourses.filter(
            item =>
                String(item.id) !==
                String(normalizedCourse.id)
        );

    filteredCourses.unshift(
        normalizedCourse
    );

    writeStorage(
        "mwanikiRecentCourses",
        filteredCourses.slice(0, 8)
    );
}

function saveSelectedCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {
        return;
    }

    writeStorage(
        "selectedCourse",
        normalizedCourse.id
    );

    writeStorage(
        "selectedCourseName",
        normalizedCourse.title
    );

    saveLastCourse(
        normalizedCourse
    );

    saveRecentCourse(
        normalizedCourse
    );
}

/* =========================================================
   COURSE OPENING
========================================================= */

function openCourse(course) {

    const normalizedCourse =
        normalizeCourse(course);

    if (!normalizedCourse) {

        console.warn(
            "⚠️ Cannot open invalid course:",
            course
        );

        return;
    }

    saveSelectedCourse(
        normalizedCourse
    );

    window.location.href =
        getCourseURL(
            normalizedCourse
        );
}

window.mwanikiOpenCourse =
    openCourse;

/* =========================================================
   LIVE DATE AND TIME
========================================================= */

function updateCurrentDate() {

    const currentDateElement =
        $("#currentDate");

    if (!currentDateElement) {
        return;
    }

    const now =
        new Date();

    const formattedDate =
        now.toLocaleDateString(
            "en-KE",
            {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );

    const formattedTime =
        now.toLocaleTimeString(
            "en-KE",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    currentDateElement.textContent =
        `${formattedDate} • ${formattedTime}`;
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
        } = await supabase.auth.getUser();

        if (error) {

            console.error(
                "❌ Could not get authenticated user:",
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

async function handleSignedOut() {

    currentUser = null;
    currentStudent = null;
    dashboardReady = false;

    if (dashboardClockTimer) {

        clearInterval(
            dashboardClockTimer
        );

        dashboardClockTimer = null;
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
        } = await supabase
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

            return false;
        }

        currentStudent =
            data || {

                id:
                    currentUser.id,

                full_name:
                    currentUser
                        .user_metadata
                        ?.full_name ||
                    currentUser
                        .user_metadata
                        ?.name ||
                    "Student",

                email:
                    currentUser.email ||
                    "",

                phone: "",
                course: "",
                level: "",
                photo_url: ""
            };

        renderStudentProfile();

        return true;

    } catch (error) {

        console.error(
            "❌ Unexpected profile error:",
            error
        );

        return false;
    }
}

/* =========================================================
   STUDENT NAME
========================================================= */

function getStudentDisplayName() {

    if (!currentStudent) {
        return "Student";
    }

    return (

        currentStudent.full_name ||

        currentStudent.name ||

        currentUser
            ?.user_metadata
            ?.full_name ||

        currentUser
            ?.email
            ?.split("@")[0] ||

        "Student"
    );
}

function getStudentFirstName() {

    return getStudentDisplayName()
        .trim()
        .split(/\s+/)[0] ||
        "Student";
}

/* =========================================================
   PROFILE AVATAR
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
                ${escapeHTML(
                    initials || "S"
                )}
            </text>
        </svg>
    `;

    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );
}

function getPossibleProfileImage() {

    if (!currentStudent) {
        return "";
    }

    return (

        currentStudent.photo_url ||

        currentStudent.photo ||

        currentStudent.avatar_url ||

        currentStudent.profile_image ||

        currentStudent.image ||

        currentUser
            ?.user_metadata
            ?.photo_url ||

        currentUser
            ?.user_metadata
            ?.avatar_url ||

        currentUser
            ?.user_metadata
            ?.picture ||

        ""
    );
}

function setAvatar(
    selector,
    photoURL,
    name
) {

    const element =
        $(selector);

    if (!element) {
        return;
    }

    const fallbackURL =
        createInitialsAvatar(
            name
        );

    element.setAttribute(
        "alt",
        `${name} profile photo`
    );

    element.onerror =
        function () {

            this.onerror = null;

            this.src =
                fallbackURL;
        };

    element.src =
        photoURL ||
        fallbackURL;

    element.style.display =
        "block";

    element.style.visibility =
        "visible";

    element.style.opacity =
        "1";
}

function displayProfileImage() {

    const displayName =
        getStudentDisplayName();

    const imageURL =
        getPossibleProfileImage();

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

    console.log(
        imageURL
            ? "✅ Student profile image displayed."
            : "ℹ️ No saved profile image found. Initials avatar displayed."
    );
}

/* =========================================================
   PROFILE RENDERING
========================================================= */

function renderStudentProfile() {

    if (!currentStudent) {
        return;
    }

    const displayName =
        getStudentDisplayName();

    setText(
        "#headerProfileName",
        displayName
    );

    setText(
        "#welcomeName",
        getStudentFirstName()
    );

    setFieldValue(
        "#profileName",
        currentStudent.full_name ||
        displayName
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

    const profileEmail =
        $("#profileEmail");

    if (profileEmail) {

        profileEmail.readOnly =
            true;

        profileEmail.setAttribute(
            "aria-readonly",
            "true"
        );
    }

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
        return;
    }

    if (shouldOpen) {

        panel.classList.add(
            "active"
        );

        panel.classList.add(
            "open"
        );

        panel.removeAttribute(
            "hidden"
        );

        panel.setAttribute(
            "aria-hidden",
            "false"
        );

        panel.style.display =
            "flex";

        panel.style.visibility =
            "visible";

        panel.style.opacity =
            "1";

        panel.style.pointerEvents =
            "auto";

        panel.style.zIndex =
            "9999";

    } else {

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

function openProfilePanel() {

    setPanelOpen(
        $("#profilePanel"),
        true
    );
}

function closeProfilePanel() {

    setPanelOpen(
        $("#profilePanel"),
        false
    );
}

function setupProfilePanel() {

    const profileButton =
        $("#profileButton");

    const closeButton =
        $("#closeProfilePanel");

    const panel =
        $("#profilePanel");

    if (!profileButton) {

        console.warn(
            "⚠️ #profileButton was not found."
        );

    } else {

        profileButton.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                const isOpen =
                    panel?.classList
                        .contains("active");

                if (isOpen) {

                    closeProfilePanel();

                } else {

                    renderStudentProfile();

                    openProfilePanel();
                }
            };
    }

    if (closeButton) {

        closeButton.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                closeProfilePanel();
            };
    }

    if (panel) {
        setPanelOpen(
            panel,
            false
        );
    }
}/* =========================================================
   REPAIR PROFILE FIELDS
========================================================= */

function repairProfileFields() {

    if (!currentStudent) {
        return;
    }

    setFieldValue(
        "#profileName",
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

    const profileEmail =
        $("#profileEmail");

    if (profileEmail) {
        profileEmail.readOnly =
            true;
    }
}

/* =========================================================
   SAVE STUDENT PROFILE
========================================================= */

function setupProfileForm() {

    const saveButton =
        $("#saveProfileButton");

    if (!saveButton) {
        return;
    }

    saveButton.onclick =
        saveStudentProfile;
}

async function saveStudentProfile() {

    if (
        !currentUser ||
        !currentStudent
    ) {
        return;
    }

    const fullName =
        getFieldValue(
            "#profileName"
        ) ||
        getStudentDisplayName();

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

    const saveButton =
        $("#saveProfileButton");

    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";
    }

    showMessage(
        "#profileSaveStatus",
        "Saving profile...",
        "info"
    );

    try {

        const {
            data,
            error
        } = await supabase
            .from("students")
            .update({

                full_name:
                    fullName,

                phone:
                    phone,

                course:
                    course,

                level:
                    level
            })
            .eq(
                "id",
                currentUser.id
            )
            .select()
            .maybeSingle();

        if (error) {

            console.error(
                "❌ Profile update failed:",
                error
            );

            showMessage(
                "#profileSaveStatus",
                "Could not save your profile. Please try again.",
                "error"
            );

            return;
        }

        currentStudent = {

            ...currentStudent,

            ...(data || {}),

            full_name:
                fullName,

            phone:
                phone,

            course:
                course,

            level:
                level
        };

        renderStudentProfile();

        showMessage(
            "#profileSaveStatus",
            "Profile saved successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "❌ Unexpected profile save error:",
            error
        );

        showMessage(
            "#profileSaveStatus",
            "An unexpected error occurred while saving.",
            "error"
        );

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
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
        fileName || "profile-photo"
    )
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .slice(0, 100);
}

async function uploadProfilePhoto(
    file
) {

    if (!currentUser) {

        throw new Error(
            "No authenticated student."
        );
    }

    const safeFileName =
        sanitizeFileName(
            file.name
        );

    const extension =
        safeFileName.includes(".")
            ? safeFileName
                .split(".")
                .pop()
                .toLowerCase()
            : "jpg";

    const storagePath =
        `${currentUser.id}/` +
        `${Date.now()}-profile.${extension}`;

    console.log(
        "📤 Uploading profile photo:",
        storagePath
    );

    const {
        error: uploadError
    } = await supabase.storage
        .from(
            PROFILE_PHOTO_BUCKET
        )
        .upload(
            storagePath,
            file,
            {
                cacheControl:
                    "3600",

                contentType:
                    file.type,

                upsert:
                    true
            }
        );

    if (uploadError) {

        console.error(
            "❌ Profile photo upload failed:",
            uploadError
        );

        throw uploadError;
    }

    const {
        data: publicData
    } = supabase.storage
        .from(
            PROFILE_PHOTO_BUCKET
        )
        .getPublicUrl(
            storagePath
        );

    const publicURL =
        publicData?.publicUrl;

    if (!publicURL) {

        throw new Error(
            "Could not generate the public profile photo URL."
        );
    }

    console.log(
        "🔗 Profile photo public URL:",
        publicURL
    );

    const {
        error: profileError
    } = await supabase
        .from("students")
        .update({
            photo_url:
                publicURL
        })
        .eq(
            "id",
            currentUser.id
        );

    if (profileError) {

        console.error(
            "❌ Could not save photo URL:",
            profileError
        );

        throw profileError;
    }

    currentStudent = {

        ...currentStudent,

        photo_url:
            publicURL
    };

    displayProfileImage();

    return publicURL;
}

function setupProfilePhoto() {

    const photoInput =
        $("#profilePhotoInput");

    if (!photoInput) {

        console.warn(
            "⚠️ #profilePhotoInput was not found."
        );

        return;
    }

    photoInput.onchange =
        async function (event) {

            const file =
                event.target.files?.[0];

            if (!file) {
                return;
            }

            if (
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                showMessage(
                    "#profileSaveStatus",
                    "Please select a valid image file.",
                    "error"
                );

                photoInput.value =
                    "";

                return;
            }

            if (
                file.size >
                MAX_PROFILE_PHOTO_SIZE
            ) {

                showMessage(
                    "#profileSaveStatus",
                    "The profile photo must be 5 MB or smaller.",
                    "error"
                );

                photoInput.value =
                    "";

                return;
            }

            /*
                Show the selected photo immediately
                while it is being uploaded.
            */
            const reader =
                new FileReader();

            reader.onload =
                function () {

                    const previewURL =
                        reader.result;

                    setAvatar(
                        "#headerProfileAvatar",
                        previewURL,
                        getStudentDisplayName()
                    );

                    setAvatar(
                        "#profileLargeAvatar",
                        previewURL,
                        getStudentDisplayName()
                    );
                };

            reader.readAsDataURL(
                file
            );

            showMessage(
                "#profileSaveStatus",
                "Uploading profile photo...",
                "info"
            );

            photoInput.disabled =
                true;

            try {

                await uploadProfilePhoto(
                    file
                );

                showMessage(
                    "#profileSaveStatus",
                    "Profile photo uploaded and saved successfully.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "❌ Profile photo process failed:",
                    error
                );

                /*
                    Restore the previously saved image
                    if the upload failed.
                */
                displayProfileImage();

                showMessage(
                    "#profileSaveStatus",
                    "Photo upload failed. Make sure the student-profiles bucket allows uploads.",
                    "error"
                );

            } finally {

                photoInput.disabled =
                    false;
            }
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
        async function () {

            if (!currentUser?.email) {

                alert(
                    "No registered email address was found."
                );

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
                            currentUser.email
                        );

                if (error) {

                    console.error(
                        "❌ Password reset error:",
                        error
                    );

                    alert(
                        "Could not send the password reset email."
                    );

                    return;
                }

                alert(
                    "A password reset email has been sent to your registered email address."
                );

            } catch (error) {

                console.error(
                    "❌ Unexpected password reset error:",
                    error
                );

                alert(
                    "An unexpected error occurred."
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

    const logoutButton =
        $("#logoutButton");

    if (!logoutButton) {
        return;
    }

    logoutButton.onclick =
        async function () {

            logoutButton.disabled =
                true;

            logoutButton.textContent =
                "Signing out...";

            try {

                const {
                    error
                } =
                    await supabase.auth
                        .signOut();

                if (error) {

                    console.error(
                        "❌ Logout failed:",
                        error
                    );

                    logoutButton.disabled =
                        false;

                    logoutButton.textContent =
                        "Sign Out";

                    return;
                }

                window.location.href =
                    "./index.html";

            } catch (error) {

                console.error(
                    "❌ Unexpected logout error:",
                    error
                );

                logoutButton.disabled =
                    false;

                logoutButton.textContent =
                    "Sign Out";
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
        notifications
            .slice(0, 50)
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
        state
    );
}

/* =========================================================
   ADD NOTIFICATION
========================================================= */

function addNotification({
    id,
    type = "info",
    title,
    message,
    created_at =
        new Date().toISOString()
}) {

    if (!currentUser) {
        return;
    }

    if (!id) {
        return;
    }

    const notifications =
        getNotifications();

    const alreadyExists =
        notifications.some(
            notification =>
                notification.id === id
        );

    if (alreadyExists) {
        return;
    }

    notifications.unshift({

        id,

        type,

        title:
            title ||
            "Mwaniki Scholars",

        message:
            message ||
            "",

        created_at,

        read:
            false
    });

    saveNotifications(
        notifications
    );

    updateNotificationBadge();

    console.log(
        "🔔 Notification added:",
        title
    );
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

    state.welcomeSent =
        true;

    saveNotificationState(
        state
    );
}/* =========================================================
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
        First visit:
        establish a baseline so existing content does not
        create dozens of false "new content" notifications.
    */
    if (!state.contentBaselineReady) {

        state.knownCourseIds =
            currentCourseIds;

        state.knownNoteIds =
            currentNoteIds;

        state.contentBaselineReady =
            true;

        saveNotificationState(
            state
        );

    } else {

        const knownCourseIds =
            Array.isArray(
                state.knownCourseIds
            )
                ? state.knownCourseIds
                : [];

        const knownNoteIds =
            Array.isArray(
                state.knownNoteIds
            )
                ? state.knownNoteIds
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

        if (newCourses.length) {

            addNotification({

                id:
                    `new-courses-${newCourses
                        .map(c => c.id)
                        .join("-")}`,

                type:
                    "course",

                title:
                    "New courses available",

                message:
                    newCourses.length === 1
                        ? `A new course, "${newCourses[0].title}", has been added to the Course Library.`
                        : `${newCourses.length} new courses have been added to the Course Library.`,

                created_at:
                    newCourses
                        .map(
                            c =>
                                c.created_at
                        )
                        .filter(Boolean)
                        .sort()
                        .pop() ||
                    new Date().toISOString()
            });
        }

        if (newNotes.length) {

            addNotification({

                id:
                    `new-notes-${newNotes
                        .map(n => n.id)
                        .join("-")}`,

                type:
                    "notes",

                title:
                    "New study notes available",

                message:
                    newNotes.length === 1
                        ? `A new study resource, "${newNotes[0].file_name || newNotes[0].unit || "Medical note"}", has been published.`
                        : `${newNotes.length} new study resources have been published in the Notes Library.`,

                created_at:
                    newNotes
                        .map(
                            n =>
                                n.created_at
                        )
                        .filter(Boolean)
                        .sort()
                        .pop() ||
                    new Date().toISOString()
            });
        }

        state.knownCourseIds =
            Array.from(
                new Set([
                    ...knownCourseIds,
                    ...currentCourseIds
                ])
            ).slice(-500);

        state.knownNoteIds =
            Array.from(
                new Set([
                    ...knownNoteIds,
                    ...currentNoteIds
                ])
            ).slice(-1000);

        saveNotificationState(
            state
        );
    }

    /*
        Application update notification.
        Change APP_UPDATE_ID when a new significant
        dashboard improvement is released.
    */
    if (
        state.lastAppUpdateId !==
        APP_UPDATE_ID
    ) {

        addNotification({

            id:
                APP_UPDATE_ID,

            type:
                "update",

            title:
                "Mwaniki Scholars dashboard updated",

            message:
                "Your dashboard has received improvements to make your learning experience smoother. Check your profile, notifications, courses and study resources.",

            created_at:
                new Date().toISOString()
        });

        state.lastAppUpdateId =
            APP_UPDATE_ID;

        saveNotificationState(
            state
        );
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

    const possibleBadges =
        $all(
            "#notificationBadge, [data-notification-count], .notification-badge, .notification-count"
        );

    possibleBadges.forEach(
        badge => {

            if (unreadCount > 0) {

                badge.textContent =
                    unreadCount >
                    99
                        ? "99+"
                        : String(
                            unreadCount
                        );

                badge.style.display =
                    "";

                badge.setAttribute(
                    "aria-label",
                    `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                );

            } else {

                badge.textContent =
                    "";

                badge.style.display =
                    "none";
            }
        }
    );

    /*
        If the current HTML has no badge, the notification
        button itself still works normally.
    */

    const button =
        $("#notificationButton");

    if (button) {

        button.setAttribute(
            "aria-label",
            unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
        );
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

                            <div class="notification-item-header">

                                <strong>
                                    ${escapeHTML(
                                        notification.title
                                    )}
                                </strong>

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

                        item.classList.remove(
                            "unread"
                        );
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
}

/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function openNotificationPanel() {

    setPanelOpen(
        $("#notificationPanel"),
        true
    );
}

function closeNotificationPanel() {

    setPanelOpen(
        $("#notificationPanel"),
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

    if (!button) {

        console.warn(
            "⚠️ #notificationButton was not found."
        );

    } else {

        button.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                if (!panel) {
                    return;
                }

                const isOpen =
                    panel.classList
                        .contains("active");

                if (isOpen) {

                    closeNotificationPanel();

                } else {

                    renderNotifications();

                    openNotificationPanel();
                }
            };
    }

    if (closeButton) {

        closeButton.onclick =
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                closeNotificationPanel();
            };
    }

    if (panel) {

        setPanelOpen(
            panel,
            false
        );
    }
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

            /*
                Links such as AI Tutor, Book a Tutor
                and Inbox do not have data-section,
                so they must continue normally.
            */
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

    /*
        Quick action links also point to dashboard
        sections. Make them scroll smoothly without
        interfering with external pages.
    */

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
                            .getAttribute("href")
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
   IMPORTANT:
   NO COURSE IMAGE
   NO COURSE IMAGE PLACEHOLDER
========================================================= */

function renderCourseLibrary() {

    const courseGrid =
        $("#courseGrid");

    if (!courseGrid) {

        console.warn(
            "⚠️ #courseGrid was not found."
        );

        return;
    }

    if (!allCourses.length) {

        courseGrid.innerHTML = `

            <div class="empty-state">
                No courses are currently available.
            </div>

        `;

        return;
    }

    courseGrid.innerHTML =
        allCourses
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

                            <button
                                type="button"
                                class="course-card-button"
                                data-open-course="${escapeHTML(
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
}/* =========================================================
   RECENT COURSE
   IMPORTANT:
   NO IMAGE
   NO IMAGE PLACEHOLDER
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

                const coursesSection =
                    $("#courses");

                if (coursesSection) {

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

    /*
        Accept normal HTTPS/HTTP URLs and relative paths.
        Reject javascript:, data:, vbscript:, etc.
    */

    if (
        /^https?:\/\//i.test(
            value
        ) ||
        value.startsWith("/")
        ||
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

        const {
            data,
            error
        } = await supabase
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

        allQuizzes =
            data || [];

        console.log(
            "📝 Quiz questions loaded:",
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
        typeof progress !== "object"
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
    mwanikiTrackUnit;/* =========================================================
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
   SEARCH
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

function setupSearch() {

    /*
        The current dashboard.html supplied by you does
        not contain search inputs.

        This function therefore safely does nothing now,
        but it remains compatible with future search fields.
    */

    const courseSearch =
        $("#courseSearch");

    const notesSearch =
        $("#notesSearch");

    if (courseSearch) {

        courseSearch.oninput =
            function () {

                filterCards(
                    courseSearch,
                    ".course-card"
                );
            };
    }

    if (notesSearch) {

        notesSearch.oninput =
            function () {

                filterCards(
                    notesSearch,
                    ".note-card"
                );
            };
    }

    /*
        Optional future inputs using:
        data-dashboard-search="courses"
        data-dashboard-search="notes"
    */

    $all(
        "[data-dashboard-search]"
    ).forEach(
        input => {

            if (
                input ===
                courseSearch ||
                input ===
                notesSearch
            ) {
                return;
            }

            input.addEventListener(
                "input",
                function () {

                    const target =
                        input.dataset
                            .dashboardSearch;

                    if (
                        target ===
                        "courses"
                    ) {

                        filterCards(
                            input,
                            ".course-card"
                        );

                    } else if (
                        target ===
                        "notes"
                    ) {

                        filterCards(
                            input,
                            ".note-card"
                        );
                    }
                }
            );
        }
    );
}
/* =========================================================
   TURBO AI
   MWANIKI SCHOLARS STUDENT DASHBOARD
========================================================= */

const TURBO_AI_FUNCTION_URL =
    "https://bazixdwtysmkkdeloerx.supabase.co/functions/v1/turbo-ai";

/* =========================================================
   ASK TURBO AI
========================================================= */

async function askTurboAI() {

    const questionInput =
        $("#aiQuestion");

    const askButton =
        $("#askAIButton");

    const answerElement =
        $("#aiAnswer");

    if (!questionInput) {

        console.warn(
            "⚠️ #aiQuestion was not found."
        );

        return;
    }

    if (!answerElement) {

        console.warn(
            "⚠️ #aiAnswer was not found."
        );

        return;
    }

    const question =
        String(
            questionInput.value || ""
        ).trim();

    if (!question) {

        answerElement.textContent =
            "Please enter a medical question first.";

        answerElement.dataset.messageType =
            "warning";

        return;
    }

    /*
        Prevent extremely large requests from being
        unnecessarily sent to Turbo AI.
    */

    if (question.length > 2000) {

        answerElement.textContent =
            "Your question is too long. Please keep it within 2,000 characters.";

        answerElement.dataset.messageType =
            "warning";

        return;
    }

    /*
        Disable the button while Turbo AI is working.
    */

    if (askButton) {

        askButton.disabled =
            true;

        askButton.dataset.originalText =
            askButton.textContent;

        askButton.textContent =
            "Thinking...";
    }

    answerElement.dataset.messageType =
        "loading";

    answerElement.innerHTML = `
        <div class="ai-loading">
            <span>Turbo AI is thinking...</span>
        </div>
    `;

    try {

        /*
            The student's Supabase session is automatically
            used here. We do NOT send the Gemini API key.
        */

        const {
            data: {
                session
            } = {}
        } =
            await supabase.auth
                .getSession();

        if (!session?.access_token) {

            throw new Error(
                "Your session has expired. Please sign in again."
            );
        }

        const response =
            await fetch(
                TURBO_AI_FUNCTION_URL,
                {
                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${session.access_token}`
                    },

                    body:
                        JSON.stringify({
                            message:
                                question
                        })
                }
            );

        let result = null;

        try {

            result =
                await response.json();

        } catch {

            result = null;
        }

        console.log(
            "🤖 Turbo AI response:",
            result
        );

        if (!response.ok) {

            const serverMessage =
                result?.error ||
                result?.message ||
                `Turbo AI request failed (${response.status}).`;

            throw new Error(
                serverMessage
            );
        }

        if (
            !result ||
            result.success !== true ||
            !result.answer
        ) {

            throw new Error(
                result?.error ||
                "Turbo AI did not return a valid answer."
            );
        }

        /*
            Display the answer as text rather than injecting
            arbitrary HTML returned by the AI.
        */

        answerElement.textContent =
            result.answer;

        answerElement.dataset.messageType =
            "success";

        /*
            Store the latest question locally so the student
            can see what they most recently asked.
        */

        writeStorage(
            "mwanikiLastAIQuestion",
            {
                question,
                timestamp:
                    new Date().toISOString()
            }
        );

        console.log(
            "✅ Turbo AI answer displayed successfully."
        );

    } catch (error) {

        console.error(
            "❌ Turbo AI request failed:",
            error
        );

        answerElement.textContent =
            error?.message ||
            "Turbo AI could not generate a response. Please try again.";

        answerElement.dataset.messageType =
            "error";

    } finally {

        if (askButton) {

            askButton.disabled =
                false;

            askButton.textContent =
                askButton.dataset
                    .originalText ||
                "Ask AI";
        }
    }
}

/* =========================================================
   TURBO AI EVENT HANDLER
========================================================= */

function setupTurboAI() {

    const askButton =
        $("#askAIButton");

    const questionInput =
        $("#aiQuestion");

    if (!askButton) {

        console.warn(
            "⚠️ #askAIButton was not found."
        );

        return;
    }

    if (!questionInput) {

        console.warn(
            "⚠️ #aiQuestion was not found."
        );

        return;
    }

    /*
        Prevent multiple event handlers if the setup
        function is ever called again.
    */

    askButton.onclick =
        function (event) {

            event.preventDefault();

            askTurboAI();
        };

    /*
        Allow Ctrl + Enter to submit the question.
    */

    questionInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                event.ctrlKey
            ) {

                event.preventDefault();

                askTurboAI();
            }
        }
    );

    console.log(
        "🤖 Turbo AI dashboard interface ready."
    );
}
/* =========================================================
   OUTSIDE PANEL CLOSING
========================================================= */

function setupOutsidePanelClosing() {

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

        /*
            Set up UI handlers once.
        */

        setupNavigation();

        setupNotificationPanel();

        setupProfilePanel();

        setupProfileForm();

        setupProfilePhoto();

        setupChangePassword();

        setupLogout();

        setupRefreshButtons();

        setupSearch();

        setupOutsidePanelClosing();

        setupEscapeKey();

        /*
            Authentication
        */

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

        /*
            Load the student's profile first so the
            welcome message and profile photo are available.
        */

        const profileLoaded =
            await loadStudentProfile();

        if (!profileLoaded) {

            console.warn(
                "⚠️ Student profile was not loaded, but dashboard will continue."
            );
        }

        /*
            Welcome notification is created once per student
            on this browser/device.
        */

        createWelcomeNotification();

        /*
            Load all dashboard content.
        */

        await Promise.all([
            loadCourses(),
            loadNotes(),
            loadQuizzes()
        ]);

        /*
            Now that courses and notes are available,
            compare them with the student's known content.
        */

        syncContentNotifications();

        /*
            Final rendering pass.
        */

        renderStudentProfile();

        repairProfileFields();

        renderRecentCourse();

        renderRecommendations();

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

            syncContentNotifications();

            updateDashboardStatistics();
        },

    refreshNotes:
        async function () {

            await loadNotes();

            syncContentNotifications();

            updateDashboardStatistics();
        },

    refreshAll:
        async function () {

            await Promise.all([
                loadCourses(),
                loadNotes(),
                loadQuizzes()
            ]);

            syncContentNotifications();

            renderRecentCourse();

            renderRecommendations();

            updateDashboardStatistics();

            renderNotifications();
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
        markAllNotificationsRead
};

/* =========================================================
   OPTIONAL PUBLIC NOTIFICATION FUNCTION
========================================================= */

/*
    This allows another Mwaniki Scholars dashboard script
    to create a local student notification without requiring
    a new database table.

    Example from another script:

        window.mwanikiAddNotification({
            id: "some-unique-id",
            title: "New update",
            message: "Something new is available.",
            type: "update"
        });

*/

window.mwanikiAddNotification =
    function (notification) {

        addNotification(
            notification
        );

        renderNotifications();

        updateNotificationBadge();
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

        /*
            The normal initial page load is handled by
            initializeDashboard() below.

            SIGNED_IN is still handled here for cases where
            authentication completes after the dashboard page
            has loaded.
        */

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
