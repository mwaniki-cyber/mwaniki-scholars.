import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fs from "fs";
import { Octokit } from "@octokit/rest";


dotenv.config();


const app = express();


app.use(cors());

app.use(express.json());



/*
===========================
GITHUB CONFIGURATION
===========================
*/

const octokit = new Octokit({

auth: process.env.GITHUB_TOKEN

});


const OWNER = "mwaniki-cyber";

const REPO = "mwaniki-scholars";

const BRANCH = "main";





/*
===========================
FILE UPLOAD SETTINGS
===========================
*/


const upload = multer({

storage: multer.memoryStorage(),

limits:{
fileSize:50 * 1024 * 1024
}

});





/*
===========================
TEST ROUTE
===========================
*/


app.get("/",(req,res)=>{

res.send(
"Mwaniki Scholars Upload Server Running 🚀"
);

});







/*
===========================
UPLOAD TO GITHUB
===========================
*/


app.post(
"/upload",
upload.single("file"),
async(req,res)=>{


try{


if(!req.file){

return res.status(400).json({

error:"No file selected"

});

}



const {

course,

unit

}=req.body;



if(!course || !unit){

return res.status(400).json({

error:"Course and unit required"

});

}





const extension =

req.file.originalname.substring(

req.file.originalname.lastIndexOf(".")

);





const fileName =

course

.replaceAll(" ","_")

+"_Unit"

+unit

+extension;





const filePath =

`notes/${fileName}`;







const content =

req.file.buffer.toString("base64");






/*
Check if file exists
*/

let sha = null;


try{


const existing = await octokit.repos.getContent({

owner:OWNER,

repo:REPO,

path:filePath,

branch:BRANCH

});


sha = existing.data.sha;


}

catch(error){

// file does not exist

}








/*
Create or update file
*/


await octokit.repos.createOrUpdateFileContents({

owner:OWNER,

repo:REPO,

path:filePath,

message:

`Upload ${fileName}`,

content:content,

branch:BRANCH,

sha:sha || undefined

});






res.json({

success:true,

file:fileName,

message:

"Notes uploaded successfully"

});





}

catch(error){


console.error(error);


res.status(500).json({

error:error.message

});


}


});







const PORT = process.env.PORT || 5000;


app.listen(PORT,()=>{


console.log(

`Mwaniki Upload Server running on port ${PORT}`

);


});