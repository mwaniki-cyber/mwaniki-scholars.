import { supabase } from "./supabase.js";


// =====================================
// ADD QUIZ QUESTION
// =====================================


window.addQuiz = async function(){



const course =

document.getElementById("quizCourse").value.trim();



const unit =

document.getElementById("quizUnit").value.trim();



const question =

document.getElementById("quizQuestion").value.trim();



const optionA =

document.getElementById("optionA").value.trim();



const optionB =

document.getElementById("optionB").value.trim();



const optionC =

document.getElementById("optionC").value.trim();



const answer =

document.getElementById("correctAnswer").value.trim();



const status =

document.getElementById("quizStatus");






if(
course==="" ||
unit==="" ||
question==="" ||
answer===""
){


status.innerHTML=

"❌ Fill all required fields";


return;

}







const {error}=await supabase

.from("quizzes")

.insert({


course:course,

unit:unit,

question:question,

option_a:optionA,

option_b:optionB,

option_c:optionC,

correct_answer:answer


});






if(error){


console.log(error);


status.innerHTML=

"❌ "+error.message;


return;


}






status.innerHTML=

"✅ Quiz question added";





// Clear fields


document.getElementById("quizQuestion").value="";

document.getElementById("optionA").value="";

document.getElementById("optionB").value="";

document.getElementById("optionC").value="";

document.getElementById("correctAnswer").value="";



};





console.log(

"📝 Quiz Admin Connected"

);