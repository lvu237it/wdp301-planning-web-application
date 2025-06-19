const Skill = require('../models/skillModel');

exports.getAllSkills = async (req, res) => {
  try {
    const skills = await Skill.find().sort({ label: 1 }); // sắp xếp theo label tăng dần
    res.status(200).json({ skills });
  } catch (err) {
    console.error('Lỗi when fetching skills:', err);
    res.status(500).json({
      message: 'Server error khi lấy danh sách skills',
      error: err.message
    });
  }
};
