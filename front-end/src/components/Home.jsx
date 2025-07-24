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
    checkGoogleAuth,
  } = useCommon();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (accessToken && userDataLocal && !isGoogleAuthenticated) {
      getCalendarUser();
    }
  }, [accessToken, userDataLocal, isGoogleAuthenticated]);

  // Debug effect to track modal state
  useEffect(() => {
    console.log('🏠 Home component modal state:', {
      showGoogleAuthModal,
      isCheckingGoogleAuth,
      userDataLocal: !!userDataLocal,
      accessToken: !!accessToken,
      googleId: userDataLocal?.googleId,
      modalShouldShow: showGoogleAuthModal && !isCheckingGoogleAuth,
    });
  }, [showGoogleAuthModal, isCheckingGoogleAuth, userDataLocal, accessToken]);

  useEffect(() => {
    if (!isGoogleAuthenticated) {
      checkGoogleAuth();
    }
  }, []);

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
                Checking Google authentication...
              </p>
            </div>
          </div>
        </div>
      )}

      {showGoogleAuthModal && !isCheckingGoogleAuth && (
        <div className='google-modal-overlay'>
          <div className='google-modal-content'>
            <h2>You need to enable Google authentication</h2>
            <p>
              {/* Để sử dụng đầy đủ một số tính năng và đồng bộ dữ liệu của bạn với
              tài khoản Google cá nhân, bạn cần cấp quyền cho ứng dụng. Bạn có
              muốn tiếp tục không? */}
              To fully utilize some features and sync your data with your
              personal Google account, you need to grant permissions to the
              application. Do you want to proceed? Otherwise, please try to
              login again.
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
                'Yes'
              )}
            </button>
            <button onClick={handleCancelGoogleAuth} disabled={isLoading}>
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
