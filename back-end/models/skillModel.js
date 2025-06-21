const mongoose = require('mongoose');
const { Schema } = mongoose;

const skillSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Skill', skillSchema);
