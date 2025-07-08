const express = require("express");
const router = express.Router({ mergeParams: true });
const skillController = require("../controllers/skillController");
const { protect } = require("../utils/auth");

// Get all skills (accessible to all users)
router.get("/", skillController.getAllSkills);

// Create a new skill (admin only)
router.post("/", protect, skillController.createSkill);

// Get a skill by ID (accessible to all users)
router.get("/:id", skillController.getSkillById);

// Update a skill by ID (admin only)
router.put("/:id", protect, skillController.updateSkill);

// Update a skill's icon by ID (admin only)
router.patch("/:id/icon", protect, skillController.updateSkillIcon);

// Delete a skill by ID (admin only)
router.delete("/:id", protect, skillController.deleteSkill);

module.exports = router;
