import { supabase } from "./supabase.js";


// ===============================
// ADD COURSE
// ===============================


window.addCourse = async function(){



const name =

document.getElementById("courseName").value.trim();



const description =

document.getElementById("courseDescription").value.trim();



const status =

document.getElementById("courseStatus");





if(name===""){

status.innerHTML="❌ Enter course name";

return;

}





const {error}=await supabase

.from("courses")

.insert({

name:name,

description:description

});






if(error){

console.log(error);

status.innerHTML="❌ "+error.message;

return;

}





status.innerHTML="✅ Course added successfully";



document.getElementById("courseName").value="";

document.getElementById("courseDescription").value="";



};







// ===============================
// LOAD STUDENT COUNT
// ===============================


async function loadStudents(){



const box =

document.getElementById("studentCount");





const {data,error,count}=await supabase

.from("profiles")

.select("*",{count:"exact"});





if(error){

box.innerHTML="Unable to load";

return;

}





box.innerHTML=

`

<h3>

👨‍🎓 ${count || 0}

</h3>

Registered Students

`;



}




loadStudents();



console.log(

"⚙ Admin Dashboard Connected"

);