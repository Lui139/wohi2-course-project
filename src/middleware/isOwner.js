const { NotFoundError, ForbiddenError } = require("../lib/errors");
const prisma = require("../lib/prisma");

async function isOwner (req, res, next) {
    const id = Number(req.params.questionId);
    const test = await prisma.question.findUnique({
       where: { id },
       include: { keywords: true },
    });
    if (!test) {
      throw new NotFoundError("Question not found");
    }
    if (test.userId !== req.user.userId) {
      throw new ForbiddenError("You can only modify your own questions");
    }
    // Attach the record to the request so the route handler can reuse it
    req.test = test;
    next();
}

module.exports = isOwner;