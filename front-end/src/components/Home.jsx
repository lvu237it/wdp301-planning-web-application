import { Outlet } from 'react-router-dom';
import MenuBar from './layout/MenuBar';
import Header from './layout/Header';
import { useCommon } from '../contexts/CommonContext';
import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';

const Home = () => {
  const {
    createInitialCalendar,
    getCalendarUser,
    userDataLocal,
    accessToken,
    showGoogleAuthModal,
    setShowGoogleAuthModal,
    handleGoogleAuth,
    isGoogleAuthenticated,
    navigate,
  } = useCommon();

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (accessToken && userDataLocal && !isGoogleAuthenticated) {
      createInitialCalendar();
      getCalendarUser();
    }
  }, [accessToken, userDataLocal, isGoogleAuthenticated]);

  const handleConfirmGoogleAuth = async () => {
    setIsLoading(true);
    await handleGoogleAuth();
    setIsLoading(false);
  };

  const handleCancelGoogleAuth = () => {
    setShowGoogleAuthModal(false); // Ẩn modal nếu chọn "Không"
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

      {showGoogleAuthModal && (
        <div className='google-modal-overlay'>
          <div className='google-modal-content'>
            <h2>Bạn cần xác thực Google để tiếp tục</h2>
            <p>
              Để sử dụng đầy đủ 1 số các tính năng và đồng bộ dữ liệu của bạn
              với tài khoản Google cá nhân, bạn cần cấp quyền cho ứng dụng. Bạn
              có muốn tiếp tục?
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
};

export default Home;
