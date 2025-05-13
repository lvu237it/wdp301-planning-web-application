const Comment = require("../models/commentModel");
const User = require("../models/userModel");
const Recipe = require("../models/recipeModel");
const mongoose = require("mongoose");

// Helper functions
const isValidObjectId = async (id) => mongoose.Types.ObjectId.isValid(id);

const isValidUser = async (userId) => {
  const user = await User.findById(userId);
  return user && !user.isDeleted;
};

const isAdmin = async (userId) => {
  const user = await User.find({ _id: userId, role: "admin" });
  console.log(user);
  return user;
};

const isValidRecipe = async (recipeId) => {
  const recipe = await Recipe.findById(recipeId);
  return recipe && !recipe.isDeleted;
};

const isValidComment = async (commentId) => {
  const comment = await Comment.findById(commentId);
  return comment && !comment.isDeleted;
};

const isCommentMadeByUser = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  return comment && comment.user == userId;
};

module.exports = {
  isValidObjectId,
  isValidUser,
  isAdmin,
  isValidRecipe,
  isValidComment,
  isCommentMadeByUser,
};
