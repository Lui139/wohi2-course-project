const express = require("express");
const router = express.Router();
const questions = require("../data/questions");

// GET /api/questions/,/api/posts?keyword=http
// List all questions
router.get("/", (req, res) => {
    const {keyword} = req.query;
    if(!keyword) {
        return res.json(questions);
    }
    const filteredQuestions = questions.filter(q=>q.keywords.includes(keyword));
    res.json(filteredQuestions);
});

//GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", (req, res) => {
    const questionId = Number(req.params.questionId);
    const test = questions.find(q=>q.id === questionId);
    if (!test) {
        return res.status(404).json({msg: "Question not found"})
    }
    res.json(test);
});


// POST /api/questions
// Create a new question
router.post("/", (req, res) => {
    const { question, answer, keywords } = req.body;
    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"});
    }
    const existingIds = questions.map(q => q.id) // [1,2,3,4]
    const maxId = Math.max(...existingIds)
    const newQuestion = {
        id: questions.length ? maxId + 1 : 1,
        question, answer,
        keywords: Array.isArray(keywords) ? keywords : []
    };
    questions.push(newQuestion);
    res.status(201).json(newQuestion);
});

// PUT /api/questions/:questionId
// Edit a question
router.put("/:questionId", (req, res) => {
    const qId = Number(req.params.questionId);

    // validate requet body's data
    const {question, answer, keywords} = req.body;
    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"});
    }

    // the question to be updated
    const test = questions.find(q=>q.id === qId);
    if (!test) {
        // the question has not been found
        return res.status(404).json({msg: "Question not found"});
    }

    // the question has been found
    test.question = question;
    test.answer = answer;
    test.keywords = Array.isArray(keywords) ? keywords : [];
    
    res.json(test);
});

// DELETE / api/questions/:questionId
router.delete("/:questionId", (req, res) => {
    const questionId = Number(req.params.questionId);
    const questionIndex = questions.findIndex(q=> q.id === questionId);

    if(questionIndex === -1){
        return res.status(404).json({msg: "Question not found"})
    }
    const deletedQuestion = questions.splice(questionIndex, 1);
    res.json({
        msg: "Question deleted successfully",
        test: deletedQuestion
    });
});

module.exports = router;