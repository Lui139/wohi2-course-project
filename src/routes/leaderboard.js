const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

router.get("/", async (req, res) => {
    const groupedAttempts = await prisma.attempt.groupBy({
        by: ["userId"],
        where: {
            correct: true,
        },
        _count: {
            id: true,
        },
        orderBy: {
            _count: {
                id: "desc",
            },
        },
        take: 5,
    });

    const userIds = groupedAttempts.map((item) => item.userId);

    const users = await prisma.user.findMany({
        where: {
            id: {
                in: userIds,
            },
        },
        select: {
            id: true,
            name: true,
            email: true,
        },
    });

    const leaderboard = groupedAttempts.map((item, index) => {
        const user = users.find((u) => u.id === item.userId);

        return {
            rank: index + 1,
            userId: item.userId,
            name: user ? user.name : "Unknown user",
            email: user ? user.email : null,
            successfulAttempts: item._count.id,
        };
    });

    res.json({
        data: leaderboard,
    });
});

module.exports = router;