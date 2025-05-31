const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Workspace = require('../models/workspaceModel');


exports.protect = async (req, res, next) => {
	try {
		// Token được gửi trong header Authorization theo định dạng: "Bearer <token>"
		const token = req.headers.authorization?.split(' ')[1];
		if (!token) {
			return res.status(401).json({ status: 'error', message: 'Unauthorized' });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET); // Giải mã và lấy thông tin liên quan tới người dùng trong token
		req.user = await User.findById(decoded._id).select(
			'role email createdAt description'
		); // Tìm user với role cụ thể để gán vào req.user, phục vụ cho việc phân quyền
		console.log('req.user', req.user);
		next();
	} catch (error) {
		res.status(401).json({ status: 'error', message: error.message });
	}
};

exports.isCreator = async (req, res, next) => {
	const { id } = req.params;
	const userId = req.user._id;

	const workspace = await Workspace.findById(id);
	if (!workspace) {
		return res
			.status(404)
			.json({ success: false, mes: 'Workspace không tồn tại' });
	}

	if (workspace.creator.toString() !== req.user._id.toString()) {
		return res
			.status(401)
			.json({ success: false, mes: 'REQUIRE CREATOR ROLE' });
	}

	req.workspace = workspace;
	next();
};

exports.isAdminWorkspace = async (req, res, next) => {
	const { id } = req.params;
	const userId = req.user._id;

	const workspace = await Workspace.findById(id).populate({
		path: 'members',
		model: 'Membership',
	});

	if (!workspace) {
		return res
			.status(404)
			.json({ success: false, mes: 'Workspace không tồn tại' });
	}

	const isCreator = workspace.creator.toString() === userId.toString();

	const member = workspace.members.find(
		(m) =>
			m.userId.toString() === userId.toString() && m.role === 'adminWorkspace'
	);

	if (!isCreator && !member) {
		return res.status(401).json({
			success: false,
			mes: 'REQUIRE ADMIN WORKSPACE ROLE OR CREATOR',
		});
	}

	req.workspace = workspace;
	next();
};
