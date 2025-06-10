import { Outlet } from 'react-router-dom';
import MenuBar from './layout/MenuBar';
import Header from './layout/Header';
import { useCommon } from '../contexts/CommonContext';
import { useEffect } from 'react';

const Home = () => {
  const { createInitialCalendar, getCalendarUser, userDataLocal, accessToken } =
    useCommon();

  useEffect(() => {
    if (accessToken && userDataLocal) {
      createInitialCalendar();
      getCalendarUser();
    }
  }, [userDataLocal, accessToken]);

  return (
    <div className='home-container'>
      <MenuBar />
      <div className='main-content'>
        <Header />
        <main className='content'>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Home;
