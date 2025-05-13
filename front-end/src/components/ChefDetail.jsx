import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Image,
  Card,
  Badge,
  Spinner,
} from 'react-bootstrap';
import { FaRegCircleUser } from 'react-icons/fa6';
import { MdEmail, MdFoodBank } from 'react-icons/md';
import { RiArrowGoBackLine } from 'react-icons/ri';
import { useCommon } from '../contexts/CommonContext';
import axios from 'axios';

function ChefDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { Toaster, toast, recipeChefList, setRecipeChefList } = useCommon();
  const navigate = useNavigate();

  // Get chef from location state or fetch it
  const [chef, setChef] = useState(location.state?.chef || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChefData = async () => {
      try {
        if (!chef) {
          const chefResponse = await axios.get(
            `http://localhost:3000/users/${id}`
          );

          console.log('chèf', chefResponse);
          setChef(chefResponse.data);
        }

        // Fetch chef's recipes
        const recipesResponse = await axios.get(
          `http://localhost:3000/users/${id}/recipes`
        );
        setRecipeChefList(
          recipesResponse.data.filter((recipe) => recipe.status === 'Public')
        );
      } catch (error) {
        console.error('Error fetching chef data:', error);
        toast.error('Không thể tải thông tin đầu bếp');
      }
    };

    fetchChefData();
  }, [id, chef, toast]);

  // Format date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  };

  const decodeHtml = (html) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  return (
    <div
      className='chef-detail-page'
      style={{ backgroundColor: '#ECE7E3', minHeight: '100vh' }}
    >
      <Toaster richColors />

      {/* Header */}
      <div
        className='chef-detail-header'
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          background: '#4B7767',
          zIndex: 1,
          borderBottom: '0.2px solid rgba(0, 0, 0, 0.1)',
          padding: '10px 0',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Link to={'/'}>
            <RiArrowGoBackLine
              title='Quay lại'
              style={{
                fontSize: 32,
                padding: 5,
                borderRadius: '99%',
                color: 'white',
                marginLeft: 15,
              }}
            />
          </Link>

          <h1 style={{ color: 'white', marginLeft: 15, fontSize: '1.5rem' }}>
            Thông tin đầu bếp
          </h1>
        </div>
      </div>

      <Container>
        <>
          {/* Chef Information */}
          <Card className='chef-profile-card mb-4'>
            <Card.Body>
              <Row>
                <Col md={3} className='text-center'>
                  <div className='chef-profile-avatar'>
                    {chef?.avatar ? (
                      <Image
                        src={chef?.avatar || '/placeholder.svg'}
                        alt={chef?.username}
                        roundedCircle
                        className='profile-avatar-image'
                      />
                    ) : (
                      <div className='profile-avatar-fallback'>
                        <FaRegCircleUser size={80} />
                      </div>
                    )}
                  </div>
                </Col>
                <Col md={9}>
                  <h2 className='chef-profile-name'>
                    {chef?.username || 'Đầu bếp'}
                  </h2>

                  <div className='chef-profile-info'>
                    <div className='info-item'>
                      <MdEmail className='info-icon' />
                      <span>{chef?.email || 'Email không có sẵn'}</span>
                    </div>

                    {chef?.specialty && (
                      <div className='info-item'>
                        <MdFoodBank className='info-icon' />
                        <span>{chef?.specialty}</span>
                      </div>
                    )}

                    {chef?.createdAt && (
                      <div className='info-item'>
                        {/* <FaRegCalendarAlt className='info-icon' /> */}
                        <span>Tham gia: {formatDate(chef?.createdAt)}</span>
                      </div>
                    )}
                  </div>

                  {chef?.description === undefined ? (
                    'Không có mô tả'
                  ) : (
                    <p
                      dangerouslySetInnerHTML={{
                        __html: decodeHtml(chef?.description),
                      }}
                    />
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Chef's Recipes */}
          <h3 className='recipes-section-title'>
            Công thức của {chef?.username}
          </h3>

          {recipeChefList.length === 0 ? (
            <div className='no-recipes-message'>
              Đầu bếp này chưa có công thức nào được công khai.
            </div>
          ) : (
            <Row className='recipe-grid'>
              {recipeChefList.map((recipe) => (
                <Col key={recipe._id} xs={12} md={6} lg={4} className='mb-4'>
                  <Link
                    to={`/recipe-details/${recipe.slug}`}
                    className='recipe-card-link'
                    onClick={() =>
                      console.log(
                        'Navigating to:',
                        `/recipe-details/${recipe.slug}`
                      )
                    }
                  >
                    <Card className='recipe-card'>
                      <div className='recipe-image-container'>
                        {recipe.imageUrl ? (
                          <Card.Img
                            variant='top'
                            src={recipe.imageUrl}
                            className='recipe-image'
                          />
                        ) : (
                          <div className='recipe-image-placeholder'>
                            <MdFoodBank size={40} />
                          </div>
                        )}
                      </div>
                      <Card.Body>
                        <Card.Title className='recipe-title'>
                          {recipe.title}
                        </Card.Title>

                        <div className='recipe-categories mb-2'>
                          {recipe.foodCategories
                            .slice(0, 3)
                            .map((category, index) => (
                              <Badge
                                key={index}
                                className='recipe-category-badge'
                              >
                                {category}
                              </Badge>
                            ))}
                          {recipe.foodCategories.length > 3 && (
                            <Badge className='recipe-category-badge'>
                              +{recipe.foodCategories.length - 3}
                            </Badge>
                          )}
                        </div>

                        <Card.Text className='recipe-description'>
                          {recipe.description.length > 100
                            ? `${recipe.description.substring(0, 100)}...`
                            : recipe.description}
                        </Card.Text>

                        <div className='recipe-meta'>
                          <small className='text-muted'>
                            {formatDate(recipe.createdAt)}
                          </small>
                        </div>
                      </Card.Body>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          )}
        </>
      </Container>
    </div>
  );
}

export default ChefDetail;
