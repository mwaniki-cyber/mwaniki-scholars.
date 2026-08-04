import { supabase } from "./supabase.js";


// =====================================
// UPLOAD NOTES TO SUPABASE STORAGE
// =====================================


window.uploadNotes = async function(){



const file =

document.getElementById("noteFile").files[0];



const course =

document.getElementById("noteCourse").value;



const unit =

document.getElementById("noteUnit").value;



const status =

document.getElementById("noteStatus");





if(!file){

status.innerHTML="❌ Select a file first";

return;

}





if(course==="Select Course"){

status.innerHTML="❌ Select course";

return;

}






status.innerHTML="⏳ Uploading...";





// Create unique filename

const fileName =

Date.now()+"_"+file.name;






// Upload file

const {data,error}=await supabase.storage

.from("notes")

.upload(

fileName,

file

);






if(error){


console.log(error);


status.innerHTML=

"❌ Upload failed: "+error.message;


return;


}







// Get public URL


const {data:urlData}=

supabase.storage

.from("notes")

.getPublicUrl(fileName);





const fileUrl=

urlData.publicUrl;









// Save information in database


const {error:dbError}=await supabase

.from("notes")

.insert({

course:course,

unit:unit,

file_name:file.name,

file_url:fileUrl

});






if(dbError){


console.log(dbError);


status.innerHTML=

"❌ Database error";


return;


}







status.innerHTML=

"✅ Notes uploaded successfully";





document.getElementById("noteFile").value="";



};