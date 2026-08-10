import { supabase } from "./supabase.js";

// =====================================================
// MWANIKI SCHOLARS COURSE LIBRARY
// =====================================================

// Built-in Mwaniki Scholars medical course library
const defaultCourses = [

    {
        id: "anatomy",
        name: "Anatomy",
        description: "Study of the structure of the human body."
    },

    {
        id: "physiology",
        name: "Physiology",
        description: "Study of normal functions and processes of the human body."
    },

    {
        id: "biochemistry",
        name: "Medical Biochemistry",
        description: "Study of biochemical processes occurring in the human body."
    },

    {
        id: "microbiology",
        name: "Medical Microbiology",
        description: "Study of microorganisms and their role in human disease."
    },

    {
        id: "bacteriology",
        name: "Bacteriology",
        description: "Study of bacteria, their characteristics and diseases."
    },

    {
        id: "virology",
        name: "Virology",
        description: "Study of viruses and viral diseases."
    },

    {
        id: "mycology",
        name: "Medical Mycology",
        description: "Study of fungi and fungal infections."
    },

    {
        id: "parasitology",
        name: "Medical Parasitology",
        description: "Study of parasites and diseases caused by parasites."
    },

    {
        id: "immunology",
        name: "Immunology",
        description: "Study of the immune system and immune responses."
    },

    {
        id: "pharmacology",
        name: "Pharmacology",
        description: "Study of drugs, their actions, uses and adverse effects."
    },

    {
        id: "pathology",
        name: "Pathology",
        description: "Study of disease processes and pathological changes."
    },

    {
        id: "hematology",
        name: "Hematology",
        description: "Study of blood, blood cells and blood disorders."
    },

    {
        id: "histology",
        name: "Histology",
        description: "Microscopic study of cells and tissues."
    },

    {
        id: "cytology",
        name: "Cytology",
        description: "Study of cells and cellular abnormalities."
    },

    {
        id: "molecular-biology",
        name: "Molecular Biology",
        description: "Study of DNA, RNA, genes and molecular processes."
    },

    {
        id: "genetics",
        name: "Medical Genetics",
        description: "Study of heredity, genes and genetic disorders."
    },

    {
        id: "clinical-chemistry",
        name: "Clinical Chemistry",
        description: "Laboratory analysis of biochemical substances in body fluids."
    },

    {
        id: "medical-laboratory-science",
        name: "Medical Laboratory Science",
        description: "Principles and practices of diagnostic laboratory science."
    },

    {
        id: "medical-terminology",
        name: "Medical Terminology",
        description: "Study of terminology used in healthcare and medicine."
    },

    {
        id: "public-health",
        name: "Public Health",
        description: "Promotion of health and prevention of disease in populations."
    },

    {
        id: "epidemiology",
        name: "Epidemiology",
        description: "Study of disease distribution, causes and control."
    },

    {
        id: "nutrition",
        name: "Human Nutrition",
        description: "Study of nutrients, diet and their relationship to health."
    },

    {
        id: "medical-ethics",
        name: "Medical Ethics",
        description: "Ethical principles governing healthcare practice."
    },

    {
        id: "health-education",
        name: "Health Education",
        description: "Principles and methods of promoting healthy behavior."
    },

    {
        id: "nursing-fundamentals",
        name: "Nursing Fundamentals",
        description: "Fundamental principles of nursing care."
    },

    {
        id: "community-health",
        name: "Community Health",
        description: "Healthcare delivery and disease prevention in communities."
    },

    {
        id: "maternal-health",
        name: "Maternal Health",
        description: "Healthcare of women during pregnancy, childbirth and postpartum."
    },

    {
        id: "reproductive-health",
        name: "Reproductive Health",
        description: "Study of reproductive health and reproductive systems."
    },

    {
        id: "paediatrics",
        name: "Paediatrics",
        description: "Medical care and diseases affecting children."
    },

    {
        id: "internal-medicine",
        name: "Internal Medicine",
        description: "Diagnosis and management of diseases affecting internal organs."
    },

    {
        id: "surgery",
        name: "General Surgery",
        description: "Principles of surgical disease management and procedures."
    },

    {
        id: "clinical-skills",
        name: "Clinical Skills",
        description: "Essential practical skills used in clinical healthcare."
    },

    {
        id: "first-aid",
        name: "First Aid",
        description: "Immediate care provided to injured or suddenly ill persons."
    },

    {
        id: "medical-imaging",
        name: "Medical Imaging",
        description: "Principles of diagnostic medical imaging."
    },

    {
        id: "radiography",
        name: "Radiography",
        description: "Principles and practice of radiographic imaging."
    },

    {
        id: "infection-prevention",
        name: "Infection Prevention and Control",
        description: "Prevention and control of healthcare-associated infections."
    },

    {
        id: "biosafety",
        name: "Laboratory Biosafety",
        description: "Safe handling of biological materials in healthcare laboratories."
    },

    {
        id: "laboratory-management",
        name: "Medical Laboratory Management",
        description: "Management, quality systems and administration of laboratories."
    },

    {
        id: "quality-assurance",
        name: "Laboratory Quality Assurance",
        description: "Quality control and quality assurance in laboratory medicine."
    },

    {
        id: "phlebotomy",
        name: "Phlebotomy",
        description: "Principles and techniques of blood specimen collection."
    },

    {
        id: "blood-transfusion",
        name: "Blood Transfusion Science",
        description: "Principles of blood grouping, compatibility and transfusion."
    },

    {
        id: "immunohematology",
        name: "Immunohematology",
        description: "Study of blood group antigens, antibodies and transfusion reactions."
    },

    {
        id: "medical-parasitology",
        name: "Clinical Parasitology",
        description: "Laboratory diagnosis of parasitic infections."
    },

    {
        id: "clinical-microbiology",
        name: "Clinical Microbiology",
        description: "Laboratory diagnosis of infectious diseases."
    },

    {
        id: "clinical-immunology",
        name: "Clinical Immunology",
        description: "Laboratory investigation of immune disorders."
    },

    {
        id: "clinical-hematology",
        name: "Clinical Hematology",
        description: "Laboratory investigation of blood disorders."
    },

    {
        id: "clinical-pathology",
        name: "Clinical Pathology",
        description: "Laboratory investigation of disease processes."
    },

    {
        id: "urinalysis",
        name: "Urinalysis",
        description: "Physical, chemical and microscopic examination of urine."
    },

    {
        id: "histopathology",
        name: "Histopathology",
        description: "Laboratory examination of tissues for disease diagnosis."
    },

    {
        id: "cytopathology",
        name: "Cytopathology",
        description: "Diagnosis of disease through examination of individual cells."
    }

];


// =====================================================
// LOAD COURSES
// =====================================================

async function loadCourses() {

    const courseArea =
        document.getElementById("courseArea");


    if (!courseArea) {

        console.error(
            "❌ courseArea not found in dashboard.html"
        );

        return;
    }


    courseArea.innerHTML =
        "<p>⏳ Loading courses...</p>";


    let databaseCourses = [];


    try {

        const { data, error } =
            await supabase
                .from("courses")
                .select("*");


        if (error) {

            console.warn(
                "⚠️ Supabase courses could not be loaded:",
                error.message
            );

        } else {

            databaseCourses =
                data || [];

        }

    } catch (error) {

        console.warn(
            "⚠️ Course database unavailable:",
            error
        );

    }


    // =================================================
    // COMBINE DATABASE + BUILT-IN COURSES
    // =================================================

    const allCourses = [
        ...databaseCourses,
        ...defaultCourses
    ];


    // Remove duplicate course names
    const uniqueCourses = [];

    const seen = new Set();


    allCourses.forEach(course => {

        const courseName =
            course.name ||
            course.course_name ||
            course.course_title ||
            course.title;


        if (!courseName) {
            return;
        }


        const key =
            courseName
                .toLowerCase()
                .trim();


        if (!seen.has(key)) {

            seen.add(key);

            uniqueCourses.push({

                id:
                    course.id ||
                    "local-" + key
                        .replace(/\s+/g, "-"),

                name:
                    courseName,

                description:
                    course.description ||
                    course.course_description ||
                    course.details ||
                    "Medical learning course"

            });

        }

    });


    console.log(
        "📚 Total courses available:",
        uniqueCourses.length
    );


    // =================================================
    // NO COURSES
    // =================================================

    if (
        uniqueCourses.length === 0
    ) {

        courseArea.innerHTML = `
            <p>
                📚 No courses available yet.
            </p>
        `;

        return;
    }


    // =================================================
    // DISPLAY COURSES
    // =================================================

    courseArea.innerHTML = "";


    uniqueCourses.forEach(course => {

        const card =
            document.createElement("div");


        card.className =
            "course-card";


        card.innerHTML = `

            <div
                style="
                padding:18px;
                margin:10px 0;
                border-radius:14px;
                background:#eef7fb;
                border:1px solid #d9edf2;
                "
            >

                <h3
                    style="
                    margin:0 0 8px 0;
                    color:#063970;
                    "
                >
                    📚 ${course.name}
                </h3>


                <p>
                    ${course.description}
                </p>


                <button
                    class="open-course-button"
                    data-course-id="${course.id}"
                    data-course-name="${course.name}"
                >
                    📖 Open Course
                </button>

            </div>

        `;


        courseArea.appendChild(card);

    });


    // =================================================
    // OPEN COURSE
    // =================================================

    document
        .querySelectorAll(
            ".open-course-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    const courseId =
                        this.dataset.courseId;


                    const courseName =
                        this.dataset.courseName;


                    localStorage.setItem(
                        "selectedCourse",
                        courseId
                    );


                    localStorage.setItem(
                        "selectedCourseName",
                        courseName
                    );


                    window.location.href =
                        "course.html";

                }
            );

        });


    // =================================================
    // COURSE SEARCH
    // =================================================

    const search =
        document.getElementById(
            "courseSearch"
        );


    if (search) {

        search.addEventListener(
            "input",
            function () {

                const term =
                    this.value
                        .toLowerCase()
                        .trim();


                document
                    .querySelectorAll(
                        ".course-card"
                    )
                    .forEach(card => {

                        const text =
                            card.textContent
                                .toLowerCase();


                        card.style.display =
                            text.includes(term)
                                ? ""
                                : "none";

                    });

            }
        );

    }

}


// =====================================================
// START COURSE SYSTEM
// =====================================================

loadCourses();