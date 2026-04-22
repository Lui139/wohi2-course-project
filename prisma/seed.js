const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();


const seedQuestions = [
{
    question: "What is the capital of Finland?",
    answer: "Helsinki",
    keywords: ["country", "capital", "Helsinki"],
},
{
    question: "What is the capital of Peru?",
    answer: "Lima",
    keywords: ["country", "capital", "Lima"],
},
{
    question: "What is the capital of Tibet?",
    answer: "Lhasa",
    keywords: ["country", "capital", "Lhasa"],
},
{
    question: "What is the capital of India?",
    answer: "New Delhi",
    keywords: ["country", "capital", "New Delhi"],
},
];

async function main() {
   await prisma.question.deleteMany();
   await prisma.keyword.deleteMany();
   await prisma.user.deleteMany();

   const hashedPassword = await bcrypt.hash("1234", 10);
   const user = await prisma.user.create({
     data: {
        email: "example@example.org",
        password: hashedPassword,
        name: "Example user"
     }
    });
    console.log("Created user:", user.email);

//Create questions associated with the user
for (const question of seedQuestions) {
    await prisma.question.create({
        data: {
            question: question.question,
            answer: question.answer,
            userId: user.id,
            keywords: {
                connectOrCreate: question.keywords.map((kw) => ({
                    where: { name: kw },
                    create: { name: kw },
                })),
            },
        },
    });
}

console.log("Seed data inserted successfully");
}
main()
.catch((e) => {
console.error(e);
process.exit(1);
})
.finally(() => prisma.$disconnect());