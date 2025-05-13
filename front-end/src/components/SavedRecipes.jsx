import { useState, useMemo, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import {
  Button,
  Image,
  Form,
  InputGroup,
  Col,
  Row,
  Spinner,
} from 'react-bootstrap';
import { useCommon } from '../contexts/CommonContext';
import { Link } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { Modal } from 'react-bootstrap';
import { BiPencil, BiImageAdd } from 'react-icons/bi';
import ReactPaginate from 'react-paginate';
import axios from 'axios';
import { HiMiniBellAlert } from 'react-icons/hi2';
import { FaRegCircleUser } from 'react-icons/fa6';
import { GiCook } from 'react-icons/gi';
import { PiChefHat } from 'react-icons/pi';
import { CiBookmarkCheck } from 'react-icons/ci';
import { IoHomeOutline } from 'react-icons/io5';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKitchenSet } from '@fortawesome/free-solid-svg-icons';
import { RiArrowGoBackLine } from 'react-icons/ri';
import { useLocation } from 'react-router-dom';

function SavedRecipes() {
  const {
    recipes,
    setRecipes,
    selectedCategory,
    setSelectedCategory,
    filteredRecipes,
    setFilteredRecipes,
    listOfCategories,
    sortOrder,
    setSortOrder,
    Toaster,
    toast,
    handleSaveRecipe,
    handleUnsaveRecipe,
    handleSaveToggle,
    savedRecipeIds,
    setSavedRecipeIds,
    currentPage,
    setCurrentPage,
    generatePageNumbers,
    totalPages,
    handlePageChange,
    searchRecipeInput,
    setSearchRecipeInput,
    navigate,
    savedRecipes,
    setSavedRecipes,
    userDataLocal,
  } = useCommon();
  const [searchSavedRecipeInput, setSearchSavedRecipeInput] = useState('');
  const location = useLocation();

  return (
    <div
      className='wrapper-recipes'
      style={{
        width: '100%',
        minHeight: '100vh',
        margin: 'auto',
        position: 'relative',
      }}
    >
      <Toaster richColors />
      <div
        className='recipe-detail-header'
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          background: '#528135',
          zIndex: 1,
          borderBottom: '0.2px solid rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Link to={'/'}>
            <RiArrowGoBackLine
              title='Quay lại'
              className='ri-arrow-go-back-line-recipe-detail m-3'
              style={{
                fontSize: 32,
                padding: 5,
                borderRadius: '99%',
                color: 'black',
              }}
            />
          </Link>
        </div>
      </div>

      {/* Recipe display logic */}
      {savedRecipes.length === 0 && searchSavedRecipeInput !== '' ? (
        <div className='text-center my-4'>
          Không tìm thấy công thức đã lưu
          {searchSavedRecipeInput}"
        </div>
      ) : savedRecipes.length === 0 ? (
        // Loading saved recipes
        <div className='' style={{ width: '100%', textAlign: 'center' }}>
          Bạn chưa lưu công thức nào
        </div>
      ) : (
        <>
          <div
            className='saved-recipe-list-wrapper-border border mb-3'
            style={{
              borderRadius: '10px',
              backgroundColor: '#fdf7f4',
              borderColor: 'rgba(169, 169, 169, 0.1)',
            }}
          >
            {savedRecipes.map((item) => {
              // const isSaved = savedRecipeIds.includes(recipe._id);
              return (
                <div className='p-4' key={item.recipe._id}>
                  <div
                    key={item.recipe._id}
                    className='wrapper-image-and-content d-md-grid d-flex flex-column gap-3'
                  >
                    <Image
                      className='an-image-in-recipe-list p-2 shadow'
                      src={item.recipe?.imageUrl}
                      style={{
                        margin: 'auto',
                        border: '0.1px solid whitesmoke',
                        backgroundColor: 'white',
                        maxWidth: '100%',
                      }}
                    />
                    <div
                      className='wrapper-content-recipe'
                      style={{ margin: '0px 15px' }}
                    >
                      <div
                        className='recipe-title text-center text-md-start'
                        style={{
                          fontWeight: 'bolder',
                          color: '#528135',
                          textTransform: 'uppercase',
                          fontSize: 32,
                        }}
                      >
                        {item.recipe?.title}
                      </div>
                      <div
                        className='recipe-description'
                        style={{ margin: '10px 0', fontSize: 14 }}
                        dangerouslySetInnerHTML={{
                          __html: item.recipe?.description,
                        }}
                      ></div>
                      <div
                        className='recipe-actions d-flex gap-2 justify-content-md-end justify-content-center'
                        style={{
                          justifyContent: 'end',
                          gap: '10px',
                        }}
                      >
                        {/* <Link to={`/recipe-details/${item.recipe?.slug}`}>
                          <button className='button-show-details'>
                            Xem chi tiết
                          </button>
                        </Link> */}
                        <Link
                          to={`/recipe-details/${item.recipe?.slug}`}
                          state={{ from: location.pathname }} // Lưu trang trước vào state
                        >
                          <button className='button-show-details'>
                            Xem chi tiết
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default SavedRecipes;
