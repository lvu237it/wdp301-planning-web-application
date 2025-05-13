import { useState, useEffect } from 'react';
import { useCommon } from '../contexts/CommonContext';
import {
  FaEdit,
  FaUser,
  FaSave,
  FaTimes,
  FaEye,
  FaTrash,
  FaLock,
  FaGlobe,
  FaClock,
  FaExclamationTriangle,
} from 'react-icons/fa';
import {
  Button,
  Form,
  Card,
  Container,
  Row,
  Col,
  Image,
  Tabs,
  Tab,
  Spinner,
  Badge,
  ListGroup,
  Alert,
  Modal,
  InputGroup,
} from 'react-bootstrap';
import { DateTime } from 'luxon';
import { BiPencil, BiImageAdd } from 'react-icons/bi';
import { Link, useNavigate } from 'react-router-dom';
import { RiArrowGoBackLine } from 'react-icons/ri';
import axios from 'axios';

function UserProfile() {
  const {
    recipes,
    setRecipes,
    selectedCategory,
    setSelectedCategory,
    filteredRecipes,
    setFilteredRecipes,
    listOfCategories,
    sortOrder,
    setSortOrder,
    Toaster,
    toast,
    navigate,
    handleSaveRecipe,
    handleUnsaveRecipe,
    handleSaveToggle,
    savedRecipeIds,
    setSavedRecipeIds,
    openOptionsRecipeDetailModal,
    setOpenOptionsRecipeDetailModal,
    currentPage,
    setCurrentPage,
    totalPages,
    searchRecipeInput,
    setSearchRecipeInput,
    // isLoading,
    handlePageChange,
    itemsPerPage,
    savedRecipes,
    setSavedRecipes,
    userDataLocal,
    setUserDataLocal,
    accessToken,
    communityChefsList,
    setCommunityChefsList,
    recipeChefList,
    setRecipeChefList,
    recipeListByUserId,
    setRecipeListByUserId,
    showCreateRecipeModal,
    setShowCreateRecipeModal,
    handleCancelCreateRecipe,
    previewImageRecipeUrl,
    setPreviewImageRecipeUrl,
    inputFoodCategory,
    setInputFoodCategory,
    inputRecipeName,
    setInputRecipeName,
    inputRecipeDescription,
    setInputRecipeDescription,
    foodCategoriesListForNewRecipe,
    setFoodCategoriesListForNewRecipe,
    inputIngredient,
    setInputIngredient,
    ingredientsListForNewRecipe,
    setIngredientsListForNewRecipe,
    inputStep,
    setInputStep,
    stepsListForNewRecipe,
    setStepsListForNewRecipe,
    inputSource,
    setInputSource,
    sourcesListForNewRecipe,
    setSourcesListForNewRecipe,
    handleClickAddImageIcon,
    handleFileChange,
    handlePostRecipe,
    imageRecipe,
    setImageRecipe,
    uploadImageToCloudinary,
  } = useCommon();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    description: '',
    avatar: '',
  });
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (userDataLocal) {
      setFormData({
        username: userDataLocal.username || '',
        email: userDataLocal.email || '',
        password: '',
        description: userDataLocal.description || '',
        avatar: userDataLocal.avatar || '',
      });
    }
  }, [userDataLocal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Bạn chưa nhập tên/biệt danh';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Bạn chưa nhập email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải chứa ít nhất 6 kí tự';
    }

    if (formData.password && formData.password !== passwordConfirm) {
      newErrors.passwordConfirm = 'Mật khẩu không đúng';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Chỉ gửi password nếu có thay đổi
      const updateData = {
        username: formData.username,
        email: formData.email,
        description: formData.description,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await axios.patch(
        `http://localhost:3000/users/${userDataLocal._id}/edit-information`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Kiểm tra phản hồi
      if (response.status !== 200) {
        throw new Error(response.data.message || 'Cập nhật thất bại');
      }

      // Dữ liệu mới sau khi cập nhật
      const updatedUserData = {
        ...userDataLocal,
        ...updateData,
        password: undefined, // Không lưu password
      };

      // Cập nhật dữ liệu người dùng trong state
      setUserDataLocal(updatedUserData);

      // Lưu vào localStorage
      localStorage.setItem('userData', JSON.stringify(updatedUserData));

      toast.success('Thông tin tài khoản đã được cập nhật!');

      // Reset form
      setIsEditing(false);
      setFormData({
        ...formData,
        password: '',
      });
      setPasswordConfirm('');
    } catch (error) {
      toast({
        title: 'Lỗi',
        description:
          error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Here you would typically upload the file to your server or a storage service
    // For now, we'll just create a local URL for preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({
        ...formData,
        avatar: reader.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    // Reset form data to current user data
    if (userDataLocal) {
      setFormData({
        username: userDataLocal.username || '',
        email: userDataLocal.email || '',
        password: '',
        description: userDataLocal.description || '',
        avatar: userDataLocal.avatar || '',
      });
    }
    setPasswordConfirm('');
    setErrors({});
  };

  const handleViewRecipe = (slug) => {
    navigate(`/recipe-details/${slug}`);
  };

  const handleEditRecipe = (slug) => {
    navigate(`/recipes/edit/${slug}`);
  };

  const handleDeleteRecipe = async (recipeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa công thức này không?')) {
      return;
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete recipe');
      }

      // Remove the deleted recipe from the list
      setRecipeListByUserId(
        recipeListByUserId.filter((recipe) => recipe._id !== recipeId)
      );

      toast({
        title: 'Success',
        description: 'Recipe deleted successfully',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete recipe',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Public':
        return (
          <Badge bg='success'>
            <FaGlobe className='me-1' /> Công khai
          </Badge>
        );
      case 'Private':
        return (
          <Badge bg='secondary'>
            <FaLock className='me-1' /> Riêng tư
          </Badge>
        );
      case 'Pending_Approval':
        return (
          <Badge bg='warning' text='dark'>
            <FaClock className='me-1' /> Chờ duyệt
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge bg='danger'>
            <FaExclamationTriangle className='me-1' /> Từ chối
          </Badge>
        );
      default:
        return <Badge bg='info'>{status}</Badge>;
    }
  };

  const formatCategories = (categories) => {
    if (!categories || categories.length === 0) return 'Không có';

    return categories.map((category, index) => (
      <Badge bg='info' className='me-1 mb-1' key={index}>
        {category}
      </Badge>
    ));
  };

  if (!userDataLocal) {
    return (
      <Container
        className='d-flex align-items-center justify-content-center'
        style={{ minHeight: '400px' }}
      >
        <p>Hãy đăng nhập để xem hồ sơ này.</p>
      </Container>
    );
  }

  return (
    <>
      <Link to={'/'} style={{ position: 'absolute', top: -15, left: 5 }}>
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
      <Container
        className='py-4 my-5'
        style={{
          height: 'auto',
        }}
      >
        <Toaster richColors />

        <BiPencil
          title='Chia sẻ công thức'
          onClick={() => setShowCreateRecipeModal(true)}
          className='icon-add-recipe-bi-plus-pencil'
        />
        {/* Modal for creating new recipe */}
        <Modal show={showCreateRecipeModal} onHide={handleCancelCreateRecipe}>
          <Modal.Header closeButton>
            <Modal.Title>Chia sẻ công thức nấu ăn</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className='' style={{ width: '100%' }}>
              {/* Details information for recipe */}
              <Form>
                {/* food categories */}
                <Form.Group>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Loại món ăn (<span style={{ color: 'red' }}>*</span>)
                  </Form.Label>
                </Form.Group>

                <Form.Select
                  className='mb-3'
                  value={
                    foodCategoriesListForNewRecipe.length === 0
                      ? 'Chọn loại món ăn'
                      : inputFoodCategory
                  }
                  onChange={(e) => {
                    const selectedCategory = e.target.value;

                    // Kiểm tra xem có phải giá trị mặc định không
                    if (selectedCategory !== '') {
                      setInputFoodCategory(selectedCategory);

                      // Kiểm tra xem category có nằm trong danh sách chưa
                      if (
                        !foodCategoriesListForNewRecipe.includes(
                          selectedCategory
                        )
                      ) {
                        setFoodCategoriesListForNewRecipe((prevCategories) => {
                          return [...prevCategories, selectedCategory]; // Thêm category vào danh sách
                        });
                      }
                    }
                  }}
                >
                  {foodCategoriesListForNewRecipe.length === 0 && (
                    <option value=''>Chọn loại món ăn</option>
                  )}
                  {listOfCategories.map((category, index) => (
                    <option key={index} value={category}>
                      {category}
                    </option>
                  ))}
                </Form.Select>

                <Form.Group className=''>
                  {/* List of food categories */}
                  {foodCategoriesListForNewRecipe.length > 0 &&
                    foodCategoriesListForNewRecipe.map(
                      (foodCategory, index) => (
                        <InputGroup
                          key={index}
                          style={{ margin: '10px 0' }}
                          className=''
                        >
                          <Form.Control
                            className=''
                            style={{ width: '75%' }}
                            value={foodCategory}
                            disabled
                          />

                          <Button
                            variant='danger'
                            onClick={() => {
                              setFoodCategoriesListForNewRecipe(
                                (prevCategories) =>
                                  prevCategories.filter(
                                    (c) => c !== foodCategory
                                  )
                              );
                            }}
                          >
                            Xoá
                          </Button>
                        </InputGroup>
                      )
                    )}
                </Form.Group>

                {/* title - food's name */}
                <Form.Group className='mb-3'>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Tên món ăn (<span style={{ color: 'red' }}>*</span>)
                  </Form.Label>
                  <Form.Control
                    type='text'
                    value={inputRecipeName}
                    onChange={(e) => setInputRecipeName(e.target.value)}
                  />
                </Form.Group>

                {/* food description */}
                <Form.Group className='mb-3'>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Mô tả (<span style={{ color: 'red' }}>*</span>)
                  </Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={3}
                    value={inputRecipeDescription}
                    onChange={(e) => setInputRecipeDescription(e.target.value)}
                  />
                </Form.Group>
                {/* ingredients */}
                <Form.Group className=''>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Nguyên liệu (<span style={{ color: 'red' }}>*</span>)
                  </Form.Label>
                  <InputGroup style={{}} className='mb-3'>
                    <Form.Control
                      value={inputIngredient}
                      onChange={(e) => setInputIngredient(e.target.value)}
                      placeholder='Các nguyên liệu cần có...'
                    />
                    <Button
                      variant='success'
                      onClick={() => {
                        if (
                          inputIngredient &&
                          !ingredientsListForNewRecipe.includes(inputIngredient)
                        ) {
                          setIngredientsListForNewRecipe([
                            ...ingredientsListForNewRecipe,
                            inputIngredient,
                          ]);
                        }

                        setInputIngredient('');
                      }}
                    >
                      Thêm
                    </Button>
                  </InputGroup>

                  {/* List of ingredients */}
                  {ingredientsListForNewRecipe.length > 0 &&
                    ingredientsListForNewRecipe.map((ingredient, index) => (
                      <InputGroup
                        key={index}
                        style={{ margin: '10px 0' }}
                        className=''
                      >
                        <Form.Control
                          className=''
                          style={{ width: '75%' }}
                          value={ingredient}
                          disabled
                        />
                        <Button
                          variant='danger'
                          onClick={() => {
                            setIngredientsListForNewRecipe((preIngredients) =>
                              preIngredients.filter(
                                (ingredientCurrent) =>
                                  ingredientCurrent !== ingredient
                              )
                            );
                          }}
                        >
                          Xoá
                        </Button>
                      </InputGroup>
                    ))}
                </Form.Group>

                {/* steps for recipe */}
                <Form.Group className=''>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Các bước thực hiện (<span style={{ color: 'red' }}>*</span>)
                  </Form.Label>
                  <InputGroup style={{}} className='mb-3'>
                    <Form.Control
                      value={inputStep}
                      onChange={(e) => setInputStep(e.target.value)}
                      placeholder='Mô tả chi tiết cách thực hiện...'
                    />
                    <Button
                      variant='success'
                      onClick={() => {
                        if (
                          inputStep.trim() &&
                          !stepsListForNewRecipe.some(
                            (step) => step.description === inputStep.trim()
                          )
                        ) {
                          setStepsListForNewRecipe([
                            ...stepsListForNewRecipe,
                            {
                              stepNumber: stepsListForNewRecipe.length + 1,
                              description: inputStep,
                            },
                          ]);
                        }

                        setInputStep('');
                      }}
                    >
                      Thêm
                    </Button>
                  </InputGroup>

                  {/* List of steps */}
                  {stepsListForNewRecipe.length > 0 &&
                    stepsListForNewRecipe.map((step, index) => (
                      <InputGroup key={index} style={{ margin: '10px 0' }}>
                        <Button variant='secondary'>{step.stepNumber}</Button>

                        <Form.Control
                          style={{ width: '75%' }}
                          value={step.description}
                          disabled
                        />
                        <Button
                          variant='danger'
                          onClick={() => {
                            setStepsListForNewRecipe(
                              (prevSteps) =>
                                prevSteps
                                  .filter(
                                    (prestep) =>
                                      prestep.stepNumber !== step.stepNumber
                                  ) // Xóa bước
                                  .map((prestep, index) => ({
                                    ...prestep,
                                    stepNumber: index + 1,
                                  })) // Cập nhật lại stepNumber
                            );
                          }}
                        >
                          Xoá
                        </Button>
                      </InputGroup>
                    ))}
                </Form.Group>

                {/* references - documents */}
                <Form.Group className=''>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Tài liệu tham khảo (không bắt buộc)
                  </Form.Label>

                  <InputGroup style={{}} className='mb-3'>
                    <Form.Control
                      value={inputSource}
                      onChange={(e) => setInputSource(e.target.value)}
                      type='text'
                      placeholder='Bất kì tài liệu chi tiết, hoặc liên kết...v.v'
                    />

                    <Button
                      variant='success'
                      onClick={() => {
                        if (
                          inputSource &&
                          !sourcesListForNewRecipe.includes(inputSource)
                        ) {
                          setSourcesListForNewRecipe([
                            ...sourcesListForNewRecipe,
                            inputSource,
                          ]);
                        }

                        setInputSource('');
                      }}
                    >
                      Thêm
                    </Button>
                  </InputGroup>

                  {/* List of sources */}
                  {sourcesListForNewRecipe.length > 0 &&
                    sourcesListForNewRecipe.map((source, index) => (
                      <InputGroup
                        key={index}
                        style={{ margin: '10px 0' }}
                        className=''
                      >
                        <Form.Control
                          className=''
                          style={{ width: '75%' }}
                          value={source}
                          disabled
                        />
                        <Button
                          variant='danger'
                          onClick={() => {
                            setSourcesListForNewRecipe((preSources) =>
                              preSources.filter(
                                (sourceCurrent) => sourceCurrent !== source
                              )
                            );
                          }}
                        >
                          Xoá
                        </Button>
                      </InputGroup>
                    ))}
                </Form.Group>

                <Form.Group className=''>
                  <Form.Label style={{ fontWeight: 'bolder' }}>
                    Ảnh món ăn (<span style={{ color: 'red' }}>*</span>)
                  </Form.Label>
                </Form.Group>
              </Form>
              {/* Image for recipe */}
              <img
                style={{
                  width: '100%',
                  borderRadius: '5px',
                  display: `${previewImageRecipeUrl ? 'block' : 'none'}`,
                }}
                src={previewImageRecipeUrl}
                className=''
                alt={'preview-image-recipe'}
              />
            </div>
            <div>
              <BiImageAdd
                title='Chọn ảnh'
                style={{
                  fontSize: 26,
                  marginTop: '10px',
                  cursor: 'pointer',
                }}
                onClick={handleClickAddImageIcon}
              />
            </div>
            <input
              id='bi-attachment-add'
              hidden
              accept='image/jpeg,image/png,video/mp4,video/quicktime'
              type='file'
              multiple
              onChange={(e) => handleFileChange(e)}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant='secondary' onClick={handleCancelCreateRecipe}>
              Huỷ
            </Button>
            <Button variant='success' onClick={() => handlePostRecipe()}>
              Lưu
            </Button>
          </Modal.Footer>
        </Modal>

        <Tabs defaultActiveKey='profile' className='mb-4'>
          <Tab eventKey='profile' title='Hồ sơ'>
            <Card>
              <Card.Header className='d-flex justify-content-between align-items-center'>
                <div>
                  <Card.Title>Thông tin cá nhân</Card.Title>
                  <Card.Subtitle className='text-muted'>
                    Quản lý thông tin cá nhân của bạn
                  </Card.Subtitle>
                </div>
                {!isEditing ? (
                  <Button
                    variant='outline-primary'
                    size='sm'
                    onClick={() => setIsEditing(true)}
                  >
                    <FaEdit className='me-2' />
                    Chỉnh sửa
                  </Button>
                ) : (
                  <Button
                    variant='outline-secondary'
                    size='sm'
                    onClick={cancelEdit}
                  >
                    <FaTimes className='me-2' />
                    Huỷ
                  </Button>
                )}
              </Card.Header>

              <Card.Body>
                <Form>
                  <Row>
                    {/* Avatar Section */}
                    <Col md={4} className='text-center mb-4 mb-md-0'>
                      <div className='d-flex flex-column align-items-center'>
                        <div className='position-relative mb-3'>
                          {formData.avatar ? (
                            <Image
                              src={formData.avatar || '/placeholder.svg'}
                              alt={formData.username}
                              roundedCircle
                              style={{
                                width: '128px',
                                height: '128px',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              className='bg-light d-flex align-items-center justify-content-center rounded-circle'
                              style={{ width: '128px', height: '128px' }}
                            >
                              <FaUser size={48} />
                            </div>
                          )}
                        </div>

                        {/* {isEditing && (
                          <div className='mb-3'>
                            <Form.Label
                              htmlFor='avatar'
                              className='text-primary'
                              style={{ cursor: 'pointer' }}
                            >
                              Cập nhật ảnh đại diện
                            </Form.Label>
                            <Form.Control
                              id='avatar'
                              type='file'
                              accept='image/*'
                              className='d-none'
                              onChange={handleAvatarChange}
                            />
                          </div>
                        )} */}

                        <div>
                          <h5>{userDataLocal.username}</h5>
                          <p className='text-muted small'>
                            {userDataLocal.role === 'admin'
                              ? 'Quản trị viên'
                              : 'Đầu bếp cộng đồng'}
                          </p>
                          <p className='text-muted small'>
                            Tham gia từ ngày{' '}
                            {DateTime.fromISO(
                              userDataLocal?.createdAt
                            ).toFormat('dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    </Col>

                    {/* User Info Section */}
                    <Col md={8}>
                      <Form.Group className='mb-3'>
                        <Form.Label htmlFor='username'>
                          Tên/Biệt danh
                        </Form.Label>
                        <Form.Control
                          id='username'
                          name='username'
                          value={formData.username}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          isInvalid={!!errors.username}
                        />
                        <Form.Control.Feedback type='invalid'>
                          {errors.username}
                        </Form.Control.Feedback>
                      </Form.Group>

                      <Form.Group className='mb-3'>
                        <Form.Label htmlFor='email'>Email cá nhân</Form.Label>
                        <Form.Control
                          id='email'
                          name='email'
                          type='email'
                          value={formData.email}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          isInvalid={!!errors.email}
                        />
                        <Form.Control.Feedback type='invalid'>
                          {errors.email}
                        </Form.Control.Feedback>
                      </Form.Group>

                      {/* {isEditing && (
                        <>
                          <Form.Group className='mb-3'>
                            <Form.Label htmlFor='password'>
                              Mật khẩu mới
                            </Form.Label>
                            <Form.Control
                              id='password'
                              name='password'
                              type='password'
                              value={formData.password}
                              onChange={handleInputChange}
                              isInvalid={!!errors.password}
                            />
                            <Form.Control.Feedback type='invalid'>
                              {errors.password}
                            </Form.Control.Feedback>
                          </Form.Group>

                          <Form.Group className='mb-3'>
                            <Form.Label htmlFor='passwordConfirm'>
                              Xác nhận mật khẩu mới
                            </Form.Label>
                            <Form.Control
                              id='passwordConfirm'
                              name='passwordConfirm'
                              type='password'
                              value={passwordConfirm}
                              onChange={(e) =>
                                setPasswordConfirm(e.target.value)
                              }
                              isInvalid={!!errors.passwordConfirm}
                            />
                            <Form.Control.Feedback type='invalid'>
                              {errors.passwordConfirm}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </>
                      )} */}

                      <Form.Group className='mb-3'>
                        <Form.Label htmlFor='description'>Mô tả</Form.Label>
                        <Form.Control
                          as='textarea'
                          id='description'
                          name='description'
                          value={formData.description}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          rows={4}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {isEditing && (
                    <div className='d-flex justify-content-end mt-3'>
                      <Button
                        type='button'
                        disabled={isLoading}
                        className='w-100 w-md-auto'
                        onClick={handleSubmit}
                      >
                        {isLoading ? (
                          <>
                            <Spinner
                              as='span'
                              animation='border'
                              size='sm'
                              role='status'
                              aria-hidden='true'
                              className='me-2'
                            />
                            Đang cập nhật...
                          </>
                        ) : (
                          <>
                            <FaSave className='me-2' />
                            Lưu thay đổi
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </Form>
              </Card.Body>
            </Card>
          </Tab>

          <Tab eventKey='saved-recipes' title='Công thức đã chia sẻ'>
            <Card>
              <Card.Header>
                <Card.Title>
                  Danh sách công thức bạn đã chia sẻ với cộng đồng
                </Card.Title>
                <Card.Subtitle className='text-muted mt-2'>
                  Quản lý các công thức nấu ăn của bạn
                </Card.Subtitle>
              </Card.Header>
              <Card.Body>
                {recipeListByUserId && recipeListByUserId.length > 0 ? (
                  <ListGroup variant='flush'>
                    {recipeListByUserId.map((recipe) => (
                      <ListGroup.Item
                        key={recipe._id}
                        className='border-bottom py-3'
                      >
                        <Row>
                          <Col xs={12} md={3} className='mb-3 mb-md-0'>
                            <div
                              style={{ height: '150px', overflow: 'hidden' }}
                            >
                              <Image
                                src={recipe.imageUrl || '/placeholder-food.jpg'}
                                alt={recipe.title}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                                thumbnail
                              />
                            </div>
                          </Col>
                          <Col xs={12} md={9}>
                            <div className='d-flex justify-content-between align-items-start'>
                              <h5>{recipe.title}</h5>
                              {getStatusBadge(recipe.status)}
                            </div>

                            <p className='text-muted small'>
                              Đăng ngày:{' '}
                              {DateTime.fromISO(recipe.createdAt).toFormat(
                                'dd/MM/yyyy'
                              )}
                            </p>

                            <div className='mb-2'>
                              <strong>Phân loại: </strong>
                              <div className='mt-1'>
                                {formatCategories(recipe.foodCategories)}
                              </div>
                            </div>

                            <p
                              className='mb-3'
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {recipe.description}
                            </p>

                            {recipe?.status === 'Public' && (
                              <div className='d-flex gap-2 mt-2'>
                                <Button
                                  variant='outline-primary'
                                  size='sm'
                                  onClick={() => handleViewRecipe(recipe.slug)}
                                >
                                  <FaEye className='me-1' /> Xem
                                </Button>
                              </div>
                            )}
                          </Col>
                        </Row>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <Alert variant='info'>
                    <p className='mb-0'>
                      Bạn chưa chia sẻ công thức nào. Hãy bắt đầu chia sẻ công
                      thức đầu tiên của bạn!
                    </p>
                  </Alert>
                )}
              </Card.Body>
              {/* <Card.Footer>
              <Button
                variant='primary'
                onClick={() => navigate('/recipes/create')}
              >
                Thêm công thức mới
              </Button>
            </Card.Footer> */}
            </Card>
          </Tab>
        </Tabs>
      </Container>
    </>
  );
}

export default UserProfile;
