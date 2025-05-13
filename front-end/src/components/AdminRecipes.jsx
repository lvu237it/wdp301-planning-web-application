import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Table,
  Container,
  Image,
  Badge,
  Form,
  Row,
  Col,
  Button,
} from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import ReactPaginate from 'react-paginate';
import foodCategories from '../utils/FoodCategories'; // Import danh mục cứng
// import { debounce } from "lodash";
import { RiArrowGoBackLine } from 'react-icons/ri';

const statusMapping = {
  Pending_Approval: 'Chờ duyệt',
  Public: 'Công khai',
  Rejected: 'Từ chối',
  Private: 'Riêng tư',
};
const AdminRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchTitle, setSearchTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const limit = 5;
  const accessToken = localStorage.getItem('accessToken');
  const navigate = useNavigate();
  const [categories] = useState(foodCategories); // Danh mục cố định

  // Hàm gọi API lấy danh sách recipes
  const fetchRecipes = (page) => {
    console.log('Fetching with params:', {
      limit,
      page: page + 1,
      title: searchTitle || null,
      category: selectedCategory || null,
      status: selectedStatus || null,
    });

    axios
      .get(`http://localhost:3000/admin/recipes`, {
        params: {
          limit,
          page: page + 1,
          title: searchTitle || null,
          category: selectedCategory || null,
          status: selectedStatus || null,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((response) => {
        setRecipes(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
      })
      .catch((error) => console.error('Lỗi lấy dữ liệu:', error));
  };

  useEffect(() => {
    fetchRecipes(currentPage);
  }, [currentPage]);

  //Debounce tìm kiếm = setTimeout (chỉ gọi API sau 0.5s khi người dùng ngừng nhập)
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      fetchRecipes(0);
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchTitle, selectedCategory, selectedStatus]);

  //debound bằng thư viện lodash
  //   useEffect(() => {
  //   const debouncedFetch = debounce(() => {
  //     setCurrentPage(0); // Reset về trang đầu tiên
  //     fetchRecipes(0);
  //   }, 1000); // Chỉ gọi API sau 1s nếu không có thay đổi mới

  //   debouncedFetch();

  //   return () => debouncedFetch.cancel(); // Cleanup khi component unmount hoặc dependencies thay đổi
  // }, [searchTitle, selectedCategory, selectedStatus]);

  // Xử lý phân trang
  const handlePageClick = (event) => {
    setCurrentPage(event.selected);
  };

  return (
    <Container>
      <Link to={'/'}>
        <RiArrowGoBackLine
          title='Quay lại'
          className='ri-arrow-go-back-line-recipe-detail m-3'
          style={{
            position: 'absolute',
            top: 10,
            fontSize: 32,
            padding: 5,
            borderRadius: '99%',
            color: 'black',
          }}
        />
      </Link>
      <h1
        className='text-center my-4'
        style={{ fontFamily: 'Pacifico, cursive' }}
      >
        Danh sách công thức nấu ăn
      </h1>

      {/* Thanh tìm kiếm và bộ lọc */}
      <Row className='mb-3'>
        <Col md={4}>
          <Form.Control
            type='text'
            placeholder='Tìm theo tiêu đề...'
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value=''>Tất cả danh mục</option>
            {categories.map((category, index) => (
              <option key={index} value={category}>
                {category}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value=''>Tất cả trạng thái</option>
            <option value='Pending_Approval'>Chờ duyệt</option>
            <option value='Public'>Công khai</option>
            <option value='Rejected'>Từ chối</option>
            <option value='Private'>Riêng tư</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Button
            variant='secondary'
            onClick={() => {
              setSearchTitle('');
              setSelectedCategory('');
              setSelectedStatus('');
              handleSearch();
            }}
          >
            Xóa
          </Button>
        </Col>
      </Row>

      {/* Bảng danh sách món ăn */}
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>Thứ tự</th>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>Hình ảnh</th>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>Tiêu đề</th>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>Danh mục</th>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>Người tạo</th>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>
              Trạng thái
            </th>
            <th style={{ backgroundColor: 'rgb(252, 196, 196)' }}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {recipes.length > 0 ? (
            recipes.map((recipe, index) => (
              <tr key={recipe.id || recipe._id}>
                <td>{index + 1 + currentPage * limit}</td>
                <td>
                  <Image
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    width={100}
                    height={100}
                    rounded
                  />
                </td>
                <td>{recipe.title}</td>
                <td>
                  {recipe.foodCategories?.join(', ') || 'Không có danh mục'}
                </td>
                <td>{recipe.owner?.username || 'Unknown'}</td>
                <td>
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
                  >
                    {statusMapping[recipe.status]}
                  </Badge>
                </td>
                <td>
                  <Button
                    variant='info'
                    onClick={() => navigate(`/admin/recipes/${recipe._id}`)}
                  >
                    Xem chi tiết
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan='7' className='text-center text-muted'>
                Không có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Phân trang */}
      <div className='d-flex justify-content-center'>
        <ReactPaginate
          previousLabel={'← Trước'}
          nextLabel={'Tiếp →'}
          breakLabel={'...'}
          pageCount={totalPages}
          marginPagesDisplayed={2}
          pageRangeDisplayed={3}
          onPageChange={handlePageClick}
          containerClassName={'pagination'}
          activeClassName={'active'}
          pageClassName={'page-item'}
          pageLinkClassName={'page-link'}
          previousClassName={'page-item'}
          previousLinkClassName={'page-link'}
          nextClassName={'page-item'}
          nextLinkClassName={'page-link'}
          breakClassName={'page-item'}
          breakLinkClassName={'page-link'}
        />
      </div>
    </Container>
  );
};

export default AdminRecipes;
