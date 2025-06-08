import { Outlet } from 'react-router-dom';
import MenuBar from './layout/MenuBar';
import Header from './layout/Header';

const Home = () => {
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
