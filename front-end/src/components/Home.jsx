import { Outlet } from 'react-router-dom';
import MenuBar from './layout/MenuBar';
import Header from './layout/Header';
import { useCommon } from '../contexts/CommonContext';
import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';

function Home() {
  const {
    getCalendarUser,
    userDataLocal,
    accessToken,
    showGoogleAuthModal,
    setShowGoogleAuthModal,
    handleGoogleAuth,
    isGoogleAuthenticated,
    isCheckingGoogleAuth,
    navigate,
  } = useCommon();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (accessToken && userDataLocal && !isGoogleAuthenticated) {
      getCalendarUser();
    }
  }, [accessToken, userDataLocal, isGoogleAuthenticated]);

  const handleConfirmGoogleAuth = async () => {
    setIsLoading(true);
    await handleGoogleAuth();
    setIsLoading(false);
  };

  const handleCancelGoogleAuth = () => {
    setShowGoogleAuthModal(false);
  };

  return (
    <div className='home-container'>
      <MenuBar />
      <div className='main-content'>
        <Header />
        <main className='content'>
          <Outlet />
        </main>
      </div>

      {/* Loading overlay khi đang kiểm tra Google Auth */}
      {isCheckingGoogleAuth && (
        <div className='google-modal-overlay'>
          <div className='google-modal-content'>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spinner animation='border' variant='primary' />
              <p style={{ marginTop: '1rem', color: '#666' }}>
                Đang kiểm tra trạng thái xác thực...
              </p>
            </div>
          </div>
        </div>
      )}

      {showGoogleAuthModal && !isCheckingGoogleAuth && (
        <div className='google-modal-overlay'>
          <div className='google-modal-content'>
            <h2>Bạn cần xác thực Google để tiếp tục</h2>
            <p>
              Để sử dụng đầy đủ một số tính năng và đồng bộ dữ liệu của bạn với
              tài khoản Google cá nhân, bạn cần cấp quyền cho ứng dụng. Bạn có
              muốn tiếp tục không?
            </p>
            <button
              onClick={handleConfirmGoogleAuth}
              disabled={isLoading}
              style={{ position: 'relative' }}
            >
              {isLoading ? (
                <Spinner
                  as='span'
                  animation='border'
                  size='sm'
                  color='light'
                  role='status'
                  aria-hidden='true'
                />
              ) : (
                'Có'
              )}
            </button>
            <button onClick={handleCancelGoogleAuth} disabled={isLoading}>
              Không
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
