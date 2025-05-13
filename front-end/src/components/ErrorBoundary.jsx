import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <div className='flex justify-center items-center w-full h-screen'>
            <div className='my-5 text-center wrapper-post-details feeds-content border-slate-300 rounded-3xl shadow shadow-gray-400 px-10 py-7'>
              <div className='text-4xl mb-3'>Ôi 🙀! Đã có lỗi xảy ra!</div>
              <h1 className='mb-2 text-lg'>
                Đường dẫn không hợp lệ. Nhấn vào
                <a
                  className='text-blue-400 hover:text-blue-500 duration-300 ease-in-out'
                  href='/'
                >
                  &nbsp;đây&nbsp;
                </a>
                để quay về trang chủ.
              </h1>
              <div className='text-base'>
                Mong bạn thông cảm vì sự bất tiện này 🥲🥲🥲
              </div>
            </div>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
