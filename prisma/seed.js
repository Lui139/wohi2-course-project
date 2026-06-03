const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();


const seedQuestions = [
{
    question: "What is the capital of Finland?",
    answer: "Helsinki",
    keywords: ["country", "capital", "Finland"],
    difficulty: "easy",
},
{
    question: "What is the capital of Peru?",
    answer: "Lima",
    keywords: ["country", "capital", "Peru"],
    difficulty: "easy",
},
{
    question: "What is the capital of Tibet?",
    answer: "Lhasa",
    keywords: ["country", "capital", "Tibet"],
    difficulty: "easy",
},
{
    question: "What is the capital of India?",
    answer: "New Delhi",
    keywords: ["country", "capital", "India"],
    difficulty: "easy",
},
{
    question: "What is the capital of Venezuela",
    answer: "Caracas",
    keywords: ["country", "capital", "Venezuela"],
    difficulty: "easy",
},
{
    question: "What is the capital of Sweden?",
    answer: "Stockholm",
    keywords: ["country", "capital", "Sweden"],
    difficulty: "easy",
},
{
    question: "What is the capital of Norway?",
    answer: "Oslo",
    keywords: ["country", "capital", "Norway"],
    difficulty: "easy",
},
{
    question: "What is the capital of Germany?",
    answer: "Berlin",
    keywords: ["country", "capital", "Germany"],
    difficulty: "easy",
},
{
    question: "What is the capital of Argentina?",
    answer: "Buenos Aires",
    keywords: ["country", "capital", "Argentina"],
    difficulty: "medium",
},
{
    question: "What is the capital of Brazil?",
    answer: "Brasilia",
    keywords: ["country", "capital", "Brazil"],
    difficulty: "medium",
},
{
    question: "What is the capital of Colombia?",
    answer: "Bogota",
    keywords: ["country", "capital", "Colombia"],
    difficulty: "easy",
},
{
    question: "What is the capital of France?",
    answer: "Paris",
    keywords: ["country", "capital", "France"],
    difficulty: "easy",
},
{
    question: "What is the capital of Vietnam?",
    answer: "Hanoi",
    keywords: ["country", "capital", "Vietnam"],
    difficulty: "hard",
},
{
    question: "What is the capital of China?",
    answer: "Beijing",
    keywords: ["country", "capital", "China"],
    difficulty: "easy",
},
{
    question: "What is the capital of Russia?",
    answer: "Moscow",
    keywords: ["country", "capital", "Russia"],
    difficulty: "easy",
},
{
    question: "What is the capital of Greece?",
    answer: "Athens",
    keywords: ["country", "capital", "Greece"],
    difficulty: "easy",
},
{
    question: "What is the capital of Yemen?",
    answer: "Sanaa",
    keywords: ["country", "capital", "Yemen"],
    difficulty: "hard",
},
{
    question: "What is the capital of the United Kingdom?",
    answer: "London",
    keywords: ["country", "capital", "United Kingdom"],
    difficulty: "easy",
},
{
    question: "What is the capital of The Gambia?",
    answer: "Banjul",
    keywords: ["country", "capital", "The Gambia"],
    difficulty: "hard",
},
{
    question: "What is the capital of Australia?",
    answer: "Canberra",
    keywords: ["country", "capital", "Australia"],
    difficulty: "medium",
},
{
    question: "What is the capital of the Dominican Republic?",
    answer: "Santo Domingo",
    keywords: ["country", "capital", "Dominican Republic"],
    difficulty: "easy",
},
];

async function main() {
   await prisma.attempt.deleteMany();
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
            difficulty: question.difficulty,
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