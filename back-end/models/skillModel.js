const mongoose = require("mongoose");
const { Schema } = mongoose;

const skillSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    icon: {
      type: String,
      // required: true,
      trim: true,
    },
    tags: {
      type: [String],
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Skill", skillSchema);
