import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useMediaQuery } from 'react-responsive';
import { Toaster, toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

const CommonContext = createContext();

export const useCommon = () => useContext(CommonContext);

export const Common = ({ children }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const [accessToken, setAccessToken] = useState(
		() => localStorage.getItem('accessToken') || null
	);
	const [userDataLocal, setUserDataLocal] = useState(() => {
		return JSON.parse(localStorage.getItem('userData')) || null;
	});

	// Enhanced responsive breakpoints
	const isMobile = useMediaQuery({ maxWidth: 768 });
	const isTablet = useMediaQuery({ minWidth: 769, maxWidth: 1024 });
	const isDesktop = useMediaQuery({ minWidth: 1025 });

	// const { from } = location.state || { from: '/' }; // Nếu không có thông tin from thì mặc định về trang chủ

	// Đổi sang biến env tương ứng (VITE_API_BASE_URL_DEVELOPMENT hoặc VITE_API_BASE_URL_PRODUCTION)
	// và build lại để chạy server frontend trên môi trường dev hoặc production
	const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_DEVELOPMENT;
	// const apiBaseUrl = import.meta.env.VITE_API_BASE_URL_PRODUCTION;

	const [calendarUser, setCalendarUser] = useState(null);
	const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);
	const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);

	//workspace
	const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
	// state workspace
	const [workspaces, setWorkspaces] = useState([]);
	const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
	const [workspacesError, setWorkspacesError] = useState(null);

	// state boards
	const [boards, setBoards] = useState([]);
	const [loadingBoards, setLoading] = useState(false);
	const [boardsError, setError] = useState(null);

	//Kiểm tra xem người dùng đã xác thực Google chưa
	const checkGoogleAuth = async () => {
		try {
			const response = await axios.get(
				`${apiBaseUrl}/files/check-google-auth`,
				{
					headers: { Authorization: `Bearer ${accessToken}` },
				}
			);
			console.log('checkgoogleAuth response:', response);

			if (response.data.status === 'success') {
				setIsGoogleAuthenticated(true);
			} else {
				setShowGoogleAuthModal(true); // Hiển thị modal nếu chưa xác thực
			}
		} catch (error) {
			setShowGoogleAuthModal(true); // Hiển thị modal nếu có lỗi hoặc chưa xác thực
		}
	};

	// Authentication functions
	const login = async (email, password) => {
		try {
			const response = await axios.post(`${apiBaseUrl}/login`, {
				email,
				password,
			});

			if (response.data.success) {
				const { accessToken, user } = response.data;

				// Save to localStorage
				localStorage.setItem('accessToken', accessToken);
				localStorage.setItem('userData', JSON.stringify(user));

				// Update state
				setAccessToken(accessToken);
				setUserDataLocal(user);

				toast.success('Login successful!');
				navigate('/'); // or wherever your home page is
				return true;
			}
		} catch (error) {
			console.error('Login error:', error);
			toast.error(error.response?.data?.message || 'Login failed');
			return false;
		}
	};

	const register = async (username, email, password, passwordConfirm) => {
		try {
			const response = await axios.post(`${apiBaseUrl}/signup`, {
				username,
				email,
				password,
				passwordConfirm,
			});

			if (response.data.status === 'success') {
				const { token, data } = response.data;

				// Save to localStorage
				localStorage.setItem('accessToken', token);
				localStorage.setItem('userData', JSON.stringify(data.user));

				// Update state
				setAccessToken(token);
				setUserDataLocal(data.user);

				toast.success('Registration successful!');
				navigate('/');
				return true;
			}
		} catch (error) {
			console.error('Registration error:', error);
			toast.error(error.response?.data?.message || 'Registration failed');
			return false;
		}
	};

	const logout = () => {
		// Clear localStorage
		localStorage.removeItem('accessToken');
		localStorage.removeItem('userData');

		// Clear state
		setAccessToken(null);
		setUserDataLocal(null);

		// Navigate to login
		navigate('/login');
	};

	//Create a personal calendar for user (if needed)
	const createInitialCalendar = async () => {
		try {
			const response = await axios.post(
				`${apiBaseUrl}/calendar`,
				{
					name: 'Personal Working Calendar',
					description: 'A calendar for each user in system',
					ownerType: 'user',
				},
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				}
			);
		} catch (error) {
			// console.error('Error creating calendar:', error.response?.data?.message);
		}
	};

	// Get user calendar
	const getCalendarUser = async () => {
		try {
			const response = await axios.get(`${apiBaseUrl}/calendar/get-by-user`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});
			console.log('Lấy lịch user:', response.data);
			if (response.data.status === 200 && response.data.data?.length > 0) {
				setCalendarUser(response.data.data[0]); // Lấy lịch đầu tiên
			}
		} catch (error) {
			console.error(
				'Lỗi khi lấy lịch user:',
				error.response?.data?.message || error.message
			);
			if (error.response?.status === 404) {
				// Không tìm thấy lịch, thử tạo mới
				const created = await createUserCalendarInitialCalendar();
				if (!created) {
					toast.error('Không thể tạo lịch cá nhân');
				}
			} else {
				toast.error('Lỗi khi tải lịch');
			}
		}
	};

	// Xử lý xác thực Google
	const handleGoogleAuth = async () => {
		try {
			const response = await axios.get(`${apiBaseUrl}/files/get-auth-url`, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			console.log('get google auth url response:', response);

			if (response.data.status === 'success') {
				window.location.href = response.data.data.authUrl; // Redirect đến Google
			}
		} catch (error) {
			toast.error('Lỗi khi khởi tạo xác thực Google');
		}
	};

	// Set up axios interceptor for handling 401 responses
	useEffect(() => {
		// const interceptor = axios.interceptors.response.use(
		//   (response) => response,
		//   (error) => {
		//     if (error.response?.status === 401) {
		//       logout();
		//     }
		//     return Promise.reject(error);
		//   }
		// );

		if (accessToken && userDataLocal) {
			checkGoogleAuth(); // Kiểm tra xác thực Google khi có token
			createInitialCalendar();
			getCalendarUser();
		}

		// return () => axios.interceptors.response.eject(interceptor);
	}, [accessToken, userDataLocal]);

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

	// 1. Effect để fetch workspaces
	// useEffect(() => {
	// 	const fetchWorkspaces = async () => {
	// 		if (!accessToken) {
	// 			setLoadingWorkspaces(false);
	// 			return;
	// 		}
	// 		try {
	// 			const res = await axios.get(`${apiBaseUrl}/workspace`, {
	// 				headers: { Authorization: `Bearer ${accessToken}` },
	// 			});
	// 			// Giả sử API trả { workspaces: [...] }
	// 			setWorkspaces(res.data.data || []);
	// 		} catch (err) {
	// 			setWorkspacesError(err.response?.data?.message || err.message);
	// 		} finally {
	// 			setLoadingWorkspaces(false);
	// 		}
	// 	};

	// 	fetchWorkspaces();
	// }, [apiBaseUrl, accessToken]);
	useEffect(() => {
  const fetchWorkspaces = async () => {
  setLoadingWorkspaces(true);
  setWorkspacesError(null);

  if (!accessToken) {
    setWorkspaces([]);
    setLoadingWorkspaces(false);
    return;
  }

  try {
    const res = await axios.get(
      `${apiBaseUrl}/workspace`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
      }
    );
    // API trả { status, results, data:[...] }
    const raw = res.data.data || [];
    setWorkspaces(raw);
  } catch (err) {
    setWorkspacesError(err.response?.data?.message || err.message);
  } finally {
    setLoadingWorkspaces(false);
  }
};


  fetchWorkspaces();
}, [apiBaseUrl, accessToken]);

	// 2. Hàm hỗ trợ navigate tới form tạo workspace
	const navigateToCreateWorkspace = () => {
		navigate('/workspace/create');
	};

	// const fetchBoards = async (workspaceId) => {
	// 	setLoading(true);
	// 	setError(null);
	// 	try {
	// 		const res = await axios.get(
	// 			`${apiBaseUrl}/workspace/${workspaceId}/board`,
	// 			{ headers: { Authorization: `Bearer ${accessToken}` } }
	// 		);
	// 		// unwrap đúng field và ép mọi mảng về [] nếu missing
	// 		const raw = res.data.boards || [];
	// 		const norm = raw.map((board) => ({
	// 			...board,
	// 			members: board.members || [], // luôn có mảng
	// 			tasks: board.tasks || [], // luôn có mảng
	// 		}));
	// 		setBoards(norm);
	// 	} catch (err) {
	// 		setError(err.response?.data?.message || err.message);
	// 	} finally {
	// 		setLoading(false);
	// 	}
	// };
	const fetchBoards = async (workspaceId) => {
  setLoading(true);
  setError(null);

  try {
    const res = await axios.get(
      `${apiBaseUrl}/workspace/${workspaceId}/board`,
      {
        headers: { 
          Authorization: `Bearer ${accessToken}` 
        },
        withCredentials: true   // ← gửi cookie kèm request
      }
    );

    // lấy mảng boards từ payload
    const raw = res.data.boards || [];
    // chuẩn hóa các trường luôn luôn có mảng và có listsCount
    const norm = raw.map((board) => ({
      ...board,
      members:   board.members   || [],
      tasks:     board.tasks     || [],
      listsCount: board.listsCount || 0,
    }));

    setBoards(norm);
  } catch (err) {
    setError(err.response?.data?.message || err.message);
  } finally {
    setLoading(false);
  }
};


	return (
		<CommonContext.Provider
			value={{
				isMobile,
				isTablet,
				isDesktop,
				toast,
				navigate,
				userDataLocal,
				setUserDataLocal,
				accessToken,
				uploadImageToCloudinary,
				apiBaseUrl,
				login,
				register,
				logout,
				createInitialCalendar,
				getCalendarUser,
				calendarUser,
				setCalendarUser,
				showGoogleAuthModal,
				setShowGoogleAuthModal,
				handleGoogleAuth,
				isGoogleAuthenticated,
				workspaces,
				loadingWorkspaces,
				workspacesError,
				currentWorkspaceId,
				setCurrentWorkspaceId,
				navigateToCreateWorkspace,
				boards,
				fetchBoards,
				loadingBoards,
				boardsError,
			}}>
			<Toaster
				richColors
				position='top-center'
				expand={true}
				visibleToasts={5}
				toastOptions={{
					duration: 2000,
				}}
			/>

			{children}
		</CommonContext.Provider>
	);
};
