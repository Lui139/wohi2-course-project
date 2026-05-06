const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: path.join(__dirname, "..", "..", "public", "uploads"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb (null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only images files are allowed"));
    },
    limits: { fileSize: 5 * 1024 * 1024},
});


function formatQuestion(question) {
    return {
         ...question,
         //date: question.date.toISOString().split("T")[0],
         keywords: question.keywords.map((k) => k.name),
         userName: question.user?.name || null,
         attemptCount: question._count?.attempts ?? 0,
         attempted: question.attempts ? question.attempts.length > 0 : false,
         user: undefined,
         attempts: undefined,
         _count: undefined,
    };
}

function parseKeywords(keywords) {
    if (Array.isArray(keywords)) return keywords;
    if (typeof keywords === "string") {
       return keywords.split(",").map((k) => k.trim()).filter(Boolean);
    }
    return [];
};


// Apply authentication to All routes in this router
router.use(authenticate);

// Multer errors - Json
// router.use((err, req, next) => {
//     if (err instanceof multer.MulterError ||
//        err?.message === "Only image files are allowed") {
//        return res.status(400).json ({ msg: err.message });
//    }
//    next (err);
// });



// GET /api/questions/,/api/questions?keyword=http&page=1&limit=5
// List all questions
router.get("/", async (req, res) => {
    const {keyword} = req.query;

    const where = keyword
        ? { keywords: { some: { name: keyword } } }
        : {};

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;

    const [filteredQuestions, total] = await Promise.all([
        prisma.question.findMany({
            where,
            include: { 
                keywords: true, 
                user: true,
                attempts: {where: {userId: req.user.userId }, take: 1 },
                _count: { select: {attempts: true} },
            },
            orderBy: { id: "asc" },
            skip,
            take: limit
        }), 
        prisma.question.count({where}),
    ]);

    res.json({
        data: filteredQuestions.map(formatQuestion),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    });
});

//GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const test = await prisma.question.findUnique({
        where: { id: questionId },
        include: { 
            keywords: true, 
            user: true,
            attempts: { where: { userId: req.user.userId }, take: 1},
            _count: { select: { attempts: true } },
        },
    });

    if (!test) {
        return res.status(404).json({msg: "Question not found"});
    }

    res.json(formatQuestion(test));
});


// POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req, res) => {
    const { question, answer, keywords } = req.body;

    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"});
    }

    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}`:null;
    const newQuestion = await prisma.question.create({
        data: {
        question, answer,
        userId: req.user.userId, imageUrl,
        keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
                where: { name: kw }, create: { name: kw },
            })), },
        },
        include: { keywords: true, user: true  },
    });

    res.status(201).json(formatQuestion(newQuestion));
});

// PUT /api/questions/:questionId - isOwner checks existence + ownership
// Edit a question
router.put("/:questionId", upload.single("image"), isOwner,  async (req, res) => {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords} = req.body;
    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    
    if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
    }

    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"});
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}`:null;

    const keywordsArray = parseKeywords(keywords);
    const updatedQuestion = await prisma.question.update({
        where: { id: questionId },
        data: {
            question, answer, imageUrl,
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
    const test = await prisma.question.findUnique({
        where: { id: questionId },
        include: { keywords: true, user: true  },
    });
    if (!test) {
        return res.status(404).json({ message: "Question not found" });
    }
    await prisma.question.delete({ where: { id: questionId } });

    res.json({
        msg: "Question deleted successfully",
        test: formatQuestion(test),
    });
   
});
//POST /api/questions/:questionId/attempt
router.post("/:questionId/play", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({where: {id: questionId}});
    if(!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const data = req.body;

    if(question.answer === data.answer){
        const attemptCount = await prisma.attempt.count({where: { questionId } });

        return res.status(201).json({
            //id: attempt.id,
            correct: true,
            questionId,
            attempted: true,
            attemptCount,
            correctAnswer: data.answer,
            //createdAt: attempt.createdAt,
        });
    }
    else {
        return res.status(201).json({
            //id: attempt.id,
            correct: false,
            questionId,
            attempted: true,
            //attemptCount,
            correctAnswer: question.answer,
            //createdAt: attempt.createdAt,
        });
    }

    // const attempt = await prisma.attempt.upsert({
    //     where: { userId_questionId: { userId: req.user.userId, questionId } },
    //     update: {},
    //     create: {userId: req.user.userId, questionId}
    // });


});


module.exports = router;