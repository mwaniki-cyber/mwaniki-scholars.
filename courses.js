// =====================================
// MWANIKI SCHOLARS COURSE DATABASE
// =====================================


export const courses = {

"Anatomy":{

units:[

{
title:"Unit 1: Introduction to Anatomy",
notes:"Anatomical terminology, body organization, planes and positions.",
file:"Anatomy_Unit1.pdf"
},

{
title:"Unit 2: Skeletal System",
notes:"Bones, joints and skeletal anatomy.",
file:"Anatomy_Unit2.pdf"
},

{
title:"Unit 3: Muscular System",
notes:"Muscles, movement and clinical anatomy.",
file:"Anatomy_Unit3.pdf"
},

{
title:"Unit 4: Nervous System",
notes:"Brain, spinal cord and peripheral nerves.",
file:"Anatomy_Unit4.pdf"
},

{
title:"Unit 5: Applied Anatomy",
notes:"Clinical applications of anatomy.",
file:"Anatomy_Unit5.pdf"
}

]

},



"Physiology":{

units:[

{
title:"Unit 1: Cell Physiology",
notes:"Cell structure, transport and homeostasis.",
file:"Physiology_Unit1.pdf"
},

{
title:"Unit 2: Blood Physiology",
notes:"Blood cells, plasma and immunity.",
file:"Physiology_Unit2.pdf"
},

{
title:"Unit 3: Cardiovascular Physiology",
notes:"Heart function and circulation.",
file:"Physiology_Unit3.pdf"
},

{
title:"Unit 4: Respiratory Physiology",
notes:"Gas exchange and breathing mechanisms.",
file:"Physiology_Unit4.pdf"
},

{
title:"Unit 5: Renal Physiology",
notes:"Kidney function and fluid balance.",
file:"Physiology_Unit5.pdf"
}

]

},




"Microbiology":{

units:[

{
title:"Unit 1: Introduction to Microbiology",
notes:"Microorganisms, classification and laboratory safety.",
file:"Microbiology_Unit1.pdf"
},


{
title:"Unit 2: Bacteriology",
notes:"Bacterial structure, growth and identification.",
file:"Microbiology_Unit2.pdf"
},


{
title:"Unit 3: Virology",
notes:"Viruses and viral diseases.",
file:"Microbiology_Unit3.pdf"
},


{
title:"Unit 4: Mycology",
notes:"Fungi and fungal infections.",
file:"Microbiology_Unit4.pdf"
},


{
title:"Unit 5: Medical Parasitology",
notes:"Parasites of medical importance.",
file:"Microbiology_Unit5.pdf"
}

]

},





"Pharmacology":{

units:[

{
title:"Unit 1: General Pharmacology",
notes:"Drug principles, absorption and distribution.",
file:"Pharmacology_Unit1.pdf"
},


{
title:"Unit 2: Autonomic Pharmacology",
notes:"Drugs affecting autonomic nervous system.",
file:"Pharmacology_Unit2.pdf"
},


{
title:"Unit 3: Antibiotics",
notes:"Antimicrobial agents and resistance.",
file:"Pharmacology_Unit3.pdf"
},


{
title:"Unit 4: Cardiovascular Drugs",
notes:"Drugs affecting the heart and vessels.",
file:"Pharmacology_Unit4.pdf"
},


{
title:"Unit 5: Clinical Pharmacology",
notes:"Safe prescribing and drug monitoring.",
file:"Pharmacology_Unit5.pdf"
}

]

}

};



// =====================================
// ADDITIONAL MEDICAL COURSES
// =====================================


const extraCourses=[

"Biochemistry",
"Pathology",
"Hematology",
"Immunology",
"Genetics",
"Histology",
"Embryology",
"Neuroscience",
"Cardiology",
"Neurology",
"Dermatology",
"Endocrinology",
"Gastroenterology",
"Nephrology",
"Pulmonology",
"Rheumatology",
"Oncology",
"Radiology",
"Surgery",
"Orthopedics",
"Urology",
"Anesthesiology",
"Emergency Medicine",
"Internal Medicine",
"Family Medicine",
"Pediatrics",
"Neonatology",
"Obstetrics",
"Gynecology",
"Psychiatry",
"Ophthalmology",
"ENT",
"Dentistry",
"Public Health",
"Epidemiology",
"Biostatistics",
"Community Medicine",
"Infectious Diseases",
"Toxicology",
"Forensic Medicine",
"Critical Care",
"Nutrition",
"Physiotherapy",
"Palliative Care",
"Laboratory Medicine",
"Clinical Pharmacology",
"Preventive Medicine",
"Tropical Medicine"

];



extraCourses.forEach(course=>{


if(!courses[course]){


courses[course]={

units:[1,2,3,4,5].map(num=>({

title:`${course} Unit ${num}`,

notes:`${course} learning materials`,

file:`${course.replaceAll(" ","_")}_Unit${num}.pdf`

}))

};


}


});



console.log(
"📚 Courses loaded:",
Object.keys(courses).length
);