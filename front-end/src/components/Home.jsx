import { Outlet } from 'react-router-dom';
import MenuBar from './layout/MenuBar';
import Header from './layout/Header';
import { useCommon } from '../contexts/CommonContext';
import { useEffect } from 'react';

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

  if (!accessToken || !userDataLocal) {
    navigate('/login');
    return null; // Hoặc redirect về login nếu chưa đăng nhập
  }

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
            <h2>Xác thực Google</h2>
            <p>
              Để sử dụng các tính năng như tải file lên Drive và tạo sự kiện
              online, bạn cần cấp quyền cho ứng dụng. Bạn có muốn tiếp tục?
            </p>
            <button onClick={handleConfirmGoogleAuth} disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Có'}
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
