import { supabase } from "./supabase.js";


// =====================================
// SAVE TUTOR PROFILE
// =====================================


window.saveTutor = async function(){



const name =

document.getElementById("tutorName").value.trim();



const email =

document.getElementById("tutorEmail").value.trim();



const subject =

document.getElementById("tutorSubject").value.trim();



const status =

document.getElementById("tutorStatus");






if(
name==="" ||
email==="" ||
subject===""
){


status.innerHTML=

"❌ Fill all tutor details";


return;


}







const {error}=await supabase

.from("tutors")

.insert({

name:name,

email:email,

subject:subject,

status:"offline"

});







if(error){


console.log(error);


status.innerHTML=

"❌ "+error.message;


return;


}







status.innerHTML=

"✅ Tutor profile created";







document.getElementById("tutorName").value="";

document.getElementById("tutorEmail").value="";

document.getElementById("tutorSubject").value="";



};





console.log(

"👨‍🏫 Tutor Admin Connected"

);