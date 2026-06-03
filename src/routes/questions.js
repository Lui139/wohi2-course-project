const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");
const {NotFoundError, ValidationError, UnauthorizedError} = require("../lib/errors");
const { z } = require("zod");
const { parse } = require("csv-parse/sync");
//const cloudinary = require("../utils/cloudinary");

const QuestionInput = z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    keywords: z.union( [z.string(), z.array(z.string())]).optional(),
    difficulty: z.enum( ["easy", "medium", "hard"]).optional(),
});



const storage = multer.diskStorage({
    destination: path.join(__dirname, "..", "..", "public", "uploads"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb (null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

/*const storage = multer.diskStorage({
    filename : function (req, file, cb) {
        cb(null, file.originalname)
    }
});*/


const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new ValidationError("Only images files are allowed"));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024},
});

const csvUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === "text/csv" ||
            file.mimetype === "application/vnd.ms-excel" ||
            file.originalname.toLowerCase().endsWith(".csv")
        ) {
            cb(null, true);
        } else {
            cb(new ValidationError("Only csv files are allowed"));
        }
    },
    limits: { fileSize: 2 * 1024 * 1024 },
});


function formatQuestion(question) {
    return {
         ...question,
         //date: question.date.toISOString().split("T")[0],
         keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
         userName: question.user ? question.user.name : null,
         attempted: question.attempts && question.attempts.length > 0,
         attemptCount: question._count?.attempts ?? 0,
         user: undefined,
        _count: undefined,
        attempts: undefined,   
    };
}

function parseKeywords(keywords) {
    if (Array.isArray(keywords)) return keywords;
    if (typeof keywords === "string") {
       return keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }
    return [];
};

function normalizeDifficulty(difficulty) {
    const value = String(difficulty || "medium").trim().toLowerCase();

    if (["easy", "medium", "hard"].includes(value)) {
        return value;
    }

    return "medium";
}


// Apply authentication to All routes in this router
router.use(authenticate);

// Multer errors - Json
router.use((err, req, res, next) => {
     if (err instanceof multer.MulterError ||
        err?.message === "Only image files are allowed" ||
        err?.message === "Only CSV files are allowed") {
        return res.status(400).json ({ msg: err.message });
    }
    next (err); // pass through global handler
 });

// GET /api/questions/,/api/questions?keyword=http&page=1&limit=5
// List all questions
router.get("/", async (req, res) => {
    const { keyword, difficulty } = req.query;
    //if (!req.token || req.token === "") {
    //    throw new UnauthorizedError("No token provided");
    //}

    const where = {};
    
    if (keyword) {
        where.keywords = {
            some: { 
                name: keyword,
            },
        };
    }

    if (difficulty) {
        where.difficulty = normalizeDifficulty(difficulty);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;

    const [filteredQuestions, total] = await Promise.all([
        prisma.question.findMany({
            where,
            include: { 
                keywords: true, 
                user: true,
                attempts: {
                    where: {userId: req.user.userId }, 
                    take: 1,
                },
                _count: { 
                    select: { attempts: true } 
                },
            },
            orderBy: { id: "asc" },
            skip,
            take: limit
        }), 
        prisma.question.count({ where }),
    ]);

    res.json({
        data: filteredQuestions.map(formatQuestion),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    });
});

// POST /import csv
router.post("/import-csv", csvUpload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            throw new ValidationError("CSV file is required");
        }

        const csvText = req.file.buffer.toString("utf8");

        const rows = parse(csvText, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true,
        });

        const createdQuestions = [];

        for (const row of rows) {
            const questionText = row.question;
            const answer = row.answer;

            if (!questionText || !answer) {
                continue;
            }

            const keywordsArray = parseKeywords(row.keywords);
            const difficulty = normalizeDifficulty(row.difficulty);

            const createdQuestion = await prisma.question.create({
                data: {
                    question: questionText,
                    answer: answer,
                    difficulty: difficulty,
                    userId: req.user.userId,
                    keywords: {
                        connectOrCreate: keywordsArray.map((kw) => ({
                            where: { name: kw },
                            create: { name: kw },
                        })),
                    },
                },
                include: {
                    keywords: true,
                    user: true,
                    attempts: {
                        where: { userId: req.user.userId },
                        take: 1,
                    },
                    _count: {
                        select: { attempts: true },
                    },
                },
            });

            createdQuestions.push(formatQuestion(createdQuestion));
        }

        res.status(201).json({
            msg: "Questions imported successfully",
            count: createdQuestions.length,
            data: createdQuestions,
        });
    } catch (err) {
        console.error("CSV IMPORT ERROR:", err);

        res.status(500).json({
            msg: "CSV import failed",
            error: err.message,
        });
    }
});


//GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { 
            keywords: true, 
            user: true,
            attempts: { where: { userId: req.user.userId }, take: 1},
            _count: { select: { attempts: true } },
        },
    });

    if (!question) {
        throw new NotFoundError("Question not found");
    }
    res.json(formatQuestion(question));
});


// POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req, res) => {
    const { question, answer, keywords, difficulty } = QuestionInput.parse(req.body);

    if (!question || !answer) {
        throw new ValidationError("question and answer are mandatory");
    }
    
    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}`:null;
    //const imageUrl = cloudinary.uploader.upload(req.file.path);

    const newQuestion = await prisma.question.create({
        data: {
        question, 
        answer,
        difficulty: normalizeDifficulty(difficulty),
        userId: req.user.userId, 
        imageUrl,
        keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
                where: { name: kw }, create: { name: kw },
            })), },
        },
        include: { 
            keywords: true, 
            user: true,
            attempts: { where: { userId: req.user.userId }, take: 1 },
            _count: { select: { attempts: true }  },
        },
    });

    res.status(201).json(formatQuestion(newQuestion));
});

// PUT /api/questions/:questionId - isOwner checks existence + ownership
// Edit a question
router.put("/:questionId", upload.single("image"), isOwner,  async (req, res) => {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords, difficulty } = QuestionInput.parse(req.body);
    
    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    
    if (!existingQuestion) {
        throw new NotFoundError("Question not found");
    }

    if (!question || !answer) {
        throw new ValidationError("question and answer are mandatory");
    }
    //const imageUrl = req.file ? `/uploads/${req.file.filename}`:null;
    const imageUrl = req.file ? `/uploads/${req.file.filename}`:existingQuestion.imageUrl;

    const keywordsArray = parseKeywords(keywords);
    const updatedQuestion = await prisma.question.update({
        where: { id: questionId },
        data: {
            question, 
            answer, 
            difficulty: normalizeDifficulty(difficulty),
            imageUrl,
            keywords: {
                set: [],
                connectOrCreate: keywordsArray.map((kw) => ({
                    where: { name: kw },
                    create: { name: kw },
                })),
            },
        },
        include: { 
            keywords: true, 
            user: true,
            attempts: {where: {userId: req.user.userId}, take: 1},
            _count: { select: {attempts: true} }
          },
    });
    res.json(formatQuestion(updatedQuestion));

});

// DELETE / api/questions/:questionId
router.delete("/:questionId", isOwner, async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { 
            keywords: true, 
            user: true,
            attempts: {
                where: { userId: req.user.userId },
                take: 1,
            },
            _count: {
                select: { attempts: true },
            },  
        },
    });
    if (!question) {
        throw new NotFoundError("Question not found");
    }

    await prisma.attempt.deleteMany({
        where: { questionId },
    });

    await prisma.question.delete({ 
        where: { id: questionId },
    });

    res.json({
        msg: "Question deleted successfully",
        question: formatQuestion(question),
    });
   
});
//POST /api/questions/:questionId/attempt
router.post("/:questionId/play", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({
        where: { id: questionId },
    });

    if (!question) {
        throw new NotFoundError("Question not found");
    }

    const data = req.body;
    const submittedAnswer = String(data.answer || "").trim().toLowerCase();
    const correctAnswer = String(question.answer || "").trim().toLowerCase();
    const isCorrect = submittedAnswer === correctAnswer;

    const attempt = await prisma.attempt.upsert({
        where: {
            userId_questionId: {
                userId: req.user.userId,
                questionId,
            },
        },
        update: {
            correct: isCorrect,
        },
        create: {
            userId: req.user.userId,
            questionId,
            correct: isCorrect,
        },
    });

    const attemptCount = await prisma.attempt.count({
        where: { questionId },
    });

    return res.status(201).json({
        id: attempt.id,
        correct: isCorrect,
        questionId,
        attempted: true,
        attemptCount,
        correctAnswer: isCorrect ? data.answer : question.answer,
        createdAt: attempt.createdAt,
    });
});


module.exports = router;