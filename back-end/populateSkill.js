const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const Skill = require("./models/skillModel");

dotenv.config({
  //việc đọc các biến môi trường từ file .env xảy ra duy
  //1 lần, sau đó nó nằm trong process và có thể truy cập ở tất cả mọi nơi
  path: "./.env",
});

// Read skills data from JSON file
const skills = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "skills.json"), "utf-8")
);

// Connect to MongoDB using the same connection method as index.js
const DB = process.env.DATABASE_URI;

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("DB connection successful");
    console.log("📌 Database in use:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });

// Populate skills
const populateSkills = async () => {
  try {
    // Clear existing skills
    await Skill.deleteMany();
    console.log("Existing skills deleted");

    // Insert new skills
    await Skill.insertMany(skills);
    console.log("Skills successfully populated");

    // Close the database connection
    mongoose.connection.close();
    console.log("Database connection closed");
  } catch (err) {
    console.error("Error populating skills:", err);
    if (err.code === 11000) {
      console.error(
        "Duplicate key error: ensure name, value, and label are unique"
      );
    }
    mongoose.connection.close();
    process.exit(1);
  }
};

// Handle uncaught exceptions and unhandled rejections (as in index.js)
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.name, err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.name, err.message);
  mongoose.connection.close(() => {
    process.exit(1);
  });
});

// Run the population script
populateSkills();
