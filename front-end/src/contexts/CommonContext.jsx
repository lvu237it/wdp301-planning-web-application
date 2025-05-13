import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useMediaQuery } from 'react-responsive';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

const CommonContext = createContext();

export const useCommon = () => useContext(CommonContext);

export const Common = ({ children }) => {
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest');
  // Searching recipe by recipe name or ingredients
  const [searchRecipeInput, setSearchRecipeInput] = useState('');

  const [openOptionsRecipeDetailModal, setOpenOptionsRecipeDetailModal] =
    useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = localStorage.getItem('accessToken');
  const [userDataLocal, setUserDataLocal] = useState(() => {
    return JSON.parse(localStorage.getItem('userData')) || null;
  });
  // let userDataLocal = JSON.parse(localStorage.getItem('userData'));

  const listOfCategories = [
    'món chính',
    'món ăn nhẹ',
    'món xào',
    'món luộc',
    'món nướng',
    'món chiên',
    'món canh',
    'món nộm',
    'món gỏi',
    'món lẩu',
    'món nước',
    'món nhậu',
    'món hấp',
    'món trộn',
    'món chay',
    'món bánh',
    'món kho',
    'món cháo',
    'món ăn vặt',
    'món cuốn',
    'món dịp đặc biệt',
    'món giò',
    'món khai vị',
    'món salad',
    'món hầm',
    'món súp',
  ];

  // const location = useLocation();
  // const navigate = useNavigate();
  // const { from } = location.state || { from: '/' }; // Nếu không có thông tin from thì mặc định về trang chủ

  // Đổi sang biến env tương ứng (VITE_API_BASE_URL_DEVELOPMENT hoặc VITE_API_BASE_URL_PRODUCTION)
  // và build lại để chạy server frontend trên môi trường dev hoặc production
  const frontEndUrl = import.meta.env.VITE_API_BASE_URL_DEVELOPMENT;

  const [savedRecipeIds, setSavedRecipeIds] = useState([]);
  const [nextCursor, setNextCursor] = useState(null); // State để lưu trữ cursor tiếp theo
  const [currentPage, setCurrentPage] = useState(0); // Changed to 0-based for react-paginate
  const [totalPages, setTotalPages] = useState(0);
  const [itemsPerPage] = useState(10);
  // const [isLoading, setIsLoading] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [communityChefsList, setCommunityChefsList] = useState([]);
  const [recipeChefList, setRecipeChefList] = useState([]);
  const [recipeListByUserId, setRecipeListByUserId] = useState([]);
  // Modal for creating new recipe
  const [showCreateRecipeModal, setShowCreateRecipeModal] = useState(false);
  useState(false);
  const [previewImageRecipeUrl, setPreviewImageRecipeUrl] = useState(null);
  const [inputFoodCategory, setInputFoodCategory] = useState('');
  const [inputRecipeName, setInputRecipeName] = useState('');
  const [inputRecipeDescription, setInputRecipeDescription] = useState('');
  const [foodCategoriesListForNewRecipe, setFoodCategoriesListForNewRecipe] =
    useState([]);
  const [inputIngredient, setInputIngredient] = useState('');
  const [ingredientsListForNewRecipe, setIngredientsListForNewRecipe] =
    useState([]);
  const [inputStep, setInputStep] = useState('');
  const [stepsListForNewRecipe, setStepsListForNewRecipe] = useState([]);
  const [inputSource, setInputSource] = useState('');
  const [sourcesListForNewRecipe, setSourcesListForNewRecipe] = useState([]);
  const [imageRecipe, setImageRecipe] = useState(null);

  // Get recipes list by userId
  const getRecipesListByUserId = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/users/${userDataLocal?._id}/recipes`
      );

      if (response) {
        setRecipeListByUserId(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch recipes by userid:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu! Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    if (userDataLocal) {
      getRecipesListByUserId();
    }
  }, [userDataLocal]);

  // Get recipes with all possible filters
  const getRecipes = async (page = 0) => {
    // setIsLoading(true);
    try {
      const cursor = page * itemsPerPage;
      let response;

      const params = {
        limit: itemsPerPage,
        cursor,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        sortOrder,
      };

      if (searchRecipeInput) {
        // Search case
        response = await axios.get(`http://localhost:3000/recipes/search`, {
          params: {
            ...params,
            query: searchRecipeInput,
          },
        });
      } else {
        // Normal case
        response = await axios.get('http://localhost:3000/recipes', {
          params,
        });
      }

      if (response.data.status === 200) {
        setRecipes(response.data.data);
        setTotalPages(response.data.totalPages);
        setFilteredRecipes(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
      toast.error('Có lỗi xảy ra khi tải dữ liệu! Vui lòng thử lại.');
    }
    // finally {
    //   setIsLoading(false);
    // }
  };

  // Effect to handle pagination and filters
  useEffect(() => {
    getRecipes(currentPage);
  }, [currentPage, searchRecipeInput, selectedCategory, sortOrder]);

  // Handle page change
  const handlePageChange = (selectedItem) => {
    setCurrentPage(selectedItem.selected);
    window.scrollTo(0, 0); // Scroll to top when page changes
  };

  // Reset pagination when filters change
  useEffect(() => {
    if (currentPage !== 0) {
      setCurrentPage(0);
    }
  }, [searchRecipeInput, selectedCategory, sortOrder]);

  useEffect(() => {
    const fetchUser = async () => {
      const response = await axios.get('http://localhost:3000/users');
      setCommunityChefsList(response.data);
    };
    fetchUser();
    console.log(communityChefsList);
  }, []);

  useEffect(() => {
    const fetchSavedRecipes = async () => {
      if (!userDataLocal?._id || !accessToken) {
        toast.error('Vui lòng đăng nhập để sử dụng tính năng này');
        return;
      }

      // setIsLoadingSavedRecipes(true);
      try {
        const response = await axios.get(
          `http://localhost:3000/saved-recipes/all-saved-recipes-by-user-id/${userDataLocal._id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        // Check if response has the correct structure
        if (response.data.status === 'success' && response.data.data) {
          // Update savedRecipes with full recipe data
          setSavedRecipes(response.data.data);

          // Update savedRecipeIds with just the recipe IDs
          const savedRecipeIdsList = response.data.data.map(
            (item) => item.recipe._id
          );
          setSavedRecipeIds(savedRecipeIdsList);

          console.log(
            'Saved recipes fetched successfully:',
            response.data.data
          );
          // setIsLoadingSavedRecipes(false);
        } else {
          console.error('Unexpected response structure:', response.data);
          // toast.error('Có lỗi khi tải dữ liệu công thức đã lưu');
        }
      } catch (error) {
        console.error('Error fetching saved recipes:', error.response || error);
        const errorMessage =
          error.response?.data?.message ||
          'Có lỗi xảy ra khi tải danh sách công thức đã lưu';
        // toast.error(errorMessage);
      }
      // finally {
      //   setIsLoadingSavedRecipes(false);
      // }
    };

    if (
      accessToken ||
      userDataLocal?._id ||
      location.pathname === '/saved-recipes'
    ) {
      fetchSavedRecipes();
    }
  }, [userDataLocal?._id, accessToken, location.pathname]); // Add accessToken as dependency

  // Hàm xử lý toggle trạng thái lưu
  const handleSaveToggle = async (recipeId) => {
    const isSaved = savedRecipeIds.includes(recipeId);

    try {
      // Tạo bản sao của savedRecipeIds để cập nhật đúng
      let newSavedIds;
      if (isSaved) {
        newSavedIds = savedRecipeIds.filter((id) => id !== recipeId);
      } else {
        if (!savedRecipeIds.includes(recipeId)) {
          newSavedIds = [...savedRecipeIds, recipeId];
        } else {
          newSavedIds = [...savedRecipeIds]; // Không thay đổi nếu đã tồn tại
        }
      }

      setSavedRecipeIds(newSavedIds);

      // Gọi API tương ứng
      const endpoint = isSaved ? 'unsave' : 'save';

      let saverId = userDataLocal._id;

      if (endpoint === 'unsave') {
        await axios.delete(
          `http://localhost:3000/saved-recipes/unsave-from-favorite-list/${recipeId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        toast.success('Đã bỏ lưu công thức!');
      } else {
        await axios.post(
          `http://localhost:3000/saved-recipes/save-to-my-favorite-recipes/${recipeId}`,
          { saverId },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        toast.success('Đã lưu công thức!');
      }
    } catch (error) {
      toast.error(
        `Lỗi: ${error.response?.data?.message || 'Thao tác thất bại'}`
      );
    }
  };

  // Lưu công thức vào danh sách yêu thích
  const handleSaveRecipe = async (recipeId) => {
    try {
      const response = await axios.post(
        `http://localhost:3000/saved-recipes/save-to-my-favorite-recipes/${recipeId}`,
        {
          saverId: userDataLocal._id,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (Number(response.status) === 201) {
        console.log('Save recipe successfully!');
        toast.success('Đã lưu công thức vào danh sách yêu thích của bạn!');
      }
    } catch (error) {
      console.error('Error saving recipe to your favorite list:', error);
      toast.error('Có lỗi xảy ra khi lưu công thức! Vui lòng thử lại.');
    }
  };

  //Bỏ lưu công thức khỏi danh sách yêu thích
  const handleUnsaveRecipe = async (recipeId) => {
    try {
      let saverId = userDataLocal._id;
      const response = await axios.delete(
        `http://localhost:3000/saved-recipes/unsave-from-favorite-list/${recipeId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          data: { saverId }, // 👈 Đặt `data` ở đây
        }
      );

      if (response.status === 200) {
        console.log('Recipe unsaved successfully!');
        toast.success('Đã bỏ lưu công thức khỏi danh sách yêu thích của bạn!');
      }
    } catch (error) {
      console.error('Error unsaving recipe:', error);
      toast.error('Có lỗi xảy ra khi bỏ lưu công thức! Vui lòng thử lại.');
    }
  };

  const handlePostRecipe = async () => {
    if (
      foodCategoriesListForNewRecipe.length === 0 ||
      inputRecipeName.trim() === '' ||
      !/^[a-zA-ZÀ-ỹ\s]+$/.test(inputRecipeName.trim()) ||
      inputRecipeDescription.trim() === '' ||
      !/^[a-zA-ZÀ-ỹ\s]+$/.test(inputRecipeDescription.trim()) ||
      ingredientsListForNewRecipe.length === 0 ||
      stepsListForNewRecipe.length === 0 ||
      imageRecipe === null
    ) {
      toast.warning(
        <>
          <div className=''>
            Hãy bổ sung đầy đủ các thông tin cần thiết và đảm bảo tên món ăn chỉ
            chứa các chữ cái!
          </div>
        </>
      );
      return;
    }

    const formData = new FormData();
    // Convert arrays/objects to JSON strings before appending
    formData.append(
      'foodCategories',
      JSON.stringify(foodCategoriesListForNewRecipe)
    );
    formData.append('title', inputRecipeName);
    formData.append('description', inputRecipeDescription);
    formData.append('ingredients', JSON.stringify(ingredientsListForNewRecipe));
    formData.append('steps', JSON.stringify(stepsListForNewRecipe));
    formData.append('owner', userDataLocal._id);
    formData.append('sources', JSON.stringify(sourcesListForNewRecipe));

    console.log('formdata entries:');
    // Debug: Log all form data entries to verify data is being added correctly
    for (let pair of formData.entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }

    try {
      setShowCreateRecipeModal(false);

      // Upload image to Cloudinary
      const uploadResponse = await uploadImageToCloudinary(imageRecipe);
      console.log('uploadresponse', uploadResponse);

      if (uploadResponse !== null) {
        formData.append('imageUrl', uploadResponse); // Add the uploaded image URL

        // Log again after adding imageUrl
        for (let pair of formData.entries()) {
          console.log(pair[0] + ': ' + pair[1]);
        }

        // Send POST request to backend
        const response = await axios.post(
          'http://localhost:3000/recipes/create-new-recipe',
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        // Handle response
        if (response.status === 200) {
          toast.success(
            'Tạo công thức mới thành công! Công thức của bạn đang chờ được duyệt.'
          );
          console.log('Create recipe post successfully!');
        } else {
          toast.error('Đã có lỗi xảy ra trong quá trình tải lên.');
          console.log('Create recipe post failed!');
        }
      } else {
        toast.error('Không thể tải ảnh lên Cloudinary.');
      }
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast.error('Đã có lỗi xảy ra trong quá trình tải lên.');
    }
  };

  const handleCancelCreateRecipe = () => {
    setShowCreateRecipeModal(false);
    setPreviewImageRecipeUrl(null);
    setInputFoodCategory('');
    setInputRecipeName('');
    setInputRecipeDescription('');
    setFoodCategoriesListForNewRecipe([]);
    setInputIngredient('');
    setIngredientsListForNewRecipe([]);
    setInputStep('');
    setStepsListForNewRecipe([]);
    setInputSource('');
    setSourcesListForNewRecipe([]);
  };

  const handleClickAddImageIcon = () => {
    const fileInput = document.getElementById('bi-attachment-add');
    fileInput.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setImageRecipe(file);

    if (file) {
      // Tạo URL blob cho ảnh để xem trước
      const previewBlobImage = URL.createObjectURL(file);
      setPreviewImageRecipeUrl(previewBlobImage); // Cập nhật URL blob
    }
  };

  const uploadImageToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append(
      'upload_preset',
      'sdn302-recipes-sharing-web-single-image-for-recipe'
    );

    try {
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${
          import.meta.env.VITE_CLOUDINARY_NAME
        }/image/upload`,
        formData
      );
      console.log('VITE_CLOUDINARY_NAME', import.meta.env.VITE_CLOUDINARY_NAME);
      console.log('response', response);
      console.log('response.data', response.data);
      console.log('response.data.secureurl', response.data.secure_url);
      if (response.status === 200) {
        console.log('oke upload thành công');
        return response.data.secure_url; // Trả về URL ảnh đã upload
      }
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Upload to Cloudinary failed');
    }
  };

  useEffect(() => {
    if (!showCreateRecipeModal) {
      setPreviewImageRecipeUrl(null);
      setInputFoodCategory('');
      setFoodCategoriesListForNewRecipe([]);
      setInputIngredient('');
      setIngredientsListForNewRecipe([]);
      setInputStep('');
      setStepsListForNewRecipe([]);
      setInputSource('');
      setSourcesListForNewRecipe([]);
    }
  }, [showCreateRecipeModal]);

  return (
    <CommonContext.Provider
      value={{
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
        navigate,
        handleSaveRecipe,
        handleUnsaveRecipe,
        handleSaveToggle,
        savedRecipeIds,
        setSavedRecipeIds,
        openOptionsRecipeDetailModal,
        setOpenOptionsRecipeDetailModal,
        currentPage,
        setCurrentPage,
        totalPages,
        searchRecipeInput,
        setSearchRecipeInput,
        // isLoading,
        handlePageChange,
        itemsPerPage,
        savedRecipes,
        setSavedRecipes,
        userDataLocal,
        setUserDataLocal,
        accessToken,
        communityChefsList,
        setCommunityChefsList,
        recipeChefList,
        setRecipeChefList,
        recipeListByUserId,
        setRecipeListByUserId,
        showCreateRecipeModal,
        setShowCreateRecipeModal,
        handlePostRecipe,
        handleCancelCreateRecipe,
        previewImageRecipeUrl,
        setPreviewImageRecipeUrl,
        inputFoodCategory,
        setInputFoodCategory,
        inputRecipeName,
        setInputRecipeName,
        inputRecipeDescription,
        setInputRecipeDescription,
        foodCategoriesListForNewRecipe,
        setFoodCategoriesListForNewRecipe,
        inputIngredient,
        setInputIngredient,
        ingredientsListForNewRecipe,
        setIngredientsListForNewRecipe,
        inputStep,
        setInputStep,
        stepsListForNewRecipe,
        setStepsListForNewRecipe,
        inputSource,
        setInputSource,
        sourcesListForNewRecipe,
        setSourcesListForNewRecipe,
        handleClickAddImageIcon,
        handleFileChange,
        imageRecipe,
        setImageRecipe,
        uploadImageToCloudinary,
      }}
    >
      {children}
    </CommonContext.Provider>
  );
};
