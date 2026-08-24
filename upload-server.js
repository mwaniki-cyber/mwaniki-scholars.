import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();

const PORT = 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// =====================================================
// MWANIKI SCHOLARS UPLOAD SERVER
// =====================================================

console.log("==========================================");
console.log("🚀 MWANIKI SCHOLARS UPLOAD SERVER");
console.log("==========================================");


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


// =====================================================
// NOTES DIRECTORY
// =====================================================

const notesFolder =
    path.join(__dirname, "notes");


if (!fs.existsSync(notesFolder)) {

    fs.mkdirSync(
        notesFolder,
        {
            recursive: true
        }
    );

}


// =====================================================
// MULTER STORAGE
// =====================================================

const storage =
    multer.diskStorage({

        destination:
            function (
                req,
                file,
                cb
            ) {

                cb(
                    null,
                    notesFolder
                );

            },


        filename:
            function (
                req,
                file,
                cb
            ) {

                const safeName =
                    file.originalname
                        .replace(
                            /[^a-zA-Z0-9._-]/g,
                            "_"
                        );


                const uniqueName =
                    Date.now()
                    +
                    "-"
                    +
                    safeName;


                cb(
                    null,
                    uniqueName
                );

            }

    });


const upload =
    multer({

        storage: storage,

        limits: {

            fileSize:
                50 * 1024 * 1024

        },

        fileFilter:
            function (
                req,
                file,
                cb
            ) {

                const allowed = [

                    ".pdf",
                    ".doc",
                    ".docx",
                    ".ppt",
                    ".pptx"

                ];


                const extension =
                    path.extname(
                        file.originalname
                    )
                    .toLowerCase();


                if (
                    allowed.includes(
                        extension
                    )
                ) {

                    cb(
                        null,
                        true
                    );

                } else {

                    cb(
                        new Error(
                            "Unsupported file type"
                        )
                    );

                }

            }

    });


// =====================================================
// TEST ROUTE
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "🚀 Mwaniki Scholars Upload Server is running"

        });

    }
);


// =====================================================
// UPLOAD NOTES
// =====================================================

app.post(
    "/upload",

    upload.single("file"),

    async (req, res) => {

        try {

            console.log(
                "📤 Upload request received"
            );


            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        "No file received"

                });

            }


            const course =
                req.body.course || "";


            const unit =
                req.body.unit || "";


            if (!course || !unit) {

                // Remove uploaded file if metadata
                // was missing.

                try {

                    fs.unlinkSync(
                        req.file.path
                    );

                } catch (e) {}



                return res.status(400).json({

                    success: false,

                    error:
                        "Course and unit are required"

                });

            }


            console.log(
                "📚 Course:",
                course
            );


            console.log(
                "📖 Unit:",
                unit
            );


            console.log(
                "📄 File:",
                req.file.filename
            );


            // URL that the browser can use
            // to access the uploaded file.

            const fileUrl =
                "/notes/"
                +
                encodeURIComponent(
                    req.file.filename
                );


            return res.status(200).json({

                success: true,

                message:
                    "File uploaded successfully",

                file:
                    req.file.filename,

                file_url:
                    fileUrl,

                original_name:
                    req.file.originalname,

                course:
                    course,

                unit:
                    unit

            });


        }

        catch (error) {

            console.error(
                "❌ UPLOAD ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Upload failed"

            });

        }

    }

);


// =====================================================
// SERVE NOTES
// =====================================================

app.use(
    "/notes",
    express.static(notesFolder)
);


// =====================================================
// 404 HANDLER
// =====================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            error:
                "Endpoint not found"

        });

    }
);


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ SERVER ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            error:
                error.message ||
                "Server error"

        });

    }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    () => {

        console.log(
            `📡 Server running on http://localhost:${PORT}`
        );


        console.log(
            `📁 Notes folder: ${notesFolder}`
        );


        console.log(
            "=========================================="
        );

    }
);