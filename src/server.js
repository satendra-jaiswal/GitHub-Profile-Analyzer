require("dotenv").config();
const app = require("./app");
const { testConnection } = require("./config/database");

const PORT = process.env.PORT || 3000;

const start = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀 GitHub Profile Analyzer running on port ${PORT}`);
    console.log(`📖 API docs: http://localhost:${PORT}`);
    console.log(`❤️  Health: http://localhost:${PORT}/health\n`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
