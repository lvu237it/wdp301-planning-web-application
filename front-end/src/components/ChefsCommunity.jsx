import { Link } from 'react-router-dom';
import { RiArrowGoBackLine } from 'react-icons/ri';
import { useCommon } from '../contexts/CommonContext';
import ChefCard from './ChefCard';

function ChefsCommunity() {
  const { Toaster, communityChefsList } = useCommon();

  return (
    <div
      className='wrapper-chefs'
      style={{
        width: '100%',
        minHeight: '100vh',
        margin: 'auto',
        position: 'relative',
        backgroundColor: '#ECE7E3',
      }}
    >
      <Toaster richColors />
      <div
        className='chef-community-header'
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          background: '#528135',
          zIndex: 1,
          borderBottom: '0.2px solid rgba(0, 0, 0, 0.1)',
          marginBottom: 20,
          padding: '10px 0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Link to={'/'}>
            <RiArrowGoBackLine
              title='Quay lại'
              className='back-button'
              style={{
                fontSize: 32,
                padding: 5,
                borderRadius: '99%',
                color: 'white',
                marginLeft: 15,
              }}
            />
          </Link>
        </div>
      </div>

      <div className='container'>
        {communityChefsList.length === 0 ? (
          <div className='no-data-message'>
            Không có dữ liệu về cộng đồng đầu bếp
          </div>
        ) : (
          <div
            className='chefs-container d-flex'
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
              padding: 20,
            }}
          >
            {communityChefsList.map((chef) => (
              <div
                style={{ width: '40%' }}
                className='chef-item'
                key={chef?._id}
              >
                <ChefCard chef={chef} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChefsCommunity;
