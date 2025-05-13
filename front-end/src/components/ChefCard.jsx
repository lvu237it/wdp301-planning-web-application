'use client';
import { Card, Image } from 'react-bootstrap';
import { FaRegCircleUser } from 'react-icons/fa6';
import { MdEmail } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';

function ChefCard({ chef }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/chef/${chef._id}`, { state: { chef } });
  };

  return (
    <Card
      className='chef-card'
      onClick={handleCardClick}
      style={{ height: 350 }}
    >
      <Card.Body className='chef-card-body'>
        <div className='chef-avatar'>
          {chef.avatar ? (
            <Image
              style={{ width: 50, height: 50 }}
              src={chef.avatar || '/placeholder.svg'}
              alt={chef.username || 'Chef'}
              roundedCircle
              className='avatar-image'
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : (
            <div className='avatar-fallback'>
              <FaRegCircleUser style={{ width: 50, height: 50 }} />
            </div>
          )}
        </div>

        <Card.Title className='chef-username'>
          {chef.username || 'Đầu bếp'}
        </Card.Title>

        <div className='chef-email'>
          <MdEmail className='email-icon' />
          <span>{chef.email || 'Email không có sẵn'}</span>
        </div>

        <div className='chef-specialty'>
          {chef.specialty || 'Đầu bếp cộng đồng'}
        </div>

        <Card.Text className='chef-description'>
          {chef.description || 'Không có mô tả.'}
        </Card.Text>
      </Card.Body>
    </Card>
  );
}

export default ChefCard;
