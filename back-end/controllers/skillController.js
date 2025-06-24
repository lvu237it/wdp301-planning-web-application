const Skill = require("../models/skillModel");
const AppError = require("../utils/appError"); // Assuming AppError is defined in a utils folder

// Get all skills (accessible to all users)
exports.getAllSkills = async (req, res) => {
  try {
    const skills = await Skill.find().sort({ label: 1 }); // Sort by label in ascending order
    res.status(200).json({
      status: "success",
      data: { skills },
    });
  } catch (err) {
    console.error("Error fetching skills:", err);
    res.status(500).json({
      status: "error",
      message: "Server error while retrieving skills",
      error: err.message,
    });
  }
};

// Get a skill by ID (accessible to all users)
exports.getSkillById = async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      return next(new AppError("Skill not found.", 404));
    }
    res.status(200).json({
      status: "success",
      data: { skill },
    });
  } catch (err) {
    console.error("Error fetching skill:", err);
    res.status(500).json({
      status: "error",
      message: "Server error while retrieving skill",
      error: err.message,
    });
  }
};

// Create a new skill (admin only)
exports.createSkill = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const { name, icon, tags, value, label } = req.body;

    // Validate required fields (icon can be missing)
    if (!name || !tags || !value || !label) {
      return next(
        new AppError("All fields (name, tags, value, label) are required.", 400)
      );
    }

    // Create new skill
    const newSkill = await Skill.create({ name, icon, tags, value, label });

    res.status(201).json({
      status: "success",
      data: { skill: newSkill },
    });
  } catch (err) {
    console.error("Error creating skill:", err);
    if (err.code === 11000) {
      return next(
        new AppError(
          "Duplicate field value (name, value, or label must be unique).",
          400
        )
      );
    }
    res.status(500).json({
      status: "error",
      message: "Server error while creating skill",
      error: err.message,
    });
  }
};

// Update a skill (admin only)
exports.updateSkill = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const { id } = req.params;
    const { name, icon, tags, value, label } = req.body;

    // Find and update skill
    const updatedSkill = await Skill.findByIdAndUpdate(
      id,
      { name, icon, tags, value, label },
      { new: true, runValidators: true }
    );

    if (!updatedSkill) {
      return next(new AppError("Skill not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: { skill: updatedSkill },
    });
  } catch (err) {
    console.error("Error updating skill:", err);
    if (err.code === 11000) {
      return next(
        new AppError(
          "Duplicate field value (name, value, or label must be unique).",
          400
        )
      );
    }
    res.status(500).json({
      status: "error",
      message: "Server error while updating skill",
      error: err.message,
    });
  }
};

// Update a skill's icon (admin only)
exports.updateSkillIcon = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const { id } = req.params;
    const { icon } = req.body;

    // Validate icon field
    if (!icon) {
      return next(new AppError("Icon field is required.", 400));
    }

    // Find and update skill's icon
    const updatedSkill = await Skill.findByIdAndUpdate(
      id,
      { icon },
      { new: true, runValidators: true }
    );

    if (!updatedSkill) {
      return next(new AppError("Skill not found.", 404));
    }

    res.status(200).json({
      status: "success",
      data: { skill: updatedSkill },
    });
  } catch (err) {
    console.error("Error updating skill icon:", err);
    res.status(500).json({
      status: "error",
      message: "Server error while updating skill icon",
      error: err.message,
    });
  }
};

// Delete a skill (admin only)
exports.deleteSkill = async (req, res, next) => {
  try {
    // Check if user is admin
    if (req.user.role !== "adminSystem") {
      return next(new AppError("Admin access required.", 403));
    }

    const { id } = req.params;

    // Find and delete skill
    const deletedSkill = await Skill.findByIdAndDelete(id);

    if (!deletedSkill) {
      return next(new AppError("Skill not found.", 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    console.error("Error deleting skill:", err);
    res.status(500).json({
      status: "error",
      message: "Server error while deleting skill",
      error: err.message,
    });
  }
};
