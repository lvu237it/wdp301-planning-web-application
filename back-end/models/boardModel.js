const mongoose = require('mongoose');
// Quản lý bảng công việc
const boardSchema = new mongoose.Schema(
	{
		name: { type: String, required: [true, 'Tên board là bắt buộc'] },
		description: { type: String },
		creator: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'Người tạo board là bắt buộc'],
		},
		workspaceId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Workspace',
			required: true,
		},
		calendarId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Calendar',
		},
		backgroundColor: { type: String, default: '#ffffff' },
		backgroundImage: { type: String },
		lists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'List' }],
		criteria: {
			skills: [
				{
					type: String,
					trim: true,
					lowercase: true,
					required: [true, 'kĩ năng là bắt buộc'],
				},
			],
			yearOfExperience: {
				min: {
					type: Number,
					min: [0, 'Năm kinh nghiệm tối thiểu không thể nhỏ hơn 0'],
					default: 0,
					required: [true, 'Năm kinh nghiệm tối thiểu là bắt buộc'],
				},
				max: {
					type: Number,
					min: [0, 'Năm kinh nghiệm tối đa không thể nhỏ hơn 0'],
					default: 0,
					required: [true, 'Năm kinh nghiệm tối đa là bắt buộc'],
				},
			},
			workDuration: {
				startDate: { type: Date, required: true },
				endDate: { type: Date, required: true },
			},
		},
		visibility: {
			type: String,
			enum: ['public', 'private'],
			default: 'public',
			required: true,
		},
		isDeleted: { type: Boolean, default: false },
		deletedAt: { type: Date },
	},
	{
		timestamps: true,
	}
);

boardSchema.index({ creator: 1 });
boardSchema.index({ workspaceId: 1 });
boardSchema.index({ calendarId: 1 });
boardSchema.index({ 'criteria.skills': 1 });
boardSchema.index({ 'criteria.yearOfExperience.min': 1 });
boardSchema.index({ 'criteria.workDuration.min': 1 });

module.exports = mongoose.model('Board', boardSchema);
