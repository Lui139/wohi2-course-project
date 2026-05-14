const app = require("./app");
const prisma = require("./lib/prisma");
const logger = require("./lib/logger");
//const pinoHttp = require("pino-http");

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server is running on http://localhost:${PORT}");
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);


//app.use(pinoHttp({
//  logger,
//  autologging: {ignore: (req) => req.url.startsWith("/uploads") },
//}));

// Start the server
//app.listen(PORT, () => {
//  logger.info({ port: PORT }, 'Server listening');
//});

// Graceful shutdown
//process.on("SIGINT", async () => {
//  await prisma.$disconnect();
//  process.exit(0);
//});

//process.on("SIGTERM", async () => {
//  await prisma.$disconnect();
//  process.exit(0);
//});

