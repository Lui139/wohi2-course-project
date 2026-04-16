const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");


// function formatQuestion(test) {
//     return {
//         ...test,
//         date: test.date.toISOString().split("T")[0],
//         keywords: test.keywords.map((k) => k.name),
//     };
// }

// GET /api/questions/,/api/posts?keyword=http
// List all questions
router.get("/", async (req, res) => {
    const {keyword} = req.query;

    const where = keyword ?
    { keywords: { some: { name: keyword }}}: {};

    const q = await prisma.question.findMany({
        where,
        include: {keywords: true},
        orderBy: { id: "asc" }
    });

    res.json(q);
});

//GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const test = await prisma.test.findUnique({
        where: { id: questionId },
        include: { keywords: true },
    });

    if (!test) {
        return res.status(404).json({msg: "Question not found"});
    }
    res.json((test));
});


// POST /api/questions
// Create a new question
router.post("/", async (req, res) => {
    const { question, answer, keywords } = req.body;

    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"});
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];

    const newQuestion = await prisma.test.create({
        data: {
        question, answer,
        keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
                where: { name: kw }, create: { name: kw },
            })), },
        },
        include: { keywords: true },
    });

    res.status(201).json((newQuestion));
});

// PUT /api/questions/:questionId
// Edit a question
router.put("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const { question, answer, keywords} = req.body;
    const existingQuestion = await prisma.test.findUnique({ where: { id: questionId } });
    if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
    }

    if (!title || !answer) {
        return res.status(400).json({msg: "question and answer are required"});
    }
    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const updatedQuestion = await prisma.test.update({
        where: { id: questionId },
        data: {
            question, answer,
            keywords: {
                set: [],
                connectOrCreate: keywordsArray.map((kw) => ({
                    where: { name: kw },
                    create: { name: kw },
                })),
            },
        },
        include: { keywords: true },
    });
    res.json(updatedQuestion);

});

// DELETE / api/questions/:questionId
router.delete("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const test = await prisma.test.findUnique({
        where: { id: questionId },
        include: { keywords: true },
    });
    if (!test) {
        return res.status(404).json({ message: "Question not found" });
    }
    await prisma.test.delete({ where: { id: questionId } });

    res.json({
        msg: "Question deleted successfully",
        test: (test),
    });
   
});

module.exports = router;