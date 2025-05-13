//Không cần viết thêm adminModel mà sử dụng trực tiếp userModel với role là admin - kiểm tra role của user có phải admin không, và thực hiện tác vụ cần thiết
const Recipe = require('../models/recipeModel');
const Comment = require('../models/commentModel');

//get all recipes for admin role
exports.getAllRecipe = async (req, res) => {
  try {
    console.log('Received query params:', req.query);

    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admins only!',
      });
    }

    const { page = 1, limit = 10, title, category, status } = req.query;
    let filter = {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' }; // Tìm kiếm không phân biệt hoa thường
    }
    if (category) {
      filter.foodCategories = category; // Giả sử category lưu trong `foodCategories`
    }
    if (status) {
      filter.status = status;
    }

    console.log('Query Filter:', filter);

    const recipes = await Recipe.find(filter)
      .select(
        'title foodCategories description createdAt owner status imageUrl'
      )
      .populate('owner', 'username email')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalRecipes = await Recipe.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: recipes.length,
      totalRecipes,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalRecipes / limit),
      data: recipes,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

//get recipe details admin role
exports.getRecipeDetails = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (!req.user || req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ status: 'error', message: 'Access denied. Admins only!' });
    }

    const { recipeId } = req.params;
    const recipe = await Recipe.findById(recipeId).populate(
      'owner',
      'username email'
    );
    if (!recipe) {
      return res
        .status(404)
        .json({ status: 'error', message: 'Recipe not found' });
    }

    res.status(200).json({
      status: 'success',
      data: recipe,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// approve/reject recipe post
exports.updateRecipeStatus = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (!req.user || req.user.role !== 'admin') {
      return res
        .status(403)
        .json({ status: 'error', message: 'Access denied. Admins only!' });
    }

    const { recipeId } = req.params;
    const { status } = req.body; // Nhận trạng thái từ body (approved / rejected)

    if (!['Public', 'Rejected'].includes(status)) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Invalid status' });
    }

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res
        .status(404)
        .json({ status: 'error', message: 'Recipe not found' });
    }

    // Cập nhật trạng thái
    recipe.status = status;
    await recipe.save();

    res.status(200).json({
      status: 'success',
      message: `Recipe ${status} successfully`,
      data: recipe,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

//delete comment isDelete = true
exports.deleteCommentByAdmin = async (req, res) => {
  try {
    const { commentId } = req.params;

    // Kiểm tra xem comment có tồn tại không
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment không tồn tại' });
    }

    // Cập nhật isDeleted = true để xóa mềm
    await Comment.findByIdAndUpdate(
      commentId,
      { isDeleted: true },
      { new: true }
    );

    res.status(200).json({ message: 'Xóa mềm comment thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
