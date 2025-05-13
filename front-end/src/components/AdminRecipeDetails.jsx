import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Card,
  Image,
  Badge,
  Button,
  Row,
  Col,
  ListGroup,
} from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const statusMapping = {
  Pending_Approval: 'Chờ duyệt',
  Public: 'Công khai',
  Rejected: 'Từ chối',
  Private: 'Riêng tư',
};

const AdminRecipeDetails = () => {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [comments, setComments] = useState([]);
  const accessToken = localStorage.getItem('accessToken');

  useEffect(() => {
    axios
      .get(`http://localhost:3000/admin/recipes/${recipeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((response) => setRecipe(response.data.data))
      .catch((error) => console.error('Lỗi lấy chi tiết món ăn:', error));
    axios
      .get(`http://localhost:3000/admin/recipes/${recipeId}/comments`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((response) => setComments(response.data))
      .catch((error) => console.error('Lỗi lấy bình luận:', error));
  }, [recipeId]);
  console.log(comments);

  if (!recipe) return <p className='text-center'>Đang tải...</p>;

  // Hàm cập nhật trạng thái công thức nấu ăn
  const handleUpdateStatus = async (newStatus) => {
    try {
      await axios.patch(
        `http://localhost:3000/admin/recipes/${recipeId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setRecipe((prev) => ({ ...prev, status: newStatus })); // Cập nhật UI
      toast.success(
        `Cập nhật trạng thái thành công: ${statusMapping[newStatus]}`
      );
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái:', error);
      toast.error('Cập nhật trạng thái thất bại!');
    }
  };

  const handleSoftDeleteComment = async (recipeId, commentId) => {
    try {
      await axios.patch(
        `http://localhost:3000/admin/recipes/${recipeId}/delete-comment/${commentId}`,
        { isDeleted: true }, // Sửa 'true' thành true (boolean)
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      // Cập nhật lại danh sách bình luận ngay lập tức
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment._id === commentId ? { ...comment, isDeleted: true } : comment
        )
      );
      toast.success('Bình luận đã được ẩn!');
    } catch (error) {
      console.error('Lỗi khi xóa mềm bình luận:', error);
      toast.error('Không thể ẩn bình luận.');
    }
  };

  return (
    <Container className='mt-4'>
      <ToastContainer position='top-right' autoClose={3000} />
      {/* Nút quay lại */}
      <Button variant='secondary' onClick={() => navigate(-1)} className='mb-3'>
        ← Quay lại
      </Button>

      <Card className='shadow-lg p-4'>
        <Row>
          <Col md={4} className='text-center'>
            <Image src={recipe.imageUrl} alt={recipe.title} fluid rounded />
          </Col>

          <Col md={8}>
            <h2 className='fw-bold text-success'>{recipe.title}</h2>
            <p className='text-muted'>{recipe.description}</p>
            <Badge
              bg={
                recipe.status === 'Pending_Approval'
                  ? 'primary'
                  : recipe.status === 'Public'
                  ? 'success'
                  : recipe.status === 'Rejected'
                  ? 'danger'
                  : 'secondary'
              }
              className='mb-2'
            >
              {statusMapping[recipe.status]}
            </Badge>
            <p>
              <strong>Người tạo:</strong> {recipe.owner?.username || 'Unknown'}
            </p>
            <p>
              <strong>Danh mục:</strong> {recipe.foodCategories.join(', ')}
            </p>

            {/* Nút Duyệt và Từ Chối */}

            <div className='mt-3'>
              <Button
                variant='success'
                className='me-2'
                onClick={() => handleUpdateStatus('Public')}
              >
                Duyệt công thức
              </Button>

              <Button
                variant='danger'
                onClick={() => handleUpdateStatus('Rejected')}
              >
                Từ chối duyệt công thức
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Nguyên liệu & Cách chế biến */}
      <Row className='mt-4'>
        <Col md={4}>
          <Card className='p-3 shadow-sm bg-light'>
            <h5 className='text-success'>Nguyên liệu</h5>
            <ListGroup>
              {recipe.ingredients.map((ingredient, index) => (
                <ListGroup.Item key={index}>{ingredient}</ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>

        <Col md={8}>
          <Card className='p-3 shadow-sm'>
            <h5 className='text-success'>Cách chế biến</h5>
            <ListGroup numbered>
              {recipe.steps.map((step, index) => (
                <ListGroup.Item key={index}>{step.description}</ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </Col>
      </Row>
      <Card className='mt-4 p-3 shadow-sm'>
        <h5 className='text-success'>Bình luận</h5>
        {comments.length === 0 ? (
          <p className='text-muted'>Chưa có bình luận nào.</p>
        ) : (
          <ListGroup>
            {comments.map((comment) => (
              <ListGroup.Item
                key={comment.id}
                className='d-flex justify-content-between align-items-center'
              >
                <div>
                  <strong>{comment.user?.username}</strong>
                  {comment.isDeleted && (
                    <span className='text-danger'> (Đã xóa)</span>
                  )}
                  : {comment.content}
                </div>

                {!comment.isDeleted && (
                  <Button
                    variant='danger'
                    size='sm'
                    onClick={() =>
                      handleSoftDeleteComment(recipeId, comment._id)
                    }
                  >
                    Xóa
                  </Button>
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card>
    </Container>
  );
};

export default AdminRecipeDetails;
